/**
 * Assessments in a class group: assignments, learners' attempts, and
 * teachers' grading, release and return for revision.
 *
 * Access:
 *   - administrators assign and cancel (assessment.assign);
 *   - active learners start, save and submit their own attempts and see
 *     results only once released;
 *   - assigned teachers (and administrators) review, grade, release and
 *     return work (assessment.grade, feedback.write).
 *
 * Attempt limits, late work, result release and revision come from the
 * course's resolved policies and fail closed when unconfigured.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { projectForLearner, readStoredAssessmentContent, type AssessmentContent } from "../assessment/content.ts";
import {
  learnerAttemptView,
  planCancelAssignment,
  planCreateAssignment,
  planGradeAttempt,
  planReleaseAttempt,
  planReturnAttempt,
  planSaveResponses,
  planStartAttempt,
  planSubmitAttempt,
  type AssignmentRecord,
  type AttemptRecord,
} from "../assessment/delivery.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid, systemClock } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import { expectRows } from "../repo/audit-repo.ts";
import { authorize, authorizeAdminAction, type RelationshipFacts } from "../permissions/permissions.ts";
import {
  insertAssignmentQuery,
  insertAttemptQuery,
  listAssessmentVersionsQuery,
  listClassGroupAssignmentsQuery,
  mapAssessmentRow,
  mapAssessmentVersionRow,
  mapAssignmentRow,
  mapAttemptRow,
  selectAssessmentQuery,
  selectAssessmentVersionQuery,
  selectAssignmentAttemptCountsQuery,
  selectAssignmentQuery,
  selectAttemptQuery,
  selectLearnerAttemptsQuery,
  selectLearnerClassGroupAttemptsQuery,
  selectReviewQueueQuery,
  updateAssignmentQuery,
  updateAttemptQuery,
} from "../repo/assessment-repo.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import { mapClassGroupRow, selectClassGroupQuery } from "../repo/delivery-repo.ts";
import { iso, num, str } from "../repo/rows.ts";
import type { ClassGroupRecord } from "../structure/delivery.ts";
import { effectivePolicy } from "./policy-lookup.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

export interface AssessmentDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
}

type Correlated = { readonly correlationId?: string | null };

export function createAssessmentService(deps: AssessmentDeps) {
  const { executor, facts } = deps;
  const now = () => (deps.clock ?? systemClock)();

  async function loadGroupFor(user: AuthUser, classGroupId: string): Promise<ClassGroupRecord> {
    const group = await loadOptional(executor, selectClassGroupQuery(classGroupId), mapClassGroupRow);
    if (!group || group.deletedAt !== null) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Class group not found.");
      throw new AuthError("FORBIDDEN");
    }
    return group;
  }

  async function loadAssignmentFor(user: AuthUser, assignmentId: unknown): Promise<{ assignment: AssignmentRecord; group: ClassGroupRecord }> {
    const assignment = await loadOptional(executor, selectAssignmentQuery(parseUuid(assignmentId, "assignmentId")), mapAssignmentRow);
    if (!assignment) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Assignment not found.");
      throw new AuthError("FORBIDDEN");
    }
    return { assignment, group: await loadGroupFor(user, assignment.classGroupId) };
  }

  async function loadAttempt(attemptId: unknown): Promise<AttemptRecord> {
    const attempt = await loadOptional(executor, selectAttemptQuery(parseUuid(attemptId, "attemptId")), mapAttemptRow);
    if (!attempt) throw new DomainError("NOT_FOUND", "Attempt not found.");
    return attempt;
  }

  async function contentOf(assignment: AssignmentRecord): Promise<AssessmentContent> {
    const rows = await executor.query(selectAssessmentVersionQuery(assignment.assessmentVersionId));
    if (rows.length === 0) throw new DomainError("NOT_FOUND", "Assessment content not found.");
    return readStoredAssessmentContent(rows[0].content);
  }

  async function policiesFor(courseId: string) {
    const course = await loadRequired(executor, selectCourseQuery(courseId), mapCourseRow, "Course not found.");
    const target = { programId: course.programId, courseId: course.id };
    return {
      attemptLimit: () => effectivePolicy(executor, "assessment.attempt_limit", target),
      lateWork: () => effectivePolicy(executor, "learning.late_work", target),
      releaseMode: async () => (await effectivePolicy(executor, "assessment.result_release", target)).mode,
      revision: () => effectivePolicy(executor, "learning.revision", target),
    };
  }

  /** A learner acts on assessments only as an active learner of the class group. */
  async function authorizeLearner(user: AuthUser, group: ClassGroupRecord): Promise<void> {
    if (user.role !== "student") throw new AuthError("FORBIDDEN");
    await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
  }

  async function authorizeGrader(user: AuthUser, classGroupId: string): Promise<void> {
    await authorize(user, { action: "assessment.grade", classGroupId }, facts);
    await authorize(user, { action: "feedback.write", classGroupId }, facts);
  }

  return {
    // -- Assignments (administration) -----------------------------------------

    async createAssignment(
      user: AuthUser,
      classGroupId: unknown,
      input: Correlated & { readonly assessmentId: unknown; readonly opensAt: unknown; readonly dueAt?: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "assessment.assign");
      const group = await loadGroupFor(user, parseUuid(classGroupId, "classGroupId"));
      const assessment = await loadRequired(executor, selectAssessmentQuery(parseUuid(input.assessmentId, "assessmentId")), mapAssessmentRow, "Assessment not found.");
      const versions = await loadMany(executor, listAssessmentVersionsQuery(assessment.id), mapAssessmentVersionRow);
      const version = versions.find((v) => v.state === "published");
      if (!version) throw new DomainError("CONFLICT", "Publish this assessment before assigning it.");
      const plan = planCreateAssignment({ classGroup: group, assessment, version, opensAt: input.opensAt, dueAt: input.dueAt }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertAssignmentQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    async cancelAssignment(user: AuthUser, assignmentId: unknown, input: Correlated & { readonly reason: unknown; readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "assessment.assign");
      const { assignment } = await loadAssignmentFor(user, assignmentId);
      const plan = planCancelAssignment(assignment, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateAssignmentQuery(plan.record, assignment.revision), plan.audit)]);
      return plan.record;
    },

    // -- Reading ---------------------------------------------------------------

    /** Learners: assignments with their own status. Teachers and administrators: with submission counts. */
    async listAssignments(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadGroupFor(user, parseUuid(classGroupId, "classGroupId"));
      await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
      const assignments = await loadMany(executor, listClassGroupAssignmentsQuery(group.id), mapAssignmentRow);
      if (user.role === "student") {
        const attempts = await loadMany(executor, selectLearnerClassGroupAttemptsQuery(group.id, user.uid), mapAttemptRow);
        return assignments
          .filter((a) => a.state === "active")
          .map((a) => {
            const mine = attempts.filter((attempt) => attempt.assignmentId === a.id).map(learnerAttemptView);
            return { assignment: a, attempts: mine };
          });
      }
      const counts = await executor.query(selectAssignmentAttemptCountsQuery(group.id));
      return assignments.map((a) => ({
        assignment: a,
        attemptsByState: Object.fromEntries(counts.filter((row) => str(row.assignment_id) === a.id).map((row) => [str(row.state), num(row.n)])),
      }));
    },

    async getAssignment(user: AuthUser, assignmentId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const { assignment, group } = await loadAssignmentFor(user, assignmentId);
      await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
      if (user.role === "student") {
        if (assignment.state !== "active") throw new DomainError("NOT_FOUND", "Assignment not found.");
        if (now().getTime() < Date.parse(assignment.opensAt)) throw new DomainError("NOT_YET_AVAILABLE", "This assessment is not open yet.");
        const [content, attempts] = await Promise.all([
          contentOf(assignment),
          loadMany(executor, selectLearnerAttemptsQuery(assignment.id, user.uid), mapAttemptRow),
        ]);
        return { assignment, content: projectForLearner(content), attempts: attempts.map(learnerAttemptView) };
      }
      await authorize(user, { action: "assessment.grade", classGroupId: group.id }, facts);
      return { assignment, content: await contentOf(assignment) };
    },

    // -- Learner attempts ------------------------------------------------------

    async startAttempt(user: AuthUser, assignmentId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const { assignment, group } = await loadAssignmentFor(user, assignmentId);
      await authorizeLearner(user, group);
      const policies = await policiesFor(assignment.courseId);
      const [content, existing, attemptLimit, revisionPolicy, lateWork] = await Promise.all([
        contentOf(assignment),
        loadMany(executor, selectLearnerAttemptsQuery(assignment.id, user.uid), mapAttemptRow),
        policies.attemptLimit(),
        policies.revision(),
        policies.lateWork(),
      ]);
      const record = planStartAttempt(
        { assignment, content, learnerUid: user.uid, existing, attemptLimit, revisionPolicy, lateWork },
        contextFor(user, deps),
      );
      await runGuarded(executor, [expectRows(insertAttemptQuery(record), 1)], { unique: "You already have an attempt in progress." });
      return learnerAttemptView(record);
    },

    async saveAttempt(user: AuthUser, attemptId: unknown, input: { readonly responses: unknown; readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const attempt = await loadAttempt(attemptId);
      if (user.role !== "student" || attempt.learnerUid !== user.uid) throw new DomainError("NOT_FOUND", "Attempt not found.");
      const { assignment, group } = await loadAssignmentFor(user, attempt.assignmentId);
      await authorizeLearner(user, group);
      const next = planSaveResponses(attempt, input, { content: await contentOf(assignment), learnerUid: user.uid }, contextFor(user, deps));
      await runGuarded(executor, [expectRows(updateAttemptQuery(next, attempt), 1)]);
      return learnerAttemptView(next);
    },

    async submitAttempt(user: AuthUser, attemptId: unknown, input: Correlated & { readonly responses?: unknown; readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const attempt = await loadAttempt(attemptId);
      if (user.role !== "student" || attempt.learnerUid !== user.uid) throw new DomainError("NOT_FOUND", "Attempt not found.");
      const { assignment, group } = await loadAssignmentFor(user, attempt.assignmentId);
      await authorizeLearner(user, group);
      const policies = await policiesFor(assignment.courseId);
      const [content, lateWork, releaseMode] = await Promise.all([contentOf(assignment), policies.lateWork(), policies.releaseMode()]);
      const plan = planSubmitAttempt(attempt, input, { learnerUid: user.uid, assignment, content, lateWork, releaseMode }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateAttemptQuery(plan.record, attempt), plan.audit)]);
      return learnerAttemptView(plan.record);
    },

    /** Learners see their own attempt (results once released); graders see the full record. */
    async getAttempt(user: AuthUser, attemptId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const attempt = await loadAttempt(attemptId);
      if (user.role === "student") {
        if (attempt.learnerUid !== user.uid) throw new DomainError("NOT_FOUND", "Attempt not found.");
        return learnerAttemptView(attempt);
      }
      await authorize(user, { action: "assessment.grade", classGroupId: attempt.classGroupId }, facts);
      return attempt;
    },

    // -- Grading ---------------------------------------------------------------

    async reviewQueue(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadGroupFor(user, parseUuid(classGroupId, "classGroupId"));
      await authorize(user, { action: "assessment.grade", classGroupId: group.id }, facts);
      const rows = await executor.query(selectReviewQueueQuery(group.id));
      return rows.map((row) => ({
        attemptId: str(row.id),
        assignmentId: str(row.assignment_id),
        assignmentTitle: str(row.assignment_title),
        mode: str(row.mode),
        learnerUid: str(row.learner_uid),
        attemptNumber: num(row.attempt_number),
        kind: str(row.kind),
        state: str(row.state),
        isLate: row.is_late === true,
        submittedAt: row.submitted_at === null ? null : iso(row.submitted_at),
        scorePercent: row.score_percent === null ? null : num(row.score_percent),
        awaitingRelease: str(row.state) === "graded" && (row.released_at === null || row.released_at === undefined),
      }));
    },

    async gradeAttempt(user: AuthUser, attemptId: unknown, input: Correlated & { readonly scores?: unknown; readonly feedback?: unknown; readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const attempt = await loadAttempt(attemptId);
      await authorizeGrader(user, attempt.classGroupId);
      const { assignment } = await loadAssignmentFor(user, attempt.assignmentId);
      const releaseMode = await (await policiesFor(assignment.courseId)).releaseMode();
      const plan = planGradeAttempt(attempt, input, { releaseMode }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateAttemptQuery(plan.record, attempt), plan.audit)]);
      return plan.record;
    },

    async releaseAttempt(user: AuthUser, attemptId: unknown, input: Correlated & { readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const attempt = await loadAttempt(attemptId);
      await authorizeGrader(user, attempt.classGroupId);
      const plan = planReleaseAttempt(attempt, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateAttemptQuery(plan.record, attempt), plan.audit)]);
      return plan.record;
    },

    async returnAttempt(user: AuthUser, attemptId: unknown, input: Correlated & { readonly feedback: unknown; readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const attempt = await loadAttempt(attemptId);
      await authorizeGrader(user, attempt.classGroupId);
      const { assignment } = await loadAssignmentFor(user, attempt.assignmentId);
      const [revisionPolicy, learnerAttempts] = await Promise.all([
        (await policiesFor(assignment.courseId)).revision(),
        loadMany(executor, selectLearnerAttemptsQuery(assignment.id, attempt.learnerUid), mapAttemptRow),
      ]);
      const revisionsUsed = learnerAttempts.filter((a) => a.kind === "revision").length;
      const plan = planReturnAttempt(attempt, input, { revisionPolicy, revisionsUsed }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateAttemptQuery(plan.record, attempt), plan.audit)]);
      return plan.record;
    },
  };
}

export type AssessmentService = ReturnType<typeof createAssessmentService>;
