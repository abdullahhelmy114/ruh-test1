/**
 * Teacher applications, administrator review and teacher accounts.
 *
 * Every state change is ONE guarded transaction that moves the application
 * (at the revision and state the actor saw), records the history event (unique
 * per application revision), writes the audit event, and moves the teacher
 * account's profile status from exactly the expected value. If any of these
 * matches nothing — a concurrent decision, a stale screen, a profile that no
 * longer matches, an unverified email at approval — the whole transaction
 * rolls back and the caller gets a conflict. There is no partial activation.
 *
 * See teachers/applications.ts for the lifecycle and the status mirror.
 */
import { ACTIVE_ACCOUNT_STATUS, AuthError, type AuthUser } from "../../auth/core.ts";
import { buildAuditEvent } from "../audit/audit.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUid, parseUuid } from "../domain/ids.ts";
import { TEACHER_APPLICATION_STATES, parseState, TEACHER_APPLICATION_MACHINE, type TeacherApplicationState } from "../domain/states.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import { expectRows, insertAuditEventQuery } from "../repo/audit-repo.ts";
import { num, str, strOrNull } from "../repo/rows.ts";
import {
  insertApplicationEventQuery,
  insertApplicationQuery,
  listApplicationEventsQuery,
  listApplicationsQuery,
  listTeacherAccountsQuery,
  lockApplicationQuery,
  mapApplicationEventRow,
  mapApplicationRow,
  selectApplicationForApplicantQuery,
  selectApplicationQuery,
  selectTeacherAccountQuery,
  setTeacherAccountStatusQuery,
  transitionAccountQuery,
  updateApplicationQuery,
  updateTeacherDisplayFieldsQuery,
} from "../repo/teacher-repo.ts";
import {
  AWAITING_DECISION_FILTER,
  AWAITING_DECISION_STATES,
  accountStatusFor,
  adminCommandsFor,
  fullNameOf,
  planAdminDecision,
  planResubmit,
  planSubmitApplication,
  planTeacherAccountChange,
  type DocumentKind,
  type PlannedApplicationChange,
  type TeacherApplicationRecord,
} from "../teachers/applications.ts";
import { audited, contextFor, loadMany, loadOptional, runGuarded, type ServiceDeps } from "./support.ts";

/** The applicant's sign-in account as the identity provider sees it (Firebase in production). */
export interface IdentityDirectory {
  signInAccount(uid: string): Promise<{ readonly exists: boolean; readonly disabled: boolean; readonly emailVerified: boolean }>;
}

/** Short-lived private links to application documents (Cloudinary in production). */
export interface DocumentLinks {
  temporaryLink(kind: DocumentKind, storageId: string): { readonly url: string; readonly expiresAt: string } | null;
}

export interface TeacherServiceDeps extends ServiceDeps {
  readonly identity: IdentityDirectory;
  readonly documents: DocumentLinks;
}

type Correlated = { readonly correlationId?: string | null };

const DUPLICATE = "There is already an application for this account.";

const bool = (value: unknown): boolean => value === true || value === "t" || value === "true";

interface TeacherAccount {
  readonly uid: string;
  readonly role: string;
  readonly status: string | null;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly fullName: string | null;
}

function mapAccount(row: Record<string, unknown> | undefined): TeacherAccount | null {
  if (!row) return null;
  return {
    uid: str(row.firebase_uid),
    role: str(row.role),
    status: strOrNull(row.status),
    email: strOrNull(row.email),
    emailVerified: bool(row.email_verified),
    fullName: strOrNull(row.full_name),
  };
}

/** What an applicant sees of their own application: never who decided, never storage ids. */
function applicantView(application: TeacherApplicationRecord) {
  const showNote = application.state === "changes_requested" || application.state === "rejected";
  return {
    id: application.id,
    state: application.state,
    revision: application.revision,
    details: application.details,
    hasCv: application.cvPublicId !== null,
    hasIntroVideo: application.introVideoPublicId !== null,
    submittedAt: application.submittedAt,
    decidedAt: showNote || application.state === "approved" ? application.decidedAt : null,
    note: showNote ? application.decisionReason : null,
  };
}

export function createTeacherService(deps: TeacherServiceDeps) {
  const { executor } = deps;

  /** The signed-in account must be a teacher account (active or not). */
  function requireTeacherAccount(user: AuthUser): void {
    assertAcademyCoreAvailable(deps.flags);
    if (user.accountRole !== "teacher") throw new AuthError("FORBIDDEN");
  }

  function guardAdmin(user: AuthUser): void {
    assertAcademyCoreAvailable(deps.flags);
    authorizeAdminAction(user, "teacher.review");
  }

  async function loadAccount(uid: string): Promise<TeacherAccount | null> {
    return mapAccount((await executor.query(selectTeacherAccountQuery(uid)))[0]);
  }

  async function loadApplication(id: unknown): Promise<TeacherApplicationRecord> {
    const application = await loadOptional(executor, selectApplicationQuery(parseUuid(id, "applicationId")), mapApplicationRow);
    if (!application) throw new DomainError("NOT_FOUND", "Application not found.");
    return application;
  }

  /** The statements of one application change, in lock → application → history → account order. */
  function changeStatements(plan: PlannedApplicationChange, previous: TeacherApplicationRecord | null, options: { readonly acceptMissingStatus?: boolean } = {}): SqlQuery[] {
    const statements: SqlQuery[] = [];
    if (previous) {
      statements.push(lockApplicationQuery(previous.id));
      statements.push(audited(deps, updateApplicationQuery(plan.record, { revision: previous.revision, state: previous.state }), plan.audit));
    } else {
      statements.push(audited(deps, insertApplicationQuery(plan.record), plan.audit));
    }
    statements.push(expectRows(insertApplicationEventQuery(plan.event), 1));
    statements.push(expectRows(transitionAccountQuery(plan.account, options), 1));
    return statements;
  }

  return {
    // -- Applicant ------------------------------------------------------------

    /** The signed-in teacher account's application status page. */
    async myApplication(user: AuthUser) {
      requireTeacherAccount(user);
      const application = await loadOptional(executor, selectApplicationForApplicantQuery(user.uid), mapApplicationRow);
      const status = user.accountStatus ?? null;
      return {
        accountStatus: status,
        active: status === ACTIVE_ACCOUNT_STATUS,
        application: application ? applicantView(application) : null,
        // An account created before applications were recorded submits its application here once.
        canSubmit: application === null && status !== ACTIVE_ACCOUNT_STATUS && (status === null || status === "pending"),
        canRevise: application?.state === "changes_requested",
      };
    },

    /** First submission from an existing teacher account (signup submits through planSignupApplication). */
    async submitApplication(user: AuthUser, input: Correlated & { readonly details: unknown; readonly cvPublicId: unknown; readonly introVideoPublicId?: unknown }) {
      requireTeacherAccount(user);
      if (user.accountStatus === ACTIVE_ACCOUNT_STATUS) throw new DomainError("CONFLICT", "This account is already an active teacher.");
      if (user.accountStatus !== null && user.accountStatus !== undefined && user.accountStatus !== "pending") {
        throw new DomainError("CONFLICT", DUPLICATE);
      }
      if (await loadOptional(executor, selectApplicationForApplicantQuery(user.uid), mapApplicationRow)) throw new DomainError("CONFLICT", DUPLICATE);
      const plan = planSubmitApplication({ applicantUid: user.uid, ...input }, contextFor(user, deps, input.correlationId));
      await runGuarded(
        executor,
        [...changeStatements(plan, null, { acceptMissingStatus: true }), expectRows(updateTeacherDisplayFieldsQuery(user.uid, plan.record.details), 1)],
        { unique: DUPLICATE },
      );
      return applicantView(plan.record);
    },

    /**
     * The statements that record a new application for an account the signup
     * route has just created (its profile insert runs first in the same
     * transaction). Pure: the route runs them together.
     */
    planSignupApplication(applicantUid: string, input: { readonly details: unknown; readonly cvPublicId: unknown; readonly introVideoPublicId?: unknown }): { readonly statements: SqlQuery[]; readonly record: TeacherApplicationRecord } {
      assertAcademyCoreAvailable(deps.flags);
      const ctx = { actor: { uid: parseUid(applicantUid, "applicantUid"), role: "applicant" as const }, clock: deps.clock, newId: deps.newId };
      const plan = planSubmitApplication({ applicantUid, ...input }, ctx);
      return { statements: changeStatements(plan, null), record: plan.record };
    },

    async resubmitApplication(
      user: AuthUser,
      input: Correlated & { readonly details: unknown; readonly cvPublicId?: unknown; readonly introVideoPublicId?: unknown; readonly expectedRevision: unknown },
    ) {
      requireTeacherAccount(user);
      const current = await loadOptional(executor, selectApplicationForApplicantQuery(user.uid), mapApplicationRow);
      if (!current) throw new DomainError("NOT_FOUND", "Application not found.");
      const plan = planResubmit(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [...changeStatements(plan, current), expectRows(updateTeacherDisplayFieldsQuery(user.uid, plan.record.details), 1)]);
      return applicantView(plan.record);
    },

    // -- Administrator ----------------------------------------------------------

    /** ?state: "awaiting" (the review queue), one application state, or absent for every application. */
    async listApplications(user: AuthUser, options: { readonly state?: unknown } = {}) {
      guardAdmin(user);
      const states =
        options.state === undefined || options.state === null || options.state === ""
          ? null
          : options.state === AWAITING_DECISION_FILTER
            ? AWAITING_DECISION_STATES
            : [parseState(TEACHER_APPLICATION_MACHINE, options.state)];
      const rows = await executor.query(listApplicationsQuery({ states }));
      return rows.map((row) => {
        const application = mapApplicationRow(row);
        return {
          id: application.id,
          applicantUid: application.applicantUid,
          name: fullNameOf(application.details),
          email: strOrNull(row.email),
          emailVerified: bool(row.email_verified),
          accountStatus: strOrNull(row.account_status),
          state: application.state,
          revision: application.revision,
          submittedAt: application.submittedAt,
          updatedAt: application.updatedAt,
        };
      });
    },

    async getApplication(user: AuthUser, applicationId: unknown) {
      guardAdmin(user);
      const application = await loadApplication(applicationId);
      const [account, events, signIn] = await Promise.all([
        loadAccount(application.applicantUid),
        loadMany(executor, listApplicationEventsQuery(application.id), mapApplicationEventRow),
        // The provider being unreachable must not hide the application; approval checks it again.
        deps.identity.signInAccount(application.applicantUid).catch(() => null),
      ]);
      return {
        application: {
          ...application,
          cvPublicId: undefined,
          introVideoPublicId: undefined,
          hasCv: application.cvPublicId !== null,
          hasIntroVideo: application.introVideoPublicId !== null,
        },
        account: {
          exists: account !== null,
          role: account?.role ?? null,
          status: account?.status ?? null,
          expectedStatus: accountStatusFor(application.state),
          email: account?.email ?? null,
          emailVerified: account?.emailVerified ?? false,
          signInAccountExists: signIn ? signIn.exists : null,
          signInAccountDisabled: signIn ? signIn.disabled : null,
        },
        history: events.map((event) => ({
          action: event.action,
          fromState: event.fromState,
          toState: event.toState,
          reason: event.reason,
          actorRole: event.actorRole,
          actorName: event.actorName,
          revision: event.applicationRevision,
          occurredAt: event.occurredAt,
        })),
        commands: adminCommandsFor(application.state),
      };
    },

    /** start_review | schedule_interview | request_changes | approve | reject, on the revision the administrator saw. */
    async decide(user: AuthUser, applicationId: unknown, input: Correlated & { readonly command: unknown; readonly reason?: unknown; readonly expectedRevision: unknown }) {
      guardAdmin(user);
      const application = await loadApplication(applicationId);
      const account = await loadAccount(application.applicantUid);
      const profileMatches = account !== null && account.role === "teacher" && account.status === accountStatusFor(application.state);
      // Only approval depends on the sign-in account; other decisions do not call the identity provider.
      const signIn = input.command === "approve" ? await deps.identity.signInAccount(application.applicantUid) : null;
      const plan = planAdminDecision(
        application,
        input,
        {
          profileMatches,
          // The same flag the transaction re-checks (profiles.email_verified, set by the verification code).
          emailVerified: account?.emailVerified ?? false,
          signInAccountUsable: signIn === null || (signIn.exists && !signIn.disabled),
        },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(executor, changeStatements(plan, application), {
        unique: "This application was decided by someone else at the same time. Reload and try again.",
      });
      return { id: plan.record.id, state: plan.record.state, revision: plan.record.revision, accountStatus: plan.account.to };
    },

    /** A short-lived private link to an application document; every opening is audited. */
    async openDocument(user: AuthUser, applicationId: unknown, kind: unknown, input: Correlated = {}) {
      guardAdmin(user);
      if (kind !== "cv" && kind !== "intro_video") throw new DomainError("NOT_FOUND", "Document not found.");
      const application = await loadApplication(applicationId);
      const storageId = kind === "cv" ? application.cvPublicId : application.introVideoPublicId;
      if (!storageId) throw new DomainError("NOT_FOUND", "Document not found.");
      const link = deps.documents.temporaryLink(kind, storageId);
      if (!link) throw new DomainError("FEATURE_UNAVAILABLE", "Documents cannot be opened right now.");
      const event = buildAuditEvent(
        {
          actor: { uid: user.uid, role: user.role },
          action: "teacher_application.open_document",
          object: { kind: "teacher_application", id: application.id },
          correlationId: input.correlationId ?? null,
          metadata: { document: kind },
        },
        { clock: deps.clock, newId: deps.newId },
      );
      await runGuarded(executor, [expectRows(insertAuditEventQuery(event), 1)]);
      return link;
    },

    /** Teacher accounts with their status, open assignments and latest application. */
    async listTeachers(user: AuthUser, options: { readonly activeOnly?: boolean } = {}) {
      guardAdmin(user);
      const rows = await executor.query(listTeacherAccountsQuery({ activeOnly: options.activeOnly === true }));
      return rows.map((row) => ({
        uid: str(row.firebase_uid),
        name: strOrNull(row.full_name),
        email: strOrNull(row.email),
        status: strOrNull(row.status),
        openAssignments: num(row.open_assignments ?? 0),
        application: row.application_id ? { id: str(row.application_id), state: str(row.application_state) as TeacherApplicationState } : null,
      }));
    },

    /** Deactivate (reason required) or reactivate an approved teacher account. */
    async changeTeacherAccount(user: AuthUser, teacherUid: unknown, input: Correlated & { readonly command: unknown; readonly reason?: unknown; readonly expectedStatus: unknown }) {
      guardAdmin(user);
      const account = await loadAccount(parseUid(teacherUid, "teacherUid"));
      if (!account) throw new DomainError("NOT_FOUND", "Teacher not found.");
      const plan = planTeacherAccountChange(account, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, setTeacherAccountStatusQuery(plan.account), plan.audit)]);
      return { uid: account.uid, status: plan.account.to };
    },
  };
}

export type TeacherService = ReturnType<typeof createTeacherService>;

/** All application states, for filters. */
export const APPLICATION_STATES: readonly TeacherApplicationState[] = TEACHER_APPLICATION_STATES;
