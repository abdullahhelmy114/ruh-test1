/**
 * Administrative delivery service: class groups, teacher assignments,
 * sessions and enrollments.
 *
 * Every write re-checks the facts it depends on inside the database (see
 * repo/delivery-repo.ts), so concurrent administrators cannot, for example,
 * enroll past capacity or schedule into a cancelled class group.
 */
import type { AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { assertRevision, parseRequiredRevision } from "../domain/text.ts";
import { restoreSoftDeleted, softDelete } from "../governance/soft-delete.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorizeAdminAction, type AdminOnlyAction } from "../permissions/permissions.ts";
import { mapCourseRow, mapCurriculumRow, selectCourseQuery, selectCurriculumByCourseQuery } from "../repo/catalog-repo.ts";
import {
  listVersionsQuery,
  mapLessonIdSet,
  mapVersionRow,
  selectLessonIdsInVersionQuery,
  selectVersionQuery,
} from "../repo/curriculum-repo.ts";
import {
  insertAssignmentQuery,
  insertClassGroupQuery,
  insertEnrollmentQuery,
  insertSessionQuery,
  listAssignmentsQuery,
  listClassGroupsQuery,
  listEnrollmentsQuery,
  listSessionsQuery,
  lockClassGroupQuery,
  mapAssignmentRow,
  mapClassGroupRow,
  mapEnrollmentRow,
  mapSessionRow,
  selectAssignmentQuery,
  selectClassGroupQuery,
  selectEnrollmentQuery,
  selectOpenEnrollmentsQuery,
  selectSessionQuery,
  selectUpcomingLessonIdsQuery,
  unassignQuery,
  updateClassGroupQuery,
  updateEnrollmentQuery,
  updateSessionQuery,
} from "../repo/delivery-repo.ts";
import { mapProfileFacts, selectProfileFactsQuery } from "../repo/profile-repo.ts";
import type { CourseRecord } from "../structure/catalog.ts";
import type { CurriculumVersionRecord } from "../structure/curriculum.ts";
import {
  OPEN_ENROLLMENT_STATES,
  planAssignTeacher,
  planClassGroupStatus,
  planCreateClassGroup,
  planEnroll,
  planEnrollmentStatus,
  planRepinCurriculum,
  planRescheduleSession,
  planScheduleSession,
  planSessionStatus,
  planUnassignTeacher,
  planUpdateClassGroup,
  type ClassGroupRecord,
  type EnrollmentRecord,
  type ProfileFacts,
  type SessionRecord,
} from "../structure/delivery.ts";
import type { ReasonedRevision } from "./catalog-service.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, touched, type ServiceDeps } from "./support.ts";

type Correlated = { readonly correlationId?: string | null };

export function createDeliveryService(deps: ServiceDeps) {
  const { executor } = deps;

  function guard(user: AuthUser, action: AdminOnlyAction): void {
    assertAcademyCoreAvailable(deps.flags);
    authorizeAdminAction(user, action);
  }

  async function loadClassGroup(classGroupId: unknown): Promise<ClassGroupRecord> {
    return loadRequired(
      executor,
      selectClassGroupQuery(parseUuid(classGroupId, "classGroupId")),
      mapClassGroupRow,
      "Class group not found.",
    );
  }

  async function loadCourse(courseId: string): Promise<CourseRecord> {
    return loadRequired(executor, selectCourseQuery(courseId), mapCourseRow, "Course not found.");
  }

  async function loadProfile(uid: unknown, field: string): Promise<ProfileFacts | null> {
    const rows = await executor.query(selectProfileFactsQuery(parseUid(uid, field)));
    return mapProfileFacts(rows[0]);
  }

  async function lessonIdsIn(versionId: string): Promise<Set<string>> {
    return mapLessonIdSet(await executor.query(selectLessonIdsInVersionQuery(versionId)));
  }

  async function pinnableVersion(course: CourseRecord, versionId: unknown) {
    const curriculum = await loadRequired(executor, selectCurriculumByCourseQuery(course.id), mapCurriculumRow, "Curriculum not found.");
    let version: CurriculumVersionRecord | null;
    if (versionId === undefined || versionId === null || versionId === "") {
      const versions = await loadMany(executor, listVersionsQuery(curriculum.id), mapVersionRow);
      version = versions.find((v) => v.state === "published") ?? null;
      if (!version) throw new DomainError("CONFLICT", "Publish a curriculum version before opening a class group.");
    } else {
      version = await loadRequired(executor, selectVersionQuery(parseUuid(versionId, "curriculumVersionId")), mapVersionRow, "Curriculum version not found.");
    }
    return { curriculum, version };
  }

  function now(): string {
    return toIso((deps.clock ?? systemClock)());
  }

  return {
    // -- Class groups --------------------------------------------------------

    async listClassGroups(user: AuthUser, options: { readonly courseId?: unknown; readonly includeDeleted?: boolean } = {}) {
      guard(user, "class_group.manage");
      const courseId =
        options.courseId === undefined || options.courseId === null || options.courseId === "" ? null : parseUuid(options.courseId, "courseId");
      return loadMany(executor, listClassGroupsQuery({ courseId, includeDeleted: options.includeDeleted === true }), mapClassGroupRow);
    },

    async getClassGroup(user: AuthUser, classGroupId: unknown) {
      guard(user, "class_group.manage");
      const classGroup = await loadClassGroup(classGroupId);
      const [teachers, openEnrollments] = await Promise.all([
        loadMany(executor, listAssignmentsQuery(classGroup.id, true), mapAssignmentRow),
        executor.query(selectOpenEnrollmentsQuery(classGroup.id)),
      ]);
      return { classGroup, teachers, openEnrollmentCount: openEnrollments.length };
    },

    async createClassGroup(
      user: AuthUser,
      input: Correlated & {
        readonly courseId: unknown;
        readonly curriculumVersionId?: unknown;
        readonly name: unknown;
        readonly capacity?: unknown;
        readonly startsOn?: unknown;
        readonly endsOn?: unknown;
      },
    ): Promise<ClassGroupRecord> {
      guard(user, "class_group.manage");
      const course = await loadCourse(parseUuid(input.courseId, "courseId"));
      const { curriculum, version } = await pinnableVersion(course, input.curriculumVersionId);
      const plan = planCreateClassGroup({ ...input, course, curriculum, version }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertClassGroupQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    async updateClassGroup(
      user: AuthUser,
      classGroupId: unknown,
      input: Correlated & { readonly name?: unknown; readonly capacity?: unknown; readonly startsOn?: unknown; readonly endsOn?: unknown; readonly expectedRevision: unknown },
    ): Promise<ClassGroupRecord> {
      guard(user, "class_group.manage");
      const current = await loadClassGroup(classGroupId);
      const open = await executor.query(selectOpenEnrollmentsQuery(current.id));
      const plan = planUpdateClassGroup(current, { ...input, openEnrollments: open.length }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateClassGroupQuery(plan.record, current.revision), plan.audit)]);
      return plan.record;
    },

    async changeClassGroupStatus(
      user: AuthUser,
      classGroupId: unknown,
      input: Correlated & { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
    ): Promise<ClassGroupRecord> {
      guard(user, "class_group.manage");
      const current = await loadClassGroup(classGroupId);
      const plan = planClassGroupStatus(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateClassGroupQuery(plan.record, current.revision), plan.audit)]);
      return plan.record;
    },

    async repinCurriculum(
      user: AuthUser,
      classGroupId: unknown,
      input: Correlated & { readonly curriculumVersionId: unknown; readonly reason: unknown; readonly expectedRevision: unknown },
    ): Promise<ClassGroupRecord> {
      guard(user, "class_group.manage");
      const current = await loadClassGroup(classGroupId);
      const course = await loadCourse(current.courseId);
      if (input.curriculumVersionId === undefined || input.curriculumVersionId === null || input.curriculumVersionId === "") {
        throw new DomainError("VALIDATION", "curriculumVersionId is required.");
      }
      const { curriculum, version } = await pinnableVersion(course, input.curriculumVersionId);
      const [inUse, inVersion] = await Promise.all([
        executor.query(selectUpcomingLessonIdsQuery(current.id)).then(mapLessonIdSet),
        lessonIdsIn(version.id),
      ]);
      const plan = planRepinCurriculum(
        current,
        { course, curriculum, version, reason: input.reason, expectedRevision: input.expectedRevision, lessonIdsInUse: inUse, lessonIdsInVersion: inVersion },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(executor, [audited(deps, updateClassGroupQuery(plan.record, current.revision), plan.audit)]);
      return plan.record;
    },

    async deleteClassGroup(user: AuthUser, classGroupId: unknown, input: ReasonedRevision): Promise<ClassGroupRecord> {
      guard(user, "class_group.manage");
      const current = await loadClassGroup(classGroupId);
      assertRevision(current.revision, parseRequiredRevision(input.expectedRevision));
      if ((await executor.query(selectOpenEnrollmentsQuery(current.id))).length > 0) {
        throw new DomainError("CONFLICT", "End this class group's enrollments before deleting it.");
      }
      const ctx = contextFor(user, deps, input.correlationId);
      const result = softDelete(current, { kind: "class_group", id: current.id }, { ...ctx, reason: input.reason as string });
      const next = touched(result.record, current.revision, user.uid, now());
      await runGuarded(executor, [audited(deps, updateClassGroupQuery(next, current.revision), result.audit)]);
      return next;
    },

    async restoreClassGroup(user: AuthUser, classGroupId: unknown, input: ReasonedRevision): Promise<ClassGroupRecord> {
      guard(user, "class_group.manage");
      const current = await loadClassGroup(classGroupId);
      assertRevision(current.revision, parseRequiredRevision(input.expectedRevision));
      const ctx = contextFor(user, deps, input.correlationId);
      const result = restoreSoftDeleted(current, { kind: "class_group", id: current.id }, { ...ctx, reason: input.reason as string });
      const next = touched(result.record, current.revision, user.uid, now());
      await runGuarded(executor, [audited(deps, updateClassGroupQuery(next, current.revision), result.audit)]);
      return next;
    },

    // -- Teachers ------------------------------------------------------------

    async assignTeacher(user: AuthUser, classGroupId: unknown, input: Correlated & { readonly teacherUid: unknown }) {
      guard(user, "class_group.manage");
      const classGroup = await loadClassGroup(classGroupId);
      const teacher = await loadProfile(input.teacherUid, "teacherUid");
      const active = await loadMany(executor, listAssignmentsQuery(classGroup.id, true), mapAssignmentRow);
      const plan = planAssignTeacher({ classGroup, teacher, activeAssignments: active }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertAssignmentQuery(plan.record), plan.audit)], {
        unique: "This teacher is already assigned to the class group.",
      });
      return plan.record;
    },

    async unassignTeacher(
      user: AuthUser,
      classGroupId: unknown,
      input: Correlated & { readonly assignmentId: unknown; readonly reason: unknown },
    ) {
      guard(user, "class_group.manage");
      const classGroup = await loadClassGroup(classGroupId);
      const assignment = await loadOptional(executor, selectAssignmentQuery(parseUuid(input.assignmentId, "assignmentId")), mapAssignmentRow);
      const plan = planUnassignTeacher({ classGroup, assignment, reason: input.reason }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, unassignQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    // -- Sessions ------------------------------------------------------------

    async listSessions(user: AuthUser, classGroupId: unknown): Promise<SessionRecord[]> {
      guard(user, "session.manage");
      const classGroup = await loadClassGroup(classGroupId);
      return loadMany(executor, listSessionsQuery(classGroup.id), mapSessionRow);
    },

    async scheduleSession(
      user: AuthUser,
      classGroupId: unknown,
      input: Correlated & { readonly lessonId: unknown; readonly startsAt: unknown; readonly endsAt: unknown; readonly meetingUrl?: unknown },
    ): Promise<SessionRecord> {
      guard(user, "session.manage");
      const classGroup = await loadClassGroup(classGroupId);
      const lessons = await lessonIdsIn(classGroup.curriculumVersionId);
      const plan = planScheduleSession({ ...input, classGroup, lessonIdsInPinnedVersion: lessons }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertSessionQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    async rescheduleSession(
      user: AuthUser,
      sessionId: unknown,
      input: Correlated & { readonly startsAt: unknown; readonly endsAt: unknown; readonly meetingUrl?: unknown; readonly reason: unknown; readonly expectedRevision: unknown },
    ): Promise<SessionRecord> {
      guard(user, "session.manage");
      const current = await loadRequired(executor, selectSessionQuery(parseUuid(sessionId, "sessionId")), mapSessionRow, "Session not found.");
      const plan = planRescheduleSession(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateSessionQuery(plan.record, current), plan.audit)]);
      return plan.record;
    },

    async changeSessionStatus(
      user: AuthUser,
      sessionId: unknown,
      input: Correlated & { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
    ): Promise<SessionRecord> {
      guard(user, "session.manage");
      const current = await loadRequired(executor, selectSessionQuery(parseUuid(sessionId, "sessionId")), mapSessionRow, "Session not found.");
      const plan = planSessionStatus(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateSessionQuery(plan.record, current), plan.audit)]);
      return plan.record;
    },

    // -- Enrollments ---------------------------------------------------------

    async listEnrollments(user: AuthUser, classGroupId: unknown): Promise<EnrollmentRecord[]> {
      guard(user, "enrollment.manage");
      const classGroup = await loadClassGroup(classGroupId);
      return loadMany(executor, listEnrollmentsQuery(classGroup.id), mapEnrollmentRow);
    },

    async enroll(
      user: AuthUser,
      classGroupId: unknown,
      input: Correlated & { readonly learnerUid: unknown; readonly activate?: unknown },
    ): Promise<EnrollmentRecord> {
      guard(user, "enrollment.manage");
      const classGroup = await loadClassGroup(classGroupId);
      const learner = await loadProfile(input.learnerUid, "learnerUid");
      const open = (await executor.query(selectOpenEnrollmentsQuery(classGroup.id))).map((row) => ({
        learnerUid: String(row.learner_uid),
        state: row.state as EnrollmentRecord["state"],
      }));
      if (input.activate !== undefined && typeof input.activate !== "boolean") {
        throw new DomainError("VALIDATION", "activate must be true or false.");
      }
      const plan = planEnroll(
        { classGroup, learner, openEnrollmentsInGroup: open.filter((e) => OPEN_ENROLLMENT_STATES.includes(e.state)), activate: input.activate === true, source: "admin" },
        contextFor(user, deps, input.correlationId),
      );
      const statements: SqlQuery[] = [lockClassGroupQuery(classGroup.id), audited(deps, insertEnrollmentQuery(plan.record), plan.audit)];
      await runGuarded(executor, statements, { unique: "This learner is already enrolled in the class group." });
      return plan.record;
    },

    async changeEnrollmentStatus(
      user: AuthUser,
      enrollmentId: unknown,
      input: Correlated & { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
    ): Promise<EnrollmentRecord> {
      guard(user, "enrollment.manage");
      const current = await loadRequired(executor, selectEnrollmentQuery(parseUuid(enrollmentId, "enrollmentId")), mapEnrollmentRow, "Enrollment not found.");
      const plan = planEnrollmentStatus(current, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateEnrollmentQuery(plan.record, current), plan.audit)]);
      return plan.record;
    },
  };
}

export type DeliveryService = ReturnType<typeof createDeliveryService>;
