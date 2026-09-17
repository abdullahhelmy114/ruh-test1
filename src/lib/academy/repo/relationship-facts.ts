/**
 * Database-backed RelationshipFacts for the permission evaluator.
 *
 * Every fact fails closed: malformed identifiers answer `false` without a
 * query, deleted or cancelled class groups grant nothing, and only ACTIVE
 * enrollments count as access.
 *
 * Current decisions (to be revisited when the academy defines them):
 *   - course access = an active enrollment in a live class group of that
 *     course. Payment entitlement (Whop) will add a second, required check;
 *     it will never replace this one.
 *   - learners of a completed class group keep no access through this fact.
 *   - a teacher of a completed class group still counts as its teacher
 *     (grading and feedback after the last session).
 */
import { isUid, isUuid } from "../domain/ids.ts";
import { sqlQuery, type SqlExecutor } from "../infra/sql.ts";
import type { RelationshipFacts } from "../permissions/permissions.ts";

async function exists(executor: SqlExecutor, query: ReturnType<typeof sqlQuery>): Promise<boolean> {
  const rows = await executor.query(query);
  return rows.length > 0;
}

export function createSqlRelationshipFacts(executor: SqlExecutor): RelationshipFacts {
  return {
    async isTeacherOfClassGroup(teacherUid, classGroupId) {
      if (!isUid(teacherUid) || !isUuid(classGroupId)) return false;
      return exists(
        executor,
        sqlQuery`SELECT 1 FROM academy_class_group_teachers t
          JOIN academy_class_groups cg ON cg.id = t.class_group_id
          WHERE t.class_group_id = ${classGroupId}::uuid AND t.teacher_uid = ${teacherUid}
            AND t.unassigned_at IS NULL AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active', 'completed')
          LIMIT 1`,
      );
    },

    async isActiveLearnerOfClassGroup(learnerUid, classGroupId) {
      if (!isUid(learnerUid) || !isUuid(classGroupId)) return false;
      return exists(
        executor,
        sqlQuery`SELECT 1 FROM academy_enrollments e
          JOIN academy_class_groups cg ON cg.id = e.class_group_id
          WHERE e.class_group_id = ${classGroupId}::uuid AND e.learner_uid = ${learnerUid} AND e.state = 'active'
            AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
          LIMIT 1`,
      );
    },

    async classGroupBelongsToCourse(classGroupId, courseId) {
      if (!isUuid(classGroupId) || !isUuid(courseId)) return false;
      return exists(
        executor,
        sqlQuery`SELECT 1 FROM academy_class_groups cg
          JOIN academy_courses c ON c.id = cg.course_id
          WHERE cg.id = ${classGroupId}::uuid AND cg.course_id = ${courseId}::uuid
            AND cg.deleted_at IS NULL AND c.deleted_at IS NULL
          LIMIT 1`,
      );
    },

    async hasCourseAccess(learnerUid, courseId) {
      if (!isUid(learnerUid) || !isUuid(courseId)) return false;
      return exists(
        executor,
        sqlQuery`SELECT 1 FROM academy_enrollments e
          JOIN academy_class_groups cg ON cg.id = e.class_group_id
          JOIN academy_courses c ON c.id = e.course_id
          WHERE e.course_id = ${courseId}::uuid AND e.learner_uid = ${learnerUid} AND e.state = 'active'
            AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active') AND c.deleted_at IS NULL
          LIMIT 1`,
      );
    },

    async hasActiveTeachingRelationship(teacherUid, learnerUid) {
      if (!isUid(teacherUid) || !isUid(learnerUid)) return false;
      return exists(
        executor,
        sqlQuery`SELECT 1 FROM academy_class_group_teachers t
          JOIN academy_class_groups cg ON cg.id = t.class_group_id
          JOIN academy_enrollments e ON e.class_group_id = t.class_group_id
          WHERE t.teacher_uid = ${teacherUid} AND t.unassigned_at IS NULL
            AND e.learner_uid = ${learnerUid} AND e.state = 'active'
            AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
          LIMIT 1`,
      );
    },
  };
}
