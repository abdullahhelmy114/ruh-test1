/**
 * Persistence for recordings and certificates.
 */
import type { RecordingState } from "../domain/states.ts";
import { sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { CertificateRecord } from "../certificates/certificates.ts";
import type { RecordingRecord } from "../recordings/recordings.ts";
import { iso, isoOrNull, num, numOrNull, str, strOrNull } from "./rows.ts";

// ---------------------------------------------------------------------------
// Recordings
// ---------------------------------------------------------------------------

const RECORDING_COLUMNS = `id, session_id, class_group_id, course_id, title, media_url, duration_seconds, state, state_reason, published_at,
  revision, created_by, created_at, updated_by, updated_at`;

export function selectRecordingQuery(id: string): SqlQuery {
  return { text: `SELECT ${RECORDING_COLUMNS} FROM academy_recordings WHERE id = $1::uuid`, values: [id] };
}

export function listClassGroupRecordingsQuery(classGroupId: string): SqlQuery {
  return {
    text: `SELECT ${RECORDING_COLUMNS} FROM academy_recordings WHERE class_group_id = $1::uuid AND state <> 'archived'
      ORDER BY created_at DESC, id DESC LIMIT 500`,
    values: [classGroupId],
  };
}

/** Adds a recording only to a session that has taken place, in its own class group. */
export function insertRecordingQuery(record: RecordingRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_recordings
      (id, session_id, class_group_id, course_id, title, media_url, duration_seconds, state, state_reason, published_at,
       revision, created_by, created_at, updated_by, updated_at)
    SELECT ${record.id}::uuid, s.id, s.class_group_id, cg.course_id, ${record.title}::text, ${record.mediaUrl}::text,
      ${record.durationSeconds}::integer, ${record.state}::text, ${record.stateReason}::text, ${record.publishedAt}::timestamptz,
      ${record.revision}::integer, ${record.createdBy}::text, ${record.createdAt}::timestamptz, ${record.updatedBy}::text,
      ${record.updatedAt}::timestamptz
    FROM academy_sessions s
    JOIN academy_class_groups cg ON cg.id = s.class_group_id
    WHERE s.id = ${record.sessionId}::uuid AND s.state IN ('live', 'completed') AND cg.course_id = ${record.courseId}::uuid
    RETURNING id`;
}

export function updateRecordingQuery(record: RecordingRecord, expected: { readonly revision: number; readonly state: RecordingState }): SqlQuery {
  return sqlQuery`UPDATE academy_recordings SET
      state = ${record.state}, state_reason = ${record.stateReason}, published_at = ${record.publishedAt}::timestamptz,
      revision = ${record.revision}, updated_by = ${record.updatedBy}, updated_at = ${record.updatedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

export function mapRecordingRow(row: SqlRow): RecordingRecord {
  return Object.freeze({
    id: str(row.id),
    sessionId: str(row.session_id),
    classGroupId: str(row.class_group_id),
    courseId: str(row.course_id),
    title: str(row.title),
    mediaUrl: str(row.media_url),
    durationSeconds: numOrNull(row.duration_seconds),
    state: str(row.state) as RecordingState,
    stateReason: strOrNull(row.state_reason),
    publishedAt: isoOrNull(row.published_at),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
  });
}

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

const CERTIFICATE_COLUMNS = `id, code, enrollment_id, completion_id, learner_uid, course_id, class_group_id, learner_name_snapshot,
  course_title_snapshot, issued_at, issued_by, state, revoked_at, revoked_by, revoke_reason`;

export function selectCertificateByCodeQuery(code: string): SqlQuery {
  return { text: `SELECT ${CERTIFICATE_COLUMNS} FROM academy_certificates WHERE code = $1`, values: [code] };
}

export function selectCertificateQuery(id: string): SqlQuery {
  return { text: `SELECT ${CERTIFICATE_COLUMNS} FROM academy_certificates WHERE id = $1::uuid`, values: [id] };
}

export function listEnrollmentCertificatesQuery(enrollmentId: string): SqlQuery {
  return { text: `SELECT ${CERTIFICATE_COLUMNS} FROM academy_certificates WHERE enrollment_id = $1::uuid ORDER BY issued_at DESC`, values: [enrollmentId] };
}

export function listLearnerCertificatesQuery(learnerUid: string): SqlQuery {
  return {
    text: `SELECT ${CERTIFICATE_COLUMNS} FROM academy_certificates WHERE learner_uid = $1 ORDER BY issued_at DESC LIMIT 200`,
    values: [learnerUid],
  };
}

export function countIssuedCertificatesForCompletionQuery(completionId: string): SqlQuery {
  return sqlQuery`SELECT count(*) AS n FROM academy_certificates WHERE completion_id = ${completionId}::uuid AND state = 'issued'`;
}

export function insertCertificateQuery(record: CertificateRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_certificates
      (id, code, enrollment_id, completion_id, learner_uid, course_id, class_group_id, learner_name_snapshot, course_title_snapshot,
       issued_at, issued_by, state)
    VALUES (${record.id}::uuid, ${record.code}, ${record.enrollmentId}::uuid, ${record.completionId}::uuid, ${record.learnerUid},
      ${record.courseId}::uuid, ${record.classGroupId}::uuid, ${record.learnerNameSnapshot}, ${record.courseTitleSnapshot},
      ${record.issuedAt}::timestamptz, ${record.issuedBy}, ${record.state})
    RETURNING id`;
}

export function revokeCertificateQuery(record: CertificateRecord): SqlQuery {
  return sqlQuery`UPDATE academy_certificates SET
      state = ${record.state}, revoked_at = ${record.revokedAt}::timestamptz, revoked_by = ${record.revokedBy}, revoke_reason = ${record.revokeReason}
    WHERE id = ${record.id}::uuid AND state = 'issued'
    RETURNING id`;
}

export function mapCertificateRow(row: SqlRow): CertificateRecord {
  return Object.freeze({
    id: str(row.id),
    code: str(row.code),
    enrollmentId: str(row.enrollment_id),
    completionId: strOrNull(row.completion_id),
    learnerUid: str(row.learner_uid),
    courseId: str(row.course_id),
    classGroupId: str(row.class_group_id),
    learnerNameSnapshot: str(row.learner_name_snapshot),
    courseTitleSnapshot: str(row.course_title_snapshot),
    issuedAt: iso(row.issued_at),
    issuedBy: str(row.issued_by),
    state: str(row.state) as CertificateRecord["state"],
    revokedAt: isoOrNull(row.revoked_at),
    revokedBy: strOrNull(row.revoked_by),
    revokeReason: strOrNull(row.revoke_reason),
  });
}

/** The display name on the learner's profile (read-only access to the existing table). */
export function selectProfileNameQuery(uid: string): SqlQuery {
  return sqlQuery`SELECT full_name FROM profiles WHERE firebase_uid = ${uid}`;
}

/** Best released score on active final assessments of the class group. */
export function selectBestFinalScoreQuery(classGroupId: string, learnerUid: string): SqlQuery {
  return sqlQuery`SELECT max(a.score_percent) AS best FROM academy_assessment_attempts a
    JOIN academy_assessment_assignments x ON x.id = a.assignment_id
    WHERE a.class_group_id = ${classGroupId}::uuid AND a.learner_uid = ${learnerUid}
      AND x.mode = 'final' AND x.state = 'active'
      AND a.released_at IS NOT NULL AND a.state IN ('graded', 'returned') AND a.score_percent IS NOT NULL`;
}
