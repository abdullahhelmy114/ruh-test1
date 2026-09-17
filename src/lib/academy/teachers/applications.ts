/**
 * Teacher applications and teacher account activation.
 *
 * Lifecycle
 *   signup (or a teacher account created earlier) → application "submitted"
 *   → administrator: start review / schedule interview / request changes /
 *     approve / reject → applicant revises and resubmits after a change request.
 *   Approval and rejection are final.
 *
 * One coherent account outcome
 *   The application is the review record; profiles.status mirrors it for the
 *   teacher account and is what the auth layer reads (see SessionRole in
 *   auth/core.ts). Every transition moves both in ONE database transaction,
 *   guarded on the application revision and state and on the profile's
 *   current role and status, so the two can never disagree:
 *
 *     application state                    profiles (role = 'teacher') status
 *     draft, submitted, in_review, interview   pending
 *     changes_requested                        changes_requested
 *     approved                                 active   ← teaching privileges
 *     rejected                                 rejected
 *     withdrawn                                withdrawn
 *
 *   An approved teacher can later be deactivated ('inactive') and reactivated
 *   by an administrator; the application stays approved.
 *
 * Privacy
 *   The CV and introduction video are private uploads referenced by their
 *   storage id, never by a public link; only administrators obtain short-lived
 *   download links. Contact details are visible to administrators only.
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, optionalReason, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, systemClock, toIso } from "../domain/ids.ts";
import { TEACHER_APPLICATION_MACHINE, assertTransition, type TeacherApplicationState } from "../domain/states.ts";
import { assertRevision, parseRequiredRevision, parseTitle } from "../domain/text.ts";
import type { StructureContext } from "../structure/catalog.ts";

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export const TEACHER_GENDERS = ["male", "female"] as const;
export const LANGUAGE_PROFICIENCIES = ["native", "advanced", "intermediate", "beginner"] as const;
export const BIO_MIN = 50;
export const BIO_MAX = 5000;

export interface TeacherApplicationDetails {
  readonly firstName: string;
  readonly lastName: string;
  readonly countryOfResidence: string;
  readonly nationality: string;
  readonly gender: (typeof TEACHER_GENDERS)[number];
  readonly languages: readonly { readonly code: string; readonly proficiency: (typeof LANGUAGE_PROFICIENCIES)[number] }[];
  readonly whatsapp: string;
  readonly telegram: string;
  readonly bio: string;
  readonly socialLinks: readonly { readonly platform: string; readonly url: string }[];
}

function field(value: unknown, name: string, max: number): string {
  return parseTitle(value, name, max);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new DomainError("VALIDATION", `${name} is not valid.`);
  }
  return value as T;
}

function httpsUrl(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length > 500) throw new DomainError("VALIDATION", `${name} must be an https link.`);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new DomainError("VALIDATION", `${name} must be an https link.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new DomainError("VALIDATION", `${name} must be an https link.`);
  return url.toString();
}

/** Validates everything an applicant submits. Unknown fields are ignored; identity never comes from here. */
export function parseApplicationDetails(input: unknown): TeacherApplicationDetails {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DomainError("VALIDATION", "Application details are required.");
  const d = input as Record<string, unknown>;

  const languagesInput = d.languages;
  if (!Array.isArray(languagesInput) || languagesInput.length < 1 || languagesInput.length > 10) {
    throw new DomainError("VALIDATION", "Add between one and ten languages.");
  }
  const languages = languagesInput.map((entry, index) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const code = typeof e.code === "string" ? e.code.trim() : "";
    if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(code)) throw new DomainError("VALIDATION", `languages[${index}].code is not a language code.`);
    return { code: code.toLowerCase(), proficiency: oneOf(e.proficiency, LANGUAGE_PROFICIENCIES, `languages[${index}].proficiency`) };
  });
  if (new Set(languages.map((l) => l.code)).size !== languages.length) throw new DomainError("VALIDATION", "Each language can be listed once.");
  if (!languages.some((l) => l.proficiency === "native")) throw new DomainError("VALIDATION", "Mark at least one language as native.");

  const whatsapp = field(d.whatsapp, "whatsapp", 32);
  if (!/^\+?[0-9][0-9 ()-]{5,30}$/.test(whatsapp)) throw new DomainError("VALIDATION", "whatsapp must be a phone number.");

  const telegram = field(d.telegram, "telegram", 33);
  if (!/^@?[A-Za-z0-9_]{5,32}$/.test(telegram)) throw new DomainError("VALIDATION", "telegram must be a Telegram username.");

  if (typeof d.bio !== "string") throw new DomainError("VALIDATION", "bio is required.");
  const bio = d.bio.replace(/\r\n?/g, "\n").trim();
  if (bio.length < BIO_MIN || bio.length > BIO_MAX) throw new DomainError("VALIDATION", `bio must be between ${BIO_MIN} and ${BIO_MAX} characters.`);

  const linksInput = d.socialLinks === undefined || d.socialLinks === null ? [] : d.socialLinks;
  if (!Array.isArray(linksInput) || linksInput.length > 10) throw new DomainError("VALIDATION", "Add at most ten profile links.");
  const socialLinks = linksInput
    .map((entry, index) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      if ((e.url === undefined || e.url === "") && (e.platform === undefined || e.platform === "")) return null;
      return { platform: field(e.platform, `socialLinks[${index}].platform`, 40), url: httpsUrl(e.url, `socialLinks[${index}].url`) };
    })
    .filter((link): link is { platform: string; url: string } => link !== null);

  return Object.freeze({
    firstName: field(d.firstName, "firstName", 80),
    lastName: field(d.lastName, "lastName", 80),
    countryOfResidence: field(d.countryOfResidence, "countryOfResidence", 80),
    nationality: field(d.nationality, "nationality", 80),
    gender: oneOf(d.gender, TEACHER_GENDERS, "gender"),
    languages,
    whatsapp,
    telegram: telegram.startsWith("@") ? telegram : `@${telegram}`,
    bio,
    socialLinks,
  });
}

export function fullNameOf(details: TeacherApplicationDetails): string {
  return `${details.firstName} ${details.lastName}`.trim();
}

// ---------------------------------------------------------------------------
// Private documents
// ---------------------------------------------------------------------------

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const CV_PUBLIC_ID = new RegExp(`^teacher-signup/cv/${UUID}\\.pdf$`);
export const VIDEO_PUBLIC_ID = new RegExp(`^teacher-signup/videos/${UUID}$`);

export type DocumentKind = "cv" | "intro_video";

/** A storage id the upload boundary issued (its proof is checked by the caller before this). */
export function parseDocumentId(kind: DocumentKind, value: unknown): string {
  const pattern = kind === "cv" ? CV_PUBLIC_ID : VIDEO_PUBLIC_ID;
  if (typeof value !== "string" || !pattern.test(value)) throw new DomainError("VALIDATION", kind === "cv" ? "Upload your CV (PDF)." : "The introduction video upload is not valid.");
  return value;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface TeacherApplicationRecord {
  readonly id: string;
  readonly applicantUid: string;
  readonly state: TeacherApplicationState;
  readonly details: TeacherApplicationDetails;
  readonly cvPublicId: string | null;
  readonly introVideoPublicId: string | null;
  readonly revision: number;
  readonly submittedAt: string | null;
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
  readonly decisionReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const APPLICATION_EVENT_ACTIONS = ["submit", "resubmit", "start_review", "schedule_interview", "request_changes", "approve", "reject"] as const;
export type ApplicationEventAction = (typeof APPLICATION_EVENT_ACTIONS)[number];

export interface TeacherApplicationEventRecord {
  readonly id: string;
  readonly applicationId: string;
  readonly action: ApplicationEventAction;
  readonly fromState: TeacherApplicationState | null;
  readonly toState: TeacherApplicationState;
  readonly reason: string | null;
  readonly actorUid: string;
  readonly actorRole: "admin" | "applicant";
  /** The application revision this event produced (unique per application). */
  readonly applicationRevision: number;
  readonly occurredAt: string;
}

// ---------------------------------------------------------------------------
// Account status mirror
// ---------------------------------------------------------------------------

export type TeacherAccountStatus = "pending" | "changes_requested" | "active" | "rejected" | "withdrawn" | "inactive";

export function accountStatusFor(state: TeacherApplicationState): TeacherAccountStatus {
  switch (state) {
    case "draft":
    case "submitted":
    case "in_review":
    case "interview":
      return "pending";
    case "changes_requested":
      return "changes_requested";
    case "approved":
      return "active";
    case "rejected":
      return "rejected";
    case "withdrawn":
      return "withdrawn";
  }
}

/** The profile write that must happen with an application transition: from exactly `from` to `to`. */
export interface AccountTransition {
  readonly uid: string;
  readonly from: TeacherAccountStatus;
  readonly to: TeacherAccountStatus;
  /** Approval also requires the applicant's email address to be verified. */
  readonly requireVerifiedEmail: boolean;
}

export interface PlannedApplicationChange {
  readonly record: TeacherApplicationRecord;
  readonly event: TeacherApplicationEventRecord;
  readonly account: AccountTransition;
  readonly audit: AuditEventInput;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export const ADMIN_COMMANDS = ["start_review", "schedule_interview", "request_changes", "approve", "reject"] as const;
export type AdminCommand = (typeof ADMIN_COMMANDS)[number];

export const ADMIN_COMMAND_TARGET: Readonly<Record<AdminCommand, TeacherApplicationState>> = {
  start_review: "in_review",
  schedule_interview: "interview",
  request_changes: "changes_requested",
  approve: "approved",
  reject: "rejected",
};

const DECISION_AUDIT_ACTION = {
  start_review: "teacher_application.start_review",
  schedule_interview: "teacher_application.schedule_interview",
  request_changes: "teacher_application.request_changes",
  approve: "teacher_application.approve",
  reject: "teacher_application.reject",
} as const satisfies Record<AdminCommand, string>;

/** Commands whose note to the applicant is required (it is shown to them). */
export const REASON_REQUIRED_COMMANDS: readonly AdminCommand[] = ["request_changes", "reject"];

export function adminCommandsFor(state: TeacherApplicationState): readonly AdminCommand[] {
  return ADMIN_COMMANDS.filter((command) => TEACHER_APPLICATION_MACHINE.transitions[state].includes(ADMIN_COMMAND_TARGET[command]));
}

/** Facts about the applicant's sign-in account, checked before approval. */
export interface ApplicantAccountFacts {
  /** The profile exists with role = 'teacher' and the status the application implies. */
  readonly profileMatches: boolean;
  readonly emailVerified: boolean;
  /** The Firebase account exists and is not disabled. */
  readonly signInAccountUsable: boolean;
}

function now(ctx: StructureContext): string {
  return toIso((ctx.clock ?? systemClock)());
}

function newId(ctx: StructureContext): string {
  return (ctx.newId ?? defaultIdGenerator)();
}

function eventFor(
  application: TeacherApplicationRecord,
  next: TeacherApplicationRecord,
  action: ApplicationEventAction,
  reason: string | null,
  actorRole: "admin" | "applicant",
  ctx: StructureContext,
): TeacherApplicationEventRecord {
  return Object.freeze({
    id: newId(ctx),
    applicationId: application.id,
    action,
    fromState: application.state,
    toState: next.state,
    reason,
    actorUid: ctx.actor.uid,
    actorRole,
    applicationRevision: next.revision,
    occurredAt: next.updatedAt,
  });
}

/** A new application, submitted with signup or from a teacher account's application page. */
export function planSubmitApplication(
  input: { readonly applicantUid: unknown; readonly details: unknown; readonly cvPublicId: unknown; readonly introVideoPublicId?: unknown },
  ctx: StructureContext,
): PlannedApplicationChange {
  const applicantUid = parseUid(input.applicantUid, "applicantUid");
  if (ctx.actor.uid !== applicantUid) throw new DomainError("VALIDATION", "An application is submitted by the applicant.");
  const at = now(ctx);
  const record: TeacherApplicationRecord = Object.freeze({
    id: newId(ctx),
    applicantUid,
    state: "submitted",
    details: parseApplicationDetails(input.details),
    cvPublicId: parseDocumentId("cv", input.cvPublicId),
    introVideoPublicId:
      input.introVideoPublicId === undefined || input.introVideoPublicId === null || input.introVideoPublicId === ""
        ? null
        : parseDocumentId("intro_video", input.introVideoPublicId),
    revision: 1,
    submittedAt: at,
    decidedAt: null,
    decidedBy: null,
    decisionReason: null,
    createdAt: at,
    updatedAt: at,
  });
  const event: TeacherApplicationEventRecord = Object.freeze({
    id: newId(ctx),
    applicationId: record.id,
    action: "submit",
    fromState: null,
    toState: "submitted",
    reason: null,
    actorUid: applicantUid,
    actorRole: "applicant",
    applicationRevision: 1,
    occurredAt: at,
  });
  return {
    record,
    event,
    account: { uid: applicantUid, from: "pending", to: "pending", requireVerifiedEmail: false },
    audit: {
      actor: ctx.actor,
      action: "teacher_application.submit",
      object: { kind: "teacher_application", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { applicantUid, hasIntroVideo: record.introVideoPublicId !== null },
    },
  };
}

/** The applicant revises after an administrator requested changes. */
export function planResubmit(
  application: TeacherApplicationRecord,
  input: { readonly details: unknown; readonly cvPublicId?: unknown; readonly introVideoPublicId?: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): PlannedApplicationChange {
  if (application.applicantUid !== ctx.actor.uid) throw new DomainError("NOT_FOUND", "Application not found.");
  assertRevision(application.revision, parseRequiredRevision(input.expectedRevision));
  if (application.state !== "changes_requested") {
    throw new DomainError("CONFLICT", "This application can be changed only after changes were requested.");
  }
  assertTransition(TEACHER_APPLICATION_MACHINE, application.state, "submitted");
  const at = now(ctx);
  const keep = (value: unknown) => value === undefined || value === null || value === "";
  const next: TeacherApplicationRecord = Object.freeze({
    ...application,
    state: "submitted",
    details: parseApplicationDetails(input.details),
    cvPublicId: keep(input.cvPublicId) ? application.cvPublicId : parseDocumentId("cv", input.cvPublicId),
    introVideoPublicId: keep(input.introVideoPublicId) ? application.introVideoPublicId : parseDocumentId("intro_video", input.introVideoPublicId),
    revision: application.revision + 1,
    submittedAt: at,
    updatedAt: at,
  });
  return {
    record: next,
    event: eventFor(application, next, "resubmit", null, "applicant", ctx),
    account: { uid: application.applicantUid, from: "changes_requested", to: "pending", requireVerifiedEmail: false },
    audit: {
      actor: ctx.actor,
      action: "teacher_application.resubmit",
      object: { kind: "teacher_application", id: application.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { revision: next.revision },
    },
  };
}

/** An administrator's decision. Approval requires a verified email and a usable sign-in account. */
export function planAdminDecision(
  application: TeacherApplicationRecord,
  input: { readonly command: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
  facts: ApplicantAccountFacts,
  ctx: StructureContext,
): PlannedApplicationChange {
  if (ctx.actor.role !== "admin") throw new DomainError("VALIDATION", "Only administrators decide on teacher applications.");
  const command = oneOf(input.command, ADMIN_COMMANDS, "command");
  assertRevision(application.revision, parseRequiredRevision(input.expectedRevision));
  const target = ADMIN_COMMAND_TARGET[command];
  assertTransition(TEACHER_APPLICATION_MACHINE, application.state, target);
  if (application.applicantUid === ctx.actor.uid) throw new DomainError("CONFLICT", "You cannot decide on your own application.");
  const reason = REASON_REQUIRED_COMMANDS.includes(command) ? requireReason(input.reason) : optionalReason(input.reason);

  if (!facts.profileMatches) {
    throw new DomainError("CONFLICT", "The applicant's account no longer matches this application. Reload and check the account.");
  }
  if (command === "approve") {
    if (!facts.signInAccountUsable) throw new DomainError("CONFLICT", "The applicant's sign-in account is missing or disabled.");
    if (!facts.emailVerified) throw new DomainError("CONFLICT", "The applicant has not verified their email address yet.");
  }

  const at = now(ctx);
  const decides = command === "approve" || command === "reject" || command === "request_changes";
  const next: TeacherApplicationRecord = Object.freeze({
    ...application,
    state: target,
    revision: application.revision + 1,
    decidedAt: decides ? at : application.decidedAt,
    decidedBy: decides ? ctx.actor.uid : application.decidedBy,
    decisionReason: decides ? reason : application.decisionReason,
    updatedAt: at,
  });
  return {
    record: next,
    event: eventFor(application, next, command, reason, "admin", ctx),
    account: {
      uid: application.applicantUid,
      from: accountStatusFor(application.state),
      to: accountStatusFor(target),
      requireVerifiedEmail: command === "approve",
    },
    audit: {
      actor: ctx.actor,
      action: DECISION_AUDIT_ACTION[command],
      object: { kind: "teacher_application", id: application.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { applicantUid: application.applicantUid, from: application.state, to: target, revision: next.revision },
    },
  };
}

// ---------------------------------------------------------------------------
// Teacher account (after approval)
// ---------------------------------------------------------------------------

export const TEACHER_ACCOUNT_COMMANDS = ["deactivate", "reactivate"] as const;
export type TeacherAccountCommand = (typeof TEACHER_ACCOUNT_COMMANDS)[number];

export interface PlannedAccountChange {
  readonly account: { readonly uid: string; readonly from: "active" | "inactive"; readonly to: "active" | "inactive" };
  readonly audit: AuditEventInput;
}

/** Deactivating ends teaching access at once (assignments stay, access does not); reactivating restores it. */
export function planTeacherAccountChange(
  teacher: { readonly uid: string; readonly role: string; readonly status: string | null },
  input: { readonly command: unknown; readonly reason?: unknown; readonly expectedStatus: unknown },
  ctx: StructureContext,
): PlannedAccountChange {
  if (ctx.actor.role !== "admin") throw new DomainError("VALIDATION", "Only administrators change teacher accounts.");
  const command = oneOf(input.command, TEACHER_ACCOUNT_COMMANDS, "command");
  if (teacher.role !== "teacher") throw new DomainError("NOT_FOUND", "Teacher not found.");
  if (teacher.uid === ctx.actor.uid) throw new DomainError("CONFLICT", "You cannot change your own account.");
  if (input.expectedStatus !== teacher.status) {
    throw new DomainError("CONFLICT", "This teacher account was changed by someone else. Reload and try again.");
  }
  // Reactivation only reverses a deactivation: an account that never became active needs an approved application.
  const from = command === "deactivate" ? "active" : "inactive";
  const to = command === "deactivate" ? "inactive" : "active";
  if (teacher.status !== from) {
    throw new DomainError("CONFLICT", command === "deactivate" ? "Only an active teacher can be deactivated." : "Only a deactivated teacher can be reactivated.");
  }
  const reason = command === "deactivate" ? requireReason(input.reason) : optionalReason(input.reason);
  return {
    account: { uid: teacher.uid, from, to },
    audit: {
      actor: ctx.actor,
      action: command === "deactivate" ? "teacher.deactivate" : "teacher.reactivate",
      object: { kind: "profile", id: teacher.uid },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { from, to },
    },
  };
}
