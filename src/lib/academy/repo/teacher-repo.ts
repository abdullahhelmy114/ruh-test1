/**
 * Persistence for teacher applications, their history, and the teacher
 * account status mirror in `profiles`.
 *
 * This is the one academy repository that writes to `profiles`, and only two
 * columns of teacher accounts: `status` (every write is conditional on the
 * account being a teacher with exactly the expected current status, so a
 * stale or concurrent decision matches zero rows and aborts its transaction)
 * and the public display fields an applicant submits (name, biography and
 * contact details used by existing teacher pages).
 */
import { DomainError } from "../domain/errors.ts";
import type { TeacherApplicationState } from "../domain/states.ts";
import { jsonParam, sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import {
  fullNameOf,
  parseApplicationDetails,
  type AccountTransition,
  type ApplicationEventAction,
  type TeacherApplicationDetails,
  type TeacherApplicationEventRecord,
  type TeacherApplicationRecord,
} from "../teachers/applications.ts";
import { iso, isoOrNull, num, str, strOrNull } from "./rows.ts";

const MAX_ROWS = 500;

const APPLICATION_COLUMNS = `a.id, a.applicant_uid, a.state, a.details, a.cv_public_id, a.intro_video_public_id, a.revision,
  a.submitted_at, a.decided_at, a.decided_by, a.decision_reason, a.created_at, a.updated_at`;

export function selectApplicationQuery(id: string): SqlQuery {
  return { text: `SELECT ${APPLICATION_COLUMNS} FROM academy_teacher_applications a WHERE a.id = $1::uuid`, values: [id] };
}

/** The applicant's current application: the live one if any, otherwise the most recent. */
export function selectApplicationForApplicantQuery(uid: string): SqlQuery {
  return {
    text: `SELECT ${APPLICATION_COLUMNS} FROM academy_teacher_applications a WHERE a.applicant_uid = $1
      ORDER BY (a.state NOT IN ('rejected', 'withdrawn')) DESC, a.created_at DESC, a.id DESC LIMIT 1`,
    values: [uid],
  };
}

/** Applications with the applicant's account facts (email and its verification, current status). */
export function listApplicationsQuery(filter: { readonly state: TeacherApplicationState | null }): SqlQuery {
  return {
    text: `SELECT ${APPLICATION_COLUMNS}, p.email, COALESCE(p.email_verified, false) AS email_verified, p.status AS account_status
      FROM academy_teacher_applications a
      LEFT JOIN profiles p ON p.firebase_uid = a.applicant_uid
      WHERE ($1::text IS NULL OR a.state = $1::text)
      ORDER BY a.submitted_at ASC NULLS LAST, a.id ASC
      LIMIT ${MAX_ROWS}`,
    values: [filter.state],
  };
}

export function lockApplicationQuery(id: string): SqlQuery {
  return sqlQuery`SELECT id FROM academy_teacher_applications WHERE id = ${id}::uuid FOR UPDATE`;
}

export function insertApplicationQuery(r: TeacherApplicationRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_teacher_applications
      (id, applicant_uid, state, details, cv_public_id, intro_video_public_id, revision, submitted_at, decided_at, decided_by,
       decision_reason, created_at, updated_at)
    VALUES (${r.id}::uuid, ${r.applicantUid}, ${r.state}, ${jsonParam(r.details)}::jsonb, ${r.cvPublicId}, ${r.introVideoPublicId},
      ${r.revision}, ${r.submittedAt}::timestamptz, ${r.decidedAt}::timestamptz, ${r.decidedBy}, ${r.decisionReason},
      ${r.createdAt}::timestamptz, ${r.updatedAt}::timestamptz)
    RETURNING id`;
}

/** Applies a transition only if the application is still at the revision and state the decision was made on. */
export function updateApplicationQuery(r: TeacherApplicationRecord, expected: { readonly revision: number; readonly state: TeacherApplicationState }): SqlQuery {
  return sqlQuery`UPDATE academy_teacher_applications SET
      state = ${r.state}, details = ${jsonParam(r.details)}::jsonb, cv_public_id = ${r.cvPublicId}, intro_video_public_id = ${r.introVideoPublicId},
      revision = ${r.revision}, submitted_at = ${r.submittedAt}::timestamptz, decided_at = ${r.decidedAt}::timestamptz,
      decided_by = ${r.decidedBy}, decision_reason = ${r.decisionReason}, updated_at = ${r.updatedAt}::timestamptz
    WHERE id = ${r.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

export function insertApplicationEventQuery(e: TeacherApplicationEventRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_teacher_application_events
      (id, application_id, action, from_state, to_state, reason, actor_uid, actor_role, application_revision, occurred_at)
    VALUES (${e.id}::uuid, ${e.applicationId}::uuid, ${e.action}, ${e.fromState}, ${e.toState}, ${e.reason}, ${e.actorUid},
      ${e.actorRole}, ${e.applicationRevision}, ${e.occurredAt}::timestamptz)
    RETURNING id`;
}

export function listApplicationEventsQuery(applicationId: string): SqlQuery {
  return sqlQuery`SELECT ev.id, ev.application_id, ev.action, ev.from_state, ev.to_state, ev.reason, ev.actor_uid, ev.actor_role,
      ev.application_revision, ev.occurred_at, p.full_name AS actor_name
    FROM academy_teacher_application_events ev
    LEFT JOIN profiles p ON p.firebase_uid = ev.actor_uid
    WHERE ev.application_id = ${applicationId}::uuid
    ORDER BY ev.application_revision ASC`;
}

/**
 * Moves the teacher account's status with an application transition. Matches
 * only a teacher account at exactly the expected status (a legacy account
 * without a status counts as pending when it first applies), and for approval
 * only one whose email address is verified.
 */
export function transitionAccountQuery(account: AccountTransition, options: { readonly acceptMissingStatus?: boolean } = {}): SqlQuery {
  return sqlQuery`UPDATE profiles SET status = ${account.to}
    WHERE firebase_uid = ${account.uid} AND role = 'teacher'
      AND (status = ${account.from} OR (${options.acceptMissingStatus === true}::boolean AND status IS NULL))
      AND (NOT ${account.requireVerifiedEmail}::boolean OR email_verified = TRUE)
    RETURNING firebase_uid`;
}

/** Deactivation and reactivation of an approved teacher account. */
export function setTeacherAccountStatusQuery(account: { readonly uid: string; readonly from: string; readonly to: string }): SqlQuery {
  return sqlQuery`UPDATE profiles SET status = ${account.to}
    WHERE firebase_uid = ${account.uid} AND role = 'teacher' AND status = ${account.from}
    RETURNING firebase_uid`;
}

/** Keeps the display fields existing teacher pages read in step with the submitted application. */
export function updateTeacherDisplayFieldsQuery(uid: string, details: TeacherApplicationDetails): SqlQuery {
  return sqlQuery`UPDATE profiles SET
      full_name = ${fullNameOf(details)}, bio = ${details.bio}, whatsapp = ${details.whatsapp}, telegram = ${details.telegram},
      nationality = ${details.nationality}, country_of_residence = ${details.countryOfResidence}, gender = ${details.gender},
      languages = ${jsonParam(details.languages)}, social_links = ${jsonParam(details.socialLinks)}
    WHERE firebase_uid = ${uid} AND role = 'teacher'
    RETURNING firebase_uid`;
}

// ---------------------------------------------------------------------------
// Teacher accounts
// ---------------------------------------------------------------------------

export function selectTeacherAccountQuery(uid: string): SqlQuery {
  return sqlQuery`SELECT firebase_uid, role, status, email, COALESCE(email_verified, false) AS email_verified, full_name
    FROM profiles WHERE firebase_uid = ${uid}`;
}

/** Teacher accounts with their status, current assignments and latest application. */
export function listTeacherAccountsQuery(filter: { readonly activeOnly: boolean }): SqlQuery {
  return {
    text: `SELECT p.firebase_uid, p.full_name, p.email, p.status,
        (SELECT count(*) FROM academy_class_group_teachers t JOIN academy_class_groups cg ON cg.id = t.class_group_id
          WHERE t.teacher_uid = p.firebase_uid AND t.unassigned_at IS NULL AND cg.deleted_at IS NULL
            AND cg.status IN ('planned', 'active')) AS open_assignments,
        la.id AS application_id, la.state AS application_state
      FROM profiles p
      LEFT JOIN LATERAL (
        SELECT a.id, a.state FROM academy_teacher_applications a WHERE a.applicant_uid = p.firebase_uid
        ORDER BY a.created_at DESC, a.id DESC LIMIT 1
      ) la ON true
      WHERE p.role = 'teacher' AND (NOT $1::boolean OR p.status = 'active')
      ORDER BY p.full_name NULLS LAST, p.firebase_uid
      LIMIT ${MAX_ROWS}`,
    values: [filter.activeOnly],
  };
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

function detailsOf(value: unknown): TeacherApplicationDetails {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  try {
    return parseApplicationDetails(parsed);
  } catch (error) {
    // Stored details were validated on the way in; anything else is data corruption, not a user error.
    if (error instanceof DomainError) throw new Error("Stored teacher application details are not valid.");
    throw error;
  }
}

export function mapApplicationRow(row: SqlRow): TeacherApplicationRecord {
  return Object.freeze({
    id: str(row.id),
    applicantUid: str(row.applicant_uid),
    state: str(row.state) as TeacherApplicationState,
    details: detailsOf(row.details),
    cvPublicId: strOrNull(row.cv_public_id),
    introVideoPublicId: strOrNull(row.intro_video_public_id),
    revision: num(row.revision),
    submittedAt: isoOrNull(row.submitted_at),
    decidedAt: isoOrNull(row.decided_at),
    decidedBy: strOrNull(row.decided_by),
    decisionReason: strOrNull(row.decision_reason),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

export function mapApplicationEventRow(row: SqlRow): TeacherApplicationEventRecord & { readonly actorName: string | null } {
  return Object.freeze({
    id: str(row.id),
    applicationId: str(row.application_id),
    action: str(row.action) as ApplicationEventAction,
    fromState: strOrNull(row.from_state) as TeacherApplicationState | null,
    toState: str(row.to_state) as TeacherApplicationState,
    reason: strOrNull(row.reason),
    actorUid: str(row.actor_uid),
    actorRole: str(row.actor_role) as "admin" | "applicant",
    applicationRevision: num(row.application_revision),
    occurredAt: iso(row.occurred_at),
    actorName: strOrNull(row.actor_name),
  });
}
