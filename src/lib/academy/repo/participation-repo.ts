/**
 * Read models for learners and teachers, plus attendance persistence.
 *
 * Privacy: every learner/teacher query is keyed by the caller's own uid, the
 * roster exposes names only (never emails or other profile fields), and
 * meeting links are selected only where the caller's participation allows.
 */
import { sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { AttendanceRecord } from "../learning/attendance.ts";
import { iso, str } from "./rows.ts";

const UPCOMING_LIMIT = 50;

// ---------------------------------------------------------------------------
// Learner
// ---------------------------------------------------------------------------

/** The caller's open enrollments with their class group and course. */
export function selectLearnerClassGroupsQuery(learnerUid: string): SqlQuery {
  return sqlQuery`SELECT e.id AS enrollment_id, e.state AS enrollment_state,
      cg.id AS class_group_id, cg.name AS class_group_name, cg.status AS class_group_status,
      cg.starts_on::text AS starts_on, cg.ends_on::text AS ends_on,
      c.id AS course_id, c.title AS course_title
    FROM academy_enrollments e
    JOIN academy_class_groups cg ON cg.id = e.class_group_id
    JOIN academy_courses c ON c.id = e.course_id
    WHERE e.learner_uid = ${learnerUid} AND e.state IN ('pending', 'active', 'suspended')
      AND cg.deleted_at IS NULL AND c.deleted_at IS NULL
    ORDER BY cg.starts_on NULLS LAST, cg.name`;
}

/**
 * Upcoming sessions of class groups where the caller is an ACTIVE learner.
 * The meeting link is only selected here, for active participation.
 */
export function selectLearnerUpcomingSessionsQuery(learnerUid: string, from: string): SqlQuery {
  return sqlQuery`SELECT s.id, s.class_group_id, s.lesson_id, s.starts_at, s.ends_at, s.state, s.meeting_url, vl.title AS lesson_title
    FROM academy_sessions s
    JOIN academy_enrollments e ON e.class_group_id = s.class_group_id AND e.learner_uid = ${learnerUid} AND e.state = 'active'
    JOIN academy_class_groups cg ON cg.id = s.class_group_id AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
    JOIN academy_curriculum_version_lessons vl ON vl.curriculum_version_id = s.curriculum_version_id AND vl.lesson_id = s.lesson_id
    WHERE s.state IN ('scheduled', 'live') AND s.ends_at >= ${from}::timestamptz
    ORDER BY s.starts_at ASC, s.id ASC
    LIMIT ${UPCOMING_LIMIT}`;
}

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------

export function selectTeacherClassGroupsQuery(teacherUid: string): SqlQuery {
  return sqlQuery`SELECT cg.id AS class_group_id, cg.name AS class_group_name, cg.status AS class_group_status,
      cg.starts_on::text AS starts_on, cg.ends_on::text AS ends_on, c.id AS course_id, c.title AS course_title,
      (SELECT count(*) FROM academy_enrollments e WHERE e.class_group_id = cg.id AND e.state = 'active') AS active_learners
    FROM academy_class_group_teachers t
    JOIN academy_class_groups cg ON cg.id = t.class_group_id
    JOIN academy_courses c ON c.id = cg.course_id
    WHERE t.teacher_uid = ${teacherUid} AND t.unassigned_at IS NULL
      AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active', 'completed') AND c.deleted_at IS NULL
    ORDER BY cg.starts_on NULLS LAST, cg.name`;
}

export function selectTeacherUpcomingSessionsQuery(teacherUid: string, from: string): SqlQuery {
  return sqlQuery`SELECT s.id, s.class_group_id, s.lesson_id, s.starts_at, s.ends_at, s.state, s.meeting_url, vl.title AS lesson_title,
      p.status AS preparation_status
    FROM academy_sessions s
    JOIN academy_class_group_teachers t ON t.class_group_id = s.class_group_id AND t.teacher_uid = ${teacherUid} AND t.unassigned_at IS NULL
    JOIN academy_class_groups cg ON cg.id = s.class_group_id AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
    JOIN academy_curriculum_version_lessons vl ON vl.curriculum_version_id = s.curriculum_version_id AND vl.lesson_id = s.lesson_id
    LEFT JOIN academy_session_preparations p ON p.session_id = s.id AND p.teacher_uid = t.teacher_uid
    WHERE s.state IN ('scheduled', 'live') AND s.ends_at >= ${from}::timestamptz
    ORDER BY s.starts_at ASC, s.id ASC
    LIMIT ${UPCOMING_LIMIT}`;
}

// ---------------------------------------------------------------------------
// Class group detail and roster
// ---------------------------------------------------------------------------

export function selectCourseTitleQuery(courseId: string): SqlQuery {
  return sqlQuery`SELECT id, title FROM academy_courses WHERE id = ${courseId}::uuid AND deleted_at IS NULL`;
}

export function selectClassGroupSessionsWithTitlesQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT s.id, s.lesson_id, s.starts_at, s.ends_at, s.state, s.meeting_url, vl.title AS lesson_title
    FROM academy_sessions s
    JOIN academy_curriculum_version_lessons vl ON vl.curriculum_version_id = s.curriculum_version_id AND vl.lesson_id = s.lesson_id
    WHERE s.class_group_id = ${classGroupId}::uuid
    ORDER BY s.starts_at ASC, s.id ASC
    LIMIT 1000`;
}

/** Roster: enrollments with the learner's display name only. */
export function selectRosterQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT e.id AS enrollment_id, e.learner_uid, e.state, p.full_name
    FROM academy_enrollments e
    LEFT JOIN profiles p ON p.firebase_uid = e.learner_uid
    WHERE e.class_group_id = ${classGroupId}::uuid
    ORDER BY p.full_name NULLS LAST, e.learner_uid
    LIMIT 10000`;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/** Learners whose enrollment overlapped the session window. */
export function selectEligibleLearnersQuery(classGroupId: string, startsAt: string, endsAt: string): SqlQuery {
  return sqlQuery`SELECT DISTINCT e.learner_uid FROM academy_enrollments e
    WHERE e.class_group_id = ${classGroupId}::uuid
      AND e.activated_at IS NOT NULL AND e.activated_at <= ${endsAt}::timestamptz
      AND (e.ended_at IS NULL OR e.ended_at >= ${startsAt}::timestamptz)`;
}

const ATTENDANCE_COLUMNS = `id, session_id, class_group_id, learner_uid, mark_code, counts_as_attended, revision, recorded_by, recorded_at,
  updated_by, updated_at`;

export function selectSessionAttendanceQuery(sessionId: string): SqlQuery {
  return { text: `SELECT ${ATTENDANCE_COLUMNS} FROM academy_attendance_records WHERE session_id = $1::uuid ORDER BY learner_uid`, values: [sessionId] };
}

export function selectOwnSessionAttendanceQuery(sessionId: string, learnerUid: string): SqlQuery {
  return {
    text: `SELECT ${ATTENDANCE_COLUMNS} FROM academy_attendance_records WHERE session_id = $1::uuid AND learner_uid = $2`,
    values: [sessionId, learnerUid],
  };
}

/** The caller's own attendance in one class group, with session times and lesson titles. */
export function selectOwnClassGroupAttendanceQuery(learnerUid: string, classGroupId: string): SqlQuery {
  return sqlQuery`SELECT a.session_id, a.mark_code, a.counts_as_attended, a.updated_at, s.starts_at, vl.title AS lesson_title
    FROM academy_attendance_records a
    JOIN academy_sessions s ON s.id = a.session_id
    JOIN academy_curriculum_version_lessons vl ON vl.curriculum_version_id = s.curriculum_version_id AND vl.lesson_id = s.lesson_id
    WHERE a.learner_uid = ${learnerUid} AND a.class_group_id = ${classGroupId}::uuid
    ORDER BY s.starts_at ASC`;
}

/** Inserts a mark only while the session is live or completed. */
export function insertAttendanceQuery(record: AttendanceRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_attendance_records
      (id, session_id, class_group_id, learner_uid, mark_code, counts_as_attended, revision, recorded_by, recorded_at, updated_by, updated_at)
    SELECT ${record.id}::uuid, s.id, s.class_group_id, ${record.learnerUid}::text, ${record.markCode}::text,
      ${record.countsAsAttended}::boolean, ${record.revision}::integer, ${record.recordedBy}::text, ${record.recordedAt}::timestamptz,
      ${record.updatedBy}::text, ${record.updatedAt}::timestamptz
    FROM academy_sessions s
    WHERE s.id = ${record.sessionId}::uuid AND s.class_group_id = ${record.classGroupId}::uuid AND s.state IN ('live', 'completed')
    RETURNING id`;
}

export function updateAttendanceQuery(record: AttendanceRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_attendance_records SET
      mark_code = ${record.markCode}, counts_as_attended = ${record.countsAsAttended}, revision = ${record.revision},
      updated_by = ${record.updatedBy}, updated_at = ${record.updatedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
}

export function mapAttendanceRow(row: SqlRow): AttendanceRecord {
  return Object.freeze({
    id: str(row.id),
    sessionId: str(row.session_id),
    classGroupId: str(row.class_group_id),
    learnerUid: str(row.learner_uid),
    markCode: str(row.mark_code),
    countsAsAttended: row.counts_as_attended === true,
    revision: Number(row.revision),
    recordedBy: str(row.recorded_by),
    recordedAt: iso(row.recorded_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
  });
}
