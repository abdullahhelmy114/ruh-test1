/**
 * Read models for the administration workspace: operational overview and
 * the queue of work waiting for a decision.
 */
import { sqlQuery, type SqlQuery } from "../infra/sql.ts";

/** Counts that tell administrators what needs attention. */
export function selectOverviewQuery(from: string, to: string): SqlQuery {
  return sqlQuery`SELECT
      (SELECT count(*) FROM academy_programs WHERE deleted_at IS NULL) AS programs,
      (SELECT count(*) FROM academy_courses WHERE deleted_at IS NULL) AS courses,
      (SELECT count(*) FROM academy_class_groups WHERE deleted_at IS NULL AND status IN ('planned', 'active')) AS open_class_groups,
      (SELECT count(*) FROM academy_class_groups cg WHERE cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
         AND NOT EXISTS (SELECT 1 FROM academy_class_group_teachers t WHERE t.class_group_id = cg.id AND t.unassigned_at IS NULL)) AS class_groups_without_teacher,
      (SELECT count(*) FROM academy_enrollments WHERE state = 'active') AS active_enrollments,
      (SELECT count(*) FROM academy_enrollments WHERE state = 'pending') AS pending_enrollments,
      (SELECT count(*) FROM academy_sessions WHERE state IN ('scheduled', 'live') AND starts_at >= ${from}::timestamptz AND starts_at < ${to}::timestamptz) AS upcoming_sessions,
      (SELECT count(*) FROM academy_curriculum_versions WHERE state = 'in_review') AS curriculum_reviews,
      (SELECT count(*) FROM academy_lesson_script_versions WHERE state = 'in_review') AS lesson_script_reviews,
      (SELECT count(*) FROM academy_assessment_versions WHERE state = 'in_review') AS assessment_reviews,
      (SELECT count(*) FROM academy_assessment_attempts WHERE state = 'needs_review') AS attempts_needing_review,
      (SELECT count(*) FROM academy_recordings WHERE state = 'in_review') AS recordings_in_review,
      (SELECT count(*) FROM academy_approval_gates WHERE state = 'open') AS open_approval_requests`;
}

/** Keys that have an academy-wide value; the rest are unconfigured. */
export function selectConfiguredAcademyPolicyKeysQuery(): SqlQuery {
  return { text: `SELECT policy_key FROM academy_policy_values WHERE scope = 'academy'`, values: [] };
}

/** Content versions waiting for review, oldest first. */
export function selectContentReviewQueueQuery(): SqlQuery {
  return {
    text: `SELECT * FROM (
        SELECT 'curriculum_version' AS kind, v.id, v.version_number, v.created_by, v.submitted_at, c.title AS label, c.id AS course_id
        FROM academy_curriculum_versions v
        JOIN academy_curricula cu ON cu.id = v.curriculum_id
        JOIN academy_courses c ON c.id = cu.course_id
        WHERE v.state = 'in_review'
        UNION ALL
        SELECT 'lesson_script_version' AS kind, v.id, v.version_number, v.created_by, v.submitted_at,
          (SELECT vl.title FROM academy_curriculum_version_lessons vl
             JOIN academy_curriculum_versions cv ON cv.id = vl.curriculum_version_id
             WHERE vl.lesson_id = s.lesson_id ORDER BY cv.version_number DESC LIMIT 1) AS label,
          cu.course_id
        FROM academy_lesson_script_versions v
        JOIN academy_lesson_scripts s ON s.id = v.lesson_script_id
        JOIN academy_curricula cu ON cu.id = s.curriculum_id
        WHERE v.state = 'in_review'
        UNION ALL
        SELECT 'assessment_version' AS kind, v.id, v.version_number, v.created_by, v.submitted_at, a.title AS label, a.course_id
        FROM academy_assessment_versions v
        JOIN academy_assessments a ON a.id = v.assessment_id
        WHERE v.state = 'in_review'
      ) queue
      ORDER BY submitted_at ASC NULLS LAST
      LIMIT 300`,
    values: [],
  };
}
