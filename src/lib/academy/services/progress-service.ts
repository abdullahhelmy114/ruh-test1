/**
 * Learner progress and course completion.
 *
 * Learners see their own progress. Assigned teachers and administrators see
 * any learner of the class group. Only administrators record or revoke a
 * completion; a completion that does not meet the academy's criteria needs
 * an explicit override reason.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { learnerAttemptView } from "../assessment/delivery.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUid, parseUuid } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import { summariseAttendance } from "../learning/attendance.ts";
import {
  evaluateCompletion,
  planRecordCompletion,
  planRevokeCompletion,
  type AssessmentProgress,
  type AssessmentStatus,
  type ProgressSnapshot,
} from "../learning/progress.ts";
import { authorize, authorizeAdminAction, type RelationshipFacts } from "../permissions/permissions.ts";
import {
  insertCompletionQuery,
  listClassGroupAssignmentsQuery,
  mapAssignmentRow,
  mapAttemptRow,
  mapCompletionRow,
  revokeCompletionQuery,
  selectCompletedAttendedLessonsQuery,
  selectCompletionByEnrollmentQuery,
  selectCompletionQuery,
  selectLatestEnrollmentQuery,
  selectLearnerAttendanceFlagsQuery,
  selectLearnerClassGroupAttemptsQuery,
} from "../repo/assessment-repo.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import { mapLessonIdSet, selectLessonIdsInVersionQuery } from "../repo/curriculum-repo.ts";
import { mapClassGroupRow, mapEnrollmentRow, selectClassGroupQuery, selectEnrollmentQuery, updateEnrollmentQuery } from "../repo/delivery-repo.ts";
import type { ClassGroupRecord } from "../structure/delivery.ts";
import { effectivePolicy } from "./policy-lookup.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

export interface ProgressDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
}

type Correlated = { readonly correlationId?: string | null };

export function createProgressService(deps: ProgressDeps) {
  const { executor, facts } = deps;

  async function snapshot(group: ClassGroupRecord, learnerUid: string): Promise<ProgressSnapshot> {
    const [lessonIds, completedLessons, attendanceRows, assignments, attempts] = await Promise.all([
      executor.query(selectLessonIdsInVersionQuery(group.curriculumVersionId)).then(mapLessonIdSet),
      executor.query(selectCompletedAttendedLessonsQuery(group.id, learnerUid)).then(mapLessonIdSet),
      executor.query(selectLearnerAttendanceFlagsQuery(group.id, learnerUid)),
      loadMany(executor, listClassGroupAssignmentsQuery(group.id), mapAssignmentRow),
      loadMany(executor, selectLearnerClassGroupAttemptsQuery(group.id, learnerUid), mapAttemptRow),
    ]);
    const assessments: AssessmentProgress[] = assignments
      .filter((assignment) => assignment.state === "active")
      .map((assignment) => {
        const mine = attempts.filter((a) => a.assignmentId === assignment.id);
        const released = mine.filter((a) => a.releasedAt !== null && a.scorePercent !== null && (a.state === "graded" || a.state === "returned"));
        let status: AssessmentStatus = "not_started";
        const latest = [...mine].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
        if (latest) {
          const view = learnerAttemptView(latest);
          status = view.state === "in_progress" ? "in_progress" : view.state === "returned" ? "returned" : view.result ? "graded" : "awaiting_result";
        }
        return {
          assignmentId: assignment.id,
          mode: assignment.mode,
          title: assignment.title,
          status,
          bestScorePercent: released.length === 0 ? null : Math.max(...released.map((a) => a.scorePercent as number)),
        };
      });
    return {
      lessons: { total: lessonIds.size, completed: [...lessonIds].filter((id) => completedLessons.has(id)).length },
      attendance: summariseAttendance(attendanceRows.map((row) => ({ countsAsAttended: row.counts_as_attended === true }))),
      assessments,
    };
  }

  async function loadGroupFor(user: AuthUser, classGroupId: unknown): Promise<ClassGroupRecord> {
    const group = await loadOptional(executor, selectClassGroupQuery(parseUuid(classGroupId, "classGroupId")), mapClassGroupRow);
    if (!group || group.deletedAt !== null) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Class group not found.");
      throw new AuthError("FORBIDDEN");
    }
    return group;
  }

  async function criteriaFor(courseId: string) {
    const course = await loadRequired(executor, selectCourseQuery(courseId), mapCourseRow, "Course not found.");
    return effectivePolicy(executor, "completion.criteria", { programId: course.programId, courseId: course.id });
  }

  return {
    /**
     * Learners: their own progress (`learnerUid` ignored). Teachers and
     * administrators: the named learner of the class group.
     */
    async progress(user: AuthUser, classGroupId: unknown, options: { readonly learnerUid?: unknown } = {}) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadGroupFor(user, classGroupId);
      let learnerUid: string;
      if (user.role === "student") {
        await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
        learnerUid = user.uid;
      } else {
        await authorize(user, { action: "class_group.read_roster", classGroupId: group.id }, facts);
        learnerUid = parseUid(options.learnerUid, "learnerUid");
      }
      const progress = await snapshot(group, learnerUid);
      let completion: { configured: true; evaluation: ReturnType<typeof evaluateCompletion> } | { configured: false } = { configured: false };
      try {
        completion = { configured: true, evaluation: evaluateCompletion(progress, await criteriaFor(group.courseId)) };
      } catch (error) {
        if (!(error instanceof DomainError && error.code === "POLICY_UNCONFIGURED")) throw error;
      }
      return { classGroupId: group.id, learnerUid, progress, completion };
    },

    async recordCompletion(
      user: AuthUser,
      enrollmentId: unknown,
      input: Correlated & { readonly overrideReason?: unknown; readonly expectedRevision: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "enrollment.manage");
      const enrollment = await loadRequired(executor, selectEnrollmentQuery(parseUuid(enrollmentId, "enrollmentId")), mapEnrollmentRow, "Enrollment not found.");
      const existing = await loadOptional(executor, selectCompletionByEnrollmentQuery(enrollment.id), mapCompletionRow);
      if (existing) throw new DomainError("CONFLICT", "A completion has already been recorded for this enrollment.");
      const group = await loadRequired(executor, selectClassGroupQuery(enrollment.classGroupId), mapClassGroupRow, "Class group not found.");
      const criteria = await criteriaFor(enrollment.courseId);
      const evaluation = evaluateCompletion(await snapshot(group, enrollment.learnerUid), criteria);
      const plan = planRecordCompletion(
        { enrollment, criteria, evaluation, overrideReason: input.overrideReason, expectedRevision: input.expectedRevision },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(
        executor,
        [
          audited(deps, insertCompletionQuery(plan.completion), plan.audits[0]),
          audited(deps, updateEnrollmentQuery(plan.enrollment, enrollment), plan.audits[1]),
        ],
        { unique: "A completion has already been recorded for this enrollment." },
      );
      return { completion: plan.completion, enrollment: plan.enrollment };
    },

    async revokeCompletion(user: AuthUser, completionId: unknown, input: Correlated & { readonly reason: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "enrollment.manage");
      const completion = await loadRequired(executor, selectCompletionQuery(parseUuid(completionId, "completionId")), mapCompletionRow, "Completion not found.");
      const plan = planRevokeCompletion(completion, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, revokeCompletionQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    /** The learner's latest enrollment in a class group (administrative helper for completion screens). */
    async enrollmentFor(user: AuthUser, classGroupId: unknown, learnerUid: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "enrollment.manage");
      const rows = await executor.query(selectLatestEnrollmentQuery(parseUuid(classGroupId, "classGroupId"), parseUid(learnerUid, "learnerUid")));
      return rows.length === 0 ? null : mapEnrollmentRow(rows[0]);
    },
  };
}

export type ProgressService = ReturnType<typeof createProgressService>;
