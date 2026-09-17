/**
 * Persistence for class groups, teacher assignments, sessions and enrollments.
 *
 * Inserts that depend on the class group's current state re-check that state
 * inside the INSERT ... SELECT, so a class group cancelled, deleted, filled
 * or re-pinned by someone else in the meantime makes the write match zero
 * rows (and the guarded transaction abort) instead of slipping through.
 */
import type { ClassGroupState, EnrollmentState, SessionState } from "../domain/states.ts";
import { sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type {
  ClassGroupRecord,
  EnrollmentRecord,
  EnrollmentSource,
  SessionRecord,
  TeacherAssignmentRecord,
} from "../structure/delivery.ts";
import { iso, isoOrNull, num, numOrNull, str, strOrNull } from "./rows.ts";

const MAX_ROWS = 500;

// ---------------------------------------------------------------------------
// Class groups
// ---------------------------------------------------------------------------

const CLASS_GROUP_COLUMNS = `id, course_id, curriculum_id, curriculum_version_id, name, status, status_reason, capacity,
  starts_on::text AS starts_on, ends_on::text AS ends_on, revision, created_by, created_at, updated_by, updated_at,
  deleted_at, deleted_by, deletion_reason`;

export function selectClassGroupQuery(id: string): SqlQuery {
  return { text: `SELECT ${CLASS_GROUP_COLUMNS} FROM academy_class_groups WHERE id = $1::uuid`, values: [id] };
}

export function listClassGroupsQuery(options: { readonly courseId?: string | null; readonly includeDeleted?: boolean }): SqlQuery {
  return {
    text: `SELECT ${CLASS_GROUP_COLUMNS} FROM academy_class_groups
      WHERE ($1::boolean OR deleted_at IS NULL) AND ($2::uuid IS NULL OR course_id = $2::uuid)
      ORDER BY created_at DESC, id DESC LIMIT ${MAX_ROWS}`,
    values: [options.includeDeleted === true, options.courseId ?? null],
  };
}

export function insertClassGroupQuery(record: ClassGroupRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_class_groups
      (id, course_id, curriculum_id, curriculum_version_id, name, status, status_reason, capacity, starts_on, ends_on,
       revision, created_by, created_at, updated_by, updated_at)
    SELECT ${record.id}::uuid, ${record.courseId}::uuid, ${record.curriculumId}::uuid, ${record.curriculumVersionId}::uuid,
      ${record.name}::text, ${record.status}::text, ${record.statusReason}::text, ${record.capacity}::integer,
      ${record.startsOn}::date, ${record.endsOn}::date, ${record.revision}::integer, ${record.createdBy}::text,
      ${record.createdAt}::timestamptz, ${record.updatedBy}::text, ${record.updatedAt}::timestamptz
    WHERE EXISTS (
      SELECT 1 FROM academy_curriculum_versions v
      WHERE v.id = ${record.curriculumVersionId}::uuid AND v.state = 'published')
    RETURNING id`;
}

export function updateClassGroupQuery(record: ClassGroupRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_class_groups SET
      curriculum_version_id = ${record.curriculumVersionId}::uuid, name = ${record.name}, status = ${record.status},
      status_reason = ${record.statusReason}, capacity = ${record.capacity}::integer, starts_on = ${record.startsOn}::date,
      ends_on = ${record.endsOn}::date, revision = ${record.revision}, updated_by = ${record.updatedBy},
      updated_at = ${record.updatedAt}::timestamptz, deleted_at = ${record.deletedAt}::timestamptz,
      deleted_by = ${record.deletedBy}, deletion_reason = ${record.deletionReason}
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
}

export function mapClassGroupRow(row: SqlRow): ClassGroupRecord {
  return Object.freeze({
    id: str(row.id),
    courseId: str(row.course_id),
    curriculumId: str(row.curriculum_id),
    curriculumVersionId: str(row.curriculum_version_id),
    name: str(row.name),
    status: str(row.status) as ClassGroupState,
    statusReason: strOrNull(row.status_reason),
    capacity: numOrNull(row.capacity),
    startsOn: strOrNull(row.starts_on),
    endsOn: strOrNull(row.ends_on),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
    deletedAt: isoOrNull(row.deleted_at),
    deletedBy: strOrNull(row.deleted_by),
    deletionReason: strOrNull(row.deletion_reason),
  });
}

/** Locks the class group row for the rest of the transaction (serialises enrollments). */
export function lockClassGroupQuery(id: string): SqlQuery {
  return sqlQuery`SELECT id FROM academy_class_groups WHERE id = ${id}::uuid FOR UPDATE`;
}

// ---------------------------------------------------------------------------
// Teacher assignments
// ---------------------------------------------------------------------------

const ASSIGNMENT_COLUMNS = `id, class_group_id, teacher_uid, assigned_by, assigned_at, unassigned_by, unassigned_at, unassign_reason`;

export function listAssignmentsQuery(classGroupId: string, activeOnly: boolean): SqlQuery {
  return {
    text: `SELECT ${ASSIGNMENT_COLUMNS} FROM academy_class_group_teachers
      WHERE class_group_id = $1::uuid AND (NOT $2::boolean OR unassigned_at IS NULL)
      ORDER BY assigned_at ASC, id ASC`,
    values: [classGroupId, activeOnly],
  };
}

export function selectAssignmentQuery(id: string): SqlQuery {
  return { text: `SELECT ${ASSIGNMENT_COLUMNS} FROM academy_class_group_teachers WHERE id = $1::uuid`, values: [id] };
}

export function insertAssignmentQuery(record: TeacherAssignmentRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_class_group_teachers (id, class_group_id, teacher_uid, assigned_by, assigned_at)
    SELECT ${record.id}::uuid, cg.id, ${record.teacherUid}::text, ${record.assignedBy}::text, ${record.assignedAt}::timestamptz
    FROM academy_class_groups cg
    WHERE cg.id = ${record.classGroupId}::uuid AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
    RETURNING id`;
}

export function unassignQuery(record: TeacherAssignmentRecord): SqlQuery {
  return sqlQuery`UPDATE academy_class_group_teachers SET
      unassigned_by = ${record.unassignedBy}, unassigned_at = ${record.unassignedAt}::timestamptz,
      unassign_reason = ${record.unassignReason}
    WHERE id = ${record.id}::uuid AND unassigned_at IS NULL
    RETURNING id`;
}

export function mapAssignmentRow(row: SqlRow): TeacherAssignmentRecord {
  return Object.freeze({
    id: str(row.id),
    classGroupId: str(row.class_group_id),
    teacherUid: str(row.teacher_uid),
    assignedBy: str(row.assigned_by),
    assignedAt: iso(row.assigned_at),
    unassignedBy: strOrNull(row.unassigned_by),
    unassignedAt: isoOrNull(row.unassigned_at),
    unassignReason: strOrNull(row.unassign_reason),
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const SESSION_COLUMNS = `id, class_group_id, curriculum_version_id, lesson_id, starts_at, ends_at, state, state_reason, meeting_url,
  revision, created_by, created_at, updated_by, updated_at`;

export function selectSessionQuery(id: string): SqlQuery {
  return { text: `SELECT ${SESSION_COLUMNS} FROM academy_sessions WHERE id = $1::uuid`, values: [id] };
}

export function listSessionsQuery(classGroupId: string): SqlQuery {
  return {
    text: `SELECT ${SESSION_COLUMNS} FROM academy_sessions WHERE class_group_id = $1::uuid
      ORDER BY starts_at ASC, id ASC LIMIT ${MAX_ROWS}`,
    values: [classGroupId],
  };
}

/** Lessons of sessions that have not happened yet (scheduled or live). */
export function selectUpcomingLessonIdsQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT DISTINCT lesson_id FROM academy_sessions
    WHERE class_group_id = ${classGroupId}::uuid AND state IN ('scheduled', 'live')`;
}

export function insertSessionQuery(record: SessionRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_sessions
      (id, class_group_id, curriculum_version_id, lesson_id, starts_at, ends_at, state, state_reason, meeting_url,
       revision, created_by, created_at, updated_by, updated_at)
    SELECT ${record.id}::uuid, cg.id, ${record.curriculumVersionId}::uuid, ${record.lessonId}::uuid,
      ${record.startsAt}::timestamptz, ${record.endsAt}::timestamptz, ${record.state}::text, ${record.stateReason}::text,
      ${record.meetingUrl}::text, ${record.revision}::integer, ${record.createdBy}::text, ${record.createdAt}::timestamptz,
      ${record.updatedBy}::text, ${record.updatedAt}::timestamptz
    FROM academy_class_groups cg
    WHERE cg.id = ${record.classGroupId}::uuid AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
      AND cg.curriculum_version_id = ${record.curriculumVersionId}::uuid
    RETURNING id`;
}

export function updateSessionQuery(record: SessionRecord, expected: { readonly revision: number; readonly state: SessionState }): SqlQuery {
  return sqlQuery`UPDATE academy_sessions SET
      starts_at = ${record.startsAt}::timestamptz, ends_at = ${record.endsAt}::timestamptz, state = ${record.state},
      state_reason = ${record.stateReason}, meeting_url = ${record.meetingUrl}, revision = ${record.revision},
      updated_by = ${record.updatedBy}, updated_at = ${record.updatedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

export function mapSessionRow(row: SqlRow): SessionRecord {
  return Object.freeze({
    id: str(row.id),
    classGroupId: str(row.class_group_id),
    curriculumVersionId: str(row.curriculum_version_id),
    lessonId: str(row.lesson_id),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    state: str(row.state) as SessionState,
    stateReason: strOrNull(row.state_reason),
    meetingUrl: strOrNull(row.meeting_url),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
  });
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

const ENROLLMENT_COLUMNS = `id, class_group_id, course_id, learner_uid, state, source, state_reason, revision, created_by, created_at,
  updated_by, updated_at, activated_at, ended_at`;

export function selectEnrollmentQuery(id: string): SqlQuery {
  return { text: `SELECT ${ENROLLMENT_COLUMNS} FROM academy_enrollments WHERE id = $1::uuid`, values: [id] };
}

export function listEnrollmentsQuery(classGroupId: string): SqlQuery {
  return {
    text: `SELECT ${ENROLLMENT_COLUMNS} FROM academy_enrollments WHERE class_group_id = $1::uuid
      ORDER BY created_at ASC, id ASC LIMIT ${MAX_ROWS * 20}`,
    values: [classGroupId],
  };
}

export function selectOpenEnrollmentsQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT learner_uid, state FROM academy_enrollments
    WHERE class_group_id = ${classGroupId}::uuid AND state IN ('pending', 'active', 'suspended')`;
}

/**
 * Inserts an enrollment only while the class group is live and below
 * capacity. Run after `lockClassGroupQuery` in the same transaction so two
 * concurrent enrollments cannot both take the last place.
 */
export function insertEnrollmentQuery(record: EnrollmentRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_enrollments
      (id, class_group_id, course_id, learner_uid, state, source, state_reason, revision, created_by, created_at,
       updated_by, updated_at, activated_at, ended_at)
    SELECT ${record.id}::uuid, cg.id, cg.course_id, ${record.learnerUid}::text, ${record.state}::text, ${record.source}::text,
      ${record.stateReason}::text, ${record.revision}::integer, ${record.createdBy}::text, ${record.createdAt}::timestamptz,
      ${record.updatedBy}::text, ${record.updatedAt}::timestamptz, ${record.activatedAt}::timestamptz, ${record.endedAt}::timestamptz
    FROM academy_class_groups cg
    WHERE cg.id = ${record.classGroupId}::uuid AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
      AND (cg.capacity IS NULL OR (
        SELECT count(*) FROM academy_enrollments e
        WHERE e.class_group_id = cg.id AND e.state IN ('pending', 'active', 'suspended')) < cg.capacity)
    RETURNING id`;
}

export function updateEnrollmentQuery(record: EnrollmentRecord, expected: { readonly revision: number; readonly state: EnrollmentState }): SqlQuery {
  return sqlQuery`UPDATE academy_enrollments SET
      state = ${record.state}, state_reason = ${record.stateReason}, revision = ${record.revision},
      updated_by = ${record.updatedBy}, updated_at = ${record.updatedAt}::timestamptz,
      activated_at = ${record.activatedAt}::timestamptz, ended_at = ${record.endedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

export function mapEnrollmentRow(row: SqlRow): EnrollmentRecord {
  return Object.freeze({
    id: str(row.id),
    classGroupId: str(row.class_group_id),
    courseId: str(row.course_id),
    learnerUid: str(row.learner_uid),
    state: str(row.state) as EnrollmentState,
    source: str(row.source) as EnrollmentSource,
    stateReason: strOrNull(row.state_reason),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
    activatedAt: isoOrNull(row.activated_at),
    endedAt: isoOrNull(row.ended_at),
  });
}
