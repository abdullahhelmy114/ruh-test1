/**
 * Persistence for assessments, assignments, attempts, progress facts and
 * completions.
 *
 * JSON columns (content, responses, item results, criteria) are selected as
 * text and parsed exactly once, so stored JSON is never double-decoded.
 */
import type { ContentVersionState, AttemptState } from "../domain/states.ts";
import type { AssessmentMode } from "../domain/vocabulary.ts";
import { jsonParam, sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type {
  AssessmentRecord,
  AssessmentVersionRecord,
  AssignmentRecord,
  AssignmentState,
  AttemptKind,
  AttemptRecord,
} from "../assessment/delivery.ts";
import type { AssessmentContent } from "../assessment/content.ts";
import type { CompletionRecord } from "../learning/progress.ts";
import { iso, isoOrNull, num, numOrNull, str, strOrNull } from "./rows.ts";

function json(value: unknown): unknown {
  return value === null || value === undefined ? null : JSON.parse(String(value));
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export function selectAssessmentQuery(id: string): SqlQuery {
  return sqlQuery`SELECT id, course_id, mode, title, created_by, created_at FROM academy_assessments WHERE id = ${id}::uuid`;
}

export function listAssessmentsQuery(courseId: string | null): SqlQuery {
  return sqlQuery`SELECT id, course_id, mode, title, created_by, created_at FROM academy_assessments
    WHERE (${courseId}::uuid IS NULL OR course_id = ${courseId}::uuid)
    ORDER BY created_at DESC, id DESC LIMIT 500`;
}

export function insertAssessmentQuery(record: AssessmentRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_assessments (id, course_id, mode, title, created_by, created_at)
    VALUES (${record.id}::uuid, ${record.courseId}::uuid, ${record.mode}, ${record.title}, ${record.createdBy}, ${record.createdAt}::timestamptz)
    RETURNING id`;
}

export function mapAssessmentRow(row: SqlRow): AssessmentRecord {
  return Object.freeze({
    id: str(row.id),
    courseId: str(row.course_id),
    mode: str(row.mode) as AssessmentMode,
    title: str(row.title),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
  });
}

// ---------------------------------------------------------------------------
// Assessment versions
// ---------------------------------------------------------------------------

const VERSION_META = `id, assessment_id, version_number, based_on_version_id, state, revision, created_by, created_at, updated_at,
  submitted_at, reviewed_by, reviewed_at, published_by, published_at, superseded_at, archived_at`;

export function selectAssessmentVersionQuery(id: string): SqlQuery {
  return { text: `SELECT ${VERSION_META}, content::text AS content FROM academy_assessment_versions WHERE id = $1::uuid`, values: [id] };
}

export function listAssessmentVersionsQuery(assessmentId: string): SqlQuery {
  return {
    text: `SELECT ${VERSION_META} FROM academy_assessment_versions WHERE assessment_id = $1::uuid ORDER BY version_number DESC`,
    values: [assessmentId],
  };
}

export function insertAssessmentVersionQuery(version: AssessmentVersionRecord, content: AssessmentContent): SqlQuery {
  return sqlQuery`INSERT INTO academy_assessment_versions
      (id, assessment_id, version_number, based_on_version_id, state, revision, content, created_by, created_at, updated_at)
    VALUES (${version.id}::uuid, ${version.parentId}::uuid, ${version.versionNumber}, ${version.basedOnVersionId}::uuid, ${version.state},
      ${version.revision}, ${jsonParam(content)}::jsonb, ${version.createdBy}, ${version.createdAt}::timestamptz, ${version.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateAssessmentVersionStateQuery(
  version: AssessmentVersionRecord,
  expected: { readonly revision: number; readonly state: ContentVersionState },
): SqlQuery {
  return sqlQuery`UPDATE academy_assessment_versions SET
      state = ${version.state}, revision = ${version.revision}, updated_at = ${version.updatedAt}::timestamptz,
      submitted_at = ${version.submittedAt}::timestamptz, reviewed_by = ${version.reviewedBy}, reviewed_at = ${version.reviewedAt}::timestamptz,
      published_by = ${version.publishedBy}, published_at = ${version.publishedAt}::timestamptz,
      superseded_at = ${version.supersededAt}::timestamptz, archived_at = ${version.archivedAt}::timestamptz
    WHERE id = ${version.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

export function updateAssessmentVersionContentQuery(version: AssessmentVersionRecord, content: AssessmentContent, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_assessment_versions SET
      content = ${jsonParam(content)}::jsonb, revision = ${version.revision}, updated_at = ${version.updatedAt}::timestamptz
    WHERE id = ${version.id}::uuid AND revision = ${expectedRevision} AND state IN ('draft', 'changes_requested')
    RETURNING id`;
}

export function mapAssessmentVersionRow(row: SqlRow): AssessmentVersionRecord {
  return Object.freeze({
    id: str(row.id),
    versionKind: "assessment_version" as const,
    parentKind: "assessment" as const,
    parentId: str(row.assessment_id),
    versionNumber: num(row.version_number),
    basedOnVersionId: strOrNull(row.based_on_version_id),
    state: str(row.state) as ContentVersionState,
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    submittedAt: isoOrNull(row.submitted_at),
    reviewedBy: strOrNull(row.reviewed_by),
    reviewedAt: isoOrNull(row.reviewed_at),
    publishedBy: strOrNull(row.published_by),
    publishedAt: isoOrNull(row.published_at),
    supersededAt: isoOrNull(row.superseded_at),
    archivedAt: isoOrNull(row.archived_at),
  });
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

const ASSIGNMENT_COLUMNS = `id, class_group_id, course_id, assessment_id, assessment_version_id, mode, title, opens_at, due_at, state,
  cancel_reason, revision, created_by, created_at, updated_by, updated_at`;

export function selectAssignmentQuery(id: string): SqlQuery {
  return { text: `SELECT ${ASSIGNMENT_COLUMNS} FROM academy_assessment_assignments WHERE id = $1::uuid`, values: [id] };
}

export function listClassGroupAssignmentsQuery(classGroupId: string): SqlQuery {
  return {
    text: `SELECT ${ASSIGNMENT_COLUMNS} FROM academy_assessment_assignments WHERE class_group_id = $1::uuid ORDER BY opens_at ASC, id ASC LIMIT 1000`,
    values: [classGroupId],
  };
}

/** Assigns only while the class group is live and the version is still published. */
export function insertAssignmentQuery(record: AssignmentRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_assessment_assignments
      (id, class_group_id, course_id, assessment_id, assessment_version_id, mode, title, opens_at, due_at, state, cancel_reason,
       revision, created_by, created_at, updated_by, updated_at)
    SELECT ${record.id}::uuid, cg.id, cg.course_id, ${record.assessmentId}::uuid, v.id, ${record.mode}::text, ${record.title}::text,
      ${record.opensAt}::timestamptz, ${record.dueAt}::timestamptz, ${record.state}::text, ${record.cancelReason}::text,
      ${record.revision}::integer, ${record.createdBy}::text, ${record.createdAt}::timestamptz, ${record.updatedBy}::text,
      ${record.updatedAt}::timestamptz
    FROM academy_class_groups cg
    JOIN academy_assessment_versions v ON v.id = ${record.assessmentVersionId}::uuid AND v.state = 'published'
    WHERE cg.id = ${record.classGroupId}::uuid AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
    RETURNING id`;
}

export function updateAssignmentQuery(record: AssignmentRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_assessment_assignments SET
      state = ${record.state}, cancel_reason = ${record.cancelReason}, revision = ${record.revision},
      updated_by = ${record.updatedBy}, updated_at = ${record.updatedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
}

export function mapAssignmentRow(row: SqlRow): AssignmentRecord {
  return Object.freeze({
    id: str(row.id),
    classGroupId: str(row.class_group_id),
    courseId: str(row.course_id),
    assessmentId: str(row.assessment_id),
    assessmentVersionId: str(row.assessment_version_id),
    mode: str(row.mode) as AssessmentMode,
    title: str(row.title),
    opensAt: iso(row.opens_at),
    dueAt: isoOrNull(row.due_at),
    state: str(row.state) as AssignmentState,
    cancelReason: strOrNull(row.cancel_reason),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
  });
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

const ATTEMPT_COLUMNS = `id, assignment_id, class_group_id, learner_uid, attempt_number, kind, revision_of_attempt_id, state,
  responses::text AS responses, item_results::text AS item_results, earned_points, max_points, score_percent, is_late, started_at,
  submitted_at, graded_by, graded_at, feedback, released_at, revision, updated_at`;

export function selectAttemptQuery(id: string): SqlQuery {
  return { text: `SELECT ${ATTEMPT_COLUMNS} FROM academy_assessment_attempts WHERE id = $1::uuid`, values: [id] };
}

export function selectLearnerAttemptsQuery(assignmentId: string, learnerUid: string): SqlQuery {
  return {
    text: `SELECT ${ATTEMPT_COLUMNS} FROM academy_assessment_attempts WHERE assignment_id = $1::uuid AND learner_uid = $2 ORDER BY attempt_number`,
    values: [assignmentId, learnerUid],
  };
}

export function selectLearnerClassGroupAttemptsQuery(classGroupId: string, learnerUid: string): SqlQuery {
  return {
    text: `SELECT ${ATTEMPT_COLUMNS} FROM academy_assessment_attempts WHERE class_group_id = $1::uuid AND learner_uid = $2 ORDER BY assignment_id, attempt_number`,
    values: [classGroupId, learnerUid],
  };
}

/** Work waiting for a teacher: submissions needing review and graded results not yet released. */
export function selectReviewQueueQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT a.id, a.assignment_id, a.learner_uid, a.attempt_number, a.kind, a.state, a.is_late, a.submitted_at,
      a.score_percent, a.released_at, x.title AS assignment_title, x.mode
    FROM academy_assessment_attempts a
    JOIN academy_assessment_assignments x ON x.id = a.assignment_id
    WHERE a.class_group_id = ${classGroupId}::uuid
      AND (a.state = 'needs_review' OR (a.state = 'graded' AND a.released_at IS NULL))
    ORDER BY a.submitted_at ASC
    LIMIT 1000`;
}

export function selectAssignmentAttemptCountsQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT assignment_id, state, count(*) AS n FROM academy_assessment_attempts
    WHERE class_group_id = ${classGroupId}::uuid GROUP BY assignment_id, state`;
}

/** Starts an attempt only while its assignment is active. */
export function insertAttemptQuery(record: AttemptRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_assessment_attempts
      (id, assignment_id, class_group_id, learner_uid, attempt_number, kind, revision_of_attempt_id, state, responses, item_results,
       earned_points, max_points, score_percent, is_late, started_at, submitted_at, graded_by, graded_at, feedback, released_at,
       revision, updated_at)
    SELECT ${record.id}::uuid, x.id, x.class_group_id, ${record.learnerUid}::text, ${record.attemptNumber}::integer, ${record.kind}::text,
      ${record.revisionOfAttemptId}::uuid, ${record.state}::text, ${jsonParam(record.responses)}::jsonb, NULL::jsonb,
      NULL::numeric, ${record.maxPoints}::numeric, NULL::integer, ${record.isLate}::boolean, ${record.startedAt}::timestamptz,
      NULL::timestamptz, NULL::text, NULL::timestamptz, NULL::text, NULL::timestamptz, ${record.revision}::integer, ${record.updatedAt}::timestamptz
    FROM academy_assessment_assignments x
    WHERE x.id = ${record.assignmentId}::uuid AND x.state = 'active' AND x.class_group_id = ${record.classGroupId}::uuid
    RETURNING id`;
}

export function updateAttemptQuery(record: AttemptRecord, expected: { readonly revision: number; readonly state: AttemptState }): SqlQuery {
  return sqlQuery`UPDATE academy_assessment_attempts SET
      state = ${record.state}, responses = ${jsonParam(record.responses)}::jsonb, item_results = ${record.itemResults === null ? null : jsonParam(record.itemResults)}::jsonb,
      earned_points = ${record.earnedPoints}::numeric, max_points = ${record.maxPoints}::numeric, score_percent = ${record.scorePercent}::integer,
      is_late = ${record.isLate}, submitted_at = ${record.submittedAt}::timestamptz, graded_by = ${record.gradedBy},
      graded_at = ${record.gradedAt}::timestamptz, feedback = ${record.feedback}, released_at = ${record.releasedAt}::timestamptz,
      revision = ${record.revision}, updated_at = ${record.updatedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

export function mapAttemptRow(row: SqlRow): AttemptRecord {
  return Object.freeze({
    id: str(row.id),
    assignmentId: str(row.assignment_id),
    classGroupId: str(row.class_group_id),
    learnerUid: str(row.learner_uid),
    attemptNumber: num(row.attempt_number),
    kind: str(row.kind) as AttemptKind,
    revisionOfAttemptId: strOrNull(row.revision_of_attempt_id),
    state: str(row.state) as AttemptState,
    responses: (json(row.responses) ?? {}) as AttemptRecord["responses"],
    itemResults: json(row.item_results) as AttemptRecord["itemResults"],
    earnedPoints: numOrNull(row.earned_points),
    maxPoints: num(row.max_points),
    scorePercent: numOrNull(row.score_percent),
    isLate: row.is_late === true,
    startedAt: iso(row.started_at),
    submittedAt: isoOrNull(row.submitted_at),
    gradedBy: strOrNull(row.graded_by),
    gradedAt: isoOrNull(row.graded_at),
    feedback: strOrNull(row.feedback),
    releasedAt: isoOrNull(row.released_at),
    revision: num(row.revision),
    updatedAt: iso(row.updated_at),
  });
}

// ---------------------------------------------------------------------------
// Progress facts
// ---------------------------------------------------------------------------

/** Lessons taught in completed sessions that the learner attended. */
export function selectCompletedAttendedLessonsQuery(classGroupId: string, learnerUid: string): SqlQuery {
  return sqlQuery`SELECT DISTINCT s.lesson_id FROM academy_sessions s
    JOIN academy_attendance_records a ON a.session_id = s.id AND a.learner_uid = ${learnerUid} AND a.counts_as_attended
    WHERE s.class_group_id = ${classGroupId}::uuid AND s.state = 'completed'`;
}

export function selectLearnerAttendanceFlagsQuery(classGroupId: string, learnerUid: string): SqlQuery {
  return sqlQuery`SELECT counts_as_attended FROM academy_attendance_records
    WHERE class_group_id = ${classGroupId}::uuid AND learner_uid = ${learnerUid}`;
}

export function selectLatestEnrollmentQuery(classGroupId: string, learnerUid: string): SqlQuery {
  return sqlQuery`SELECT id, class_group_id, course_id, learner_uid, state, source, state_reason, revision, created_by, created_at,
      updated_by, updated_at, activated_at, ended_at
    FROM academy_enrollments WHERE class_group_id = ${classGroupId}::uuid AND learner_uid = ${learnerUid}
    ORDER BY created_at DESC LIMIT 1`;
}

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

const COMPLETION_COLUMNS = `id, enrollment_id, class_group_id, course_id, learner_uid, completed_at, decided_by, met_all_criteria,
  criteria_snapshot::text AS criteria_snapshot, override_reason, revoked_at, revoked_by, revoke_reason`;

export function selectCompletionQuery(id: string): SqlQuery {
  return { text: `SELECT ${COMPLETION_COLUMNS} FROM academy_completions WHERE id = $1::uuid`, values: [id] };
}

export function selectCompletionByEnrollmentQuery(enrollmentId: string): SqlQuery {
  return { text: `SELECT ${COMPLETION_COLUMNS} FROM academy_completions WHERE enrollment_id = $1::uuid`, values: [enrollmentId] };
}

export function insertCompletionQuery(record: CompletionRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_completions
      (id, enrollment_id, class_group_id, course_id, learner_uid, completed_at, decided_by, met_all_criteria, criteria_snapshot, override_reason)
    VALUES (${record.id}::uuid, ${record.enrollmentId}::uuid, ${record.classGroupId}::uuid, ${record.courseId}::uuid, ${record.learnerUid},
      ${record.completedAt}::timestamptz, ${record.decidedBy}, ${record.metAllCriteria}, ${jsonParam(record.criteriaSnapshot)}::jsonb,
      ${record.overrideReason})
    RETURNING id`;
}

export function revokeCompletionQuery(record: CompletionRecord): SqlQuery {
  return sqlQuery`UPDATE academy_completions SET
      revoked_at = ${record.revokedAt}::timestamptz, revoked_by = ${record.revokedBy}, revoke_reason = ${record.revokeReason}
    WHERE id = ${record.id}::uuid AND revoked_at IS NULL
    RETURNING id`;
}

export function mapCompletionRow(row: SqlRow): CompletionRecord {
  return Object.freeze({
    id: str(row.id),
    enrollmentId: str(row.enrollment_id),
    classGroupId: str(row.class_group_id),
    courseId: str(row.course_id),
    learnerUid: str(row.learner_uid),
    completedAt: iso(row.completed_at),
    decidedBy: str(row.decided_by),
    metAllCriteria: row.met_all_criteria === true,
    criteriaSnapshot: json(row.criteria_snapshot) as CompletionRecord["criteriaSnapshot"],
    overrideReason: strOrNull(row.override_reason),
    revokedAt: isoOrNull(row.revoked_at),
    revokedBy: strOrNull(row.revoked_by),
    revokeReason: strOrNull(row.revoke_reason),
  });
}
