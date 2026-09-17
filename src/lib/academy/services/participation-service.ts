/**
 * The learner's and the teacher's core workflow: what am I learning or
 * teaching, what comes next, who is in my class, and running a session.
 *
 * Meeting links are returned only to active learners and assigned teachers
 * of the class group, and only for sessions that are still ahead or live.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid, systemClock } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlRow } from "../infra/sql.ts";
import { authorize, evaluateAccess, type RelationshipFacts } from "../permissions/permissions.ts";
import { mapOutline, selectOutlineLessonsQuery, selectOutlineUnitsQuery } from "../repo/curriculum-repo.ts";
import { mapClassGroupRow, mapSessionRow, selectClassGroupQuery, selectSessionQuery, updateSessionQuery } from "../repo/delivery-repo.ts";
import { selectLessonTitleQuery } from "../repo/lesson-repo.ts";
import {
  selectClassGroupSessionsWithTitlesQuery,
  selectClassGroupTeachersQuery,
  selectCourseTitleQuery,
  selectLearnerClassGroupsQuery,
  selectLearnerUpcomingSessionsQuery,
  selectRosterQuery,
  selectTeacherClassGroupsQuery,
  selectTeacherUpcomingSessionsQuery,
} from "../repo/participation-repo.ts";
import { iso, num, str, strOrNull } from "../repo/rows.ts";
import { planSessionStatus, type ClassGroupRecord } from "../structure/delivery.ts";
import { audited, contextFor, loadOptional, runGuarded, type ServiceDeps } from "./support.ts";

export interface ParticipationDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
}

export const CONDUCT_ACTIONS = ["start", "complete"] as const;
export type ConductAction = (typeof CONDUCT_ACTIONS)[number];

function classGroupSummary(row: SqlRow) {
  return {
    id: str(row.class_group_id),
    name: str(row.class_group_name),
    status: str(row.class_group_status),
    startsOn: strOrNull(row.starts_on),
    endsOn: strOrNull(row.ends_on),
  };
}

function sessionSummary(row: SqlRow, includeMeetingLink: boolean) {
  const state = str(row.state);
  return {
    id: str(row.id),
    classGroupId: row.class_group_id === undefined ? undefined : str(row.class_group_id),
    lessonId: str(row.lesson_id),
    lessonTitle: str(row.lesson_title),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    state,
    meetingUrl: includeMeetingLink && (state === "scheduled" || state === "live") ? strOrNull(row.meeting_url) : null,
  };
}

export function createParticipationService(deps: ParticipationDeps) {
  const { executor, facts } = deps;
  const now = () => (deps.clock ?? systemClock)();

  async function loadVisibleClassGroup(user: AuthUser, classGroupId: unknown): Promise<ClassGroupRecord> {
    const id = parseUuid(classGroupId, "classGroupId");
    const group = await loadOptional(executor, selectClassGroupQuery(id), mapClassGroupRow);
    if (!group || group.deletedAt !== null) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Class group not found.");
      throw new AuthError("FORBIDDEN");
    }
    return group;
  }

  return {
    /** Learner home: my class groups and my upcoming sessions. */
    async myLearning(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      if (user.role !== "student") throw new AuthError("FORBIDDEN");
      const [groups, sessions] = await Promise.all([
        executor.query(selectLearnerClassGroupsQuery(user.uid)),
        executor.query(selectLearnerUpcomingSessionsQuery(user.uid, now().toISOString())),
      ]);
      return {
        classGroups: groups.map((row) => ({
          enrollmentId: str(row.enrollment_id),
          enrollmentState: str(row.enrollment_state),
          classGroup: classGroupSummary(row),
          course: { id: str(row.course_id), title: str(row.course_title) },
        })),
        // The query only returns sessions of class groups where the caller is an active learner.
        upcomingSessions: sessions.map((row) => sessionSummary(row, true)),
      };
    },

    /** Teacher home: class groups I teach and my upcoming sessions with preparation status. */
    async myTeaching(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      if (user.role !== "teacher") throw new AuthError("FORBIDDEN");
      const [groups, sessions] = await Promise.all([
        executor.query(selectTeacherClassGroupsQuery(user.uid)),
        executor.query(selectTeacherUpcomingSessionsQuery(user.uid, now().toISOString())),
      ]);
      return {
        classGroups: groups.map((row) => ({
          classGroup: classGroupSummary(row),
          course: { id: str(row.course_id), title: str(row.course_title) },
          activeLearners: num(row.active_learners),
        })),
        upcomingSessions: sessions.map((row) => ({
          ...sessionSummary(row, true),
          preparationStatus: strOrNull(row.preparation_status) ?? "not_started",
        })),
      };
    },

    /** Class group overview for its participants: outline titles and sessions. */
    async classGroupDetail(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadVisibleClassGroup(user, classGroupId);
      await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
      const [courseRows, unitRows, lessonRows, sessionRows, teacherRows] = await Promise.all([
        executor.query(selectCourseTitleQuery(group.courseId)),
        executor.query(selectOutlineUnitsQuery(group.curriculumVersionId)),
        executor.query(selectOutlineLessonsQuery(group.curriculumVersionId)),
        executor.query(selectClassGroupSessionsWithTitlesQuery(group.id)),
        executor.query(selectClassGroupTeachersQuery(group.id)),
      ]);
      const outline = mapOutline(unitRows, lessonRows);
      return {
        classGroup: {
          id: group.id,
          name: group.name,
          status: group.status,
          startsOn: group.startsOn,
          endsOn: group.endsOn,
        },
        course: courseRows[0] ? { id: str(courseRows[0].id), title: str(courseRows[0].title) } : null,
        outline: outline.units.map((unit) => ({
          unitId: unit.unitId,
          title: unit.title,
          lessons: unit.lessons.map((lesson) => ({ lessonId: lesson.lessonId, title: lesson.title, plannedMinutes: lesson.plannedMinutes })),
        })),
        // authorize() above admitted only active learners, assigned teachers and administrators.
        sessions: sessionRows.map((row) => sessionSummary(row, true)),
        // Names only: the uid is what a participant needs to open a conversation.
        teachers: teacherRows.map((row) => ({ uid: str(row.teacher_uid), displayName: strOrNull(row.full_name) })),
      };
    },

    /**
     * One session for its participants: when and what, the meeting link while
     * it is ahead or live, and which session actions the caller may take (the
     * same decisions the write endpoints enforce).
     */
    async sessionDetail(user: AuthUser, sessionId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const id = parseUuid(sessionId, "sessionId");
      const session = await loadOptional(executor, selectSessionQuery(id), mapSessionRow);
      if (!session) {
        if (user.role === "admin") throw new DomainError("NOT_FOUND", "Session not found.");
        throw new AuthError("FORBIDDEN");
      }
      const group = await loadVisibleClassGroup(user, session.classGroupId);
      await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
      const [titleRows, conduct, prepare] = await Promise.all([
        executor.query(selectLessonTitleQuery(session.lessonId, session.curriculumVersionId)),
        evaluateAccess(user, { action: "session.conduct", classGroupId: group.id }, facts),
        evaluateAccess(user, { action: "session.prepare", classGroupId: group.id }, facts),
      ]);
      const live = session.state === "scheduled" || session.state === "live";
      return {
        session: {
          id: session.id,
          classGroupId: group.id,
          lessonId: session.lessonId,
          lessonTitle: titleRows[0] ? str(titleRows[0].title) : null,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          state: session.state,
          meetingUrl: live ? session.meetingUrl : null,
          // Staff need the revision to start or complete the session.
          revision: conduct.allowed ? session.revision : null,
        },
        classGroup: { id: group.id, name: group.name, courseId: group.courseId },
        permissions: { conduct: conduct.allowed, prepare: prepare.allowed, recordAttendance: conduct.allowed },
      };
    },

    /** Roster for the class group's teachers and administrators: names only. */
    async roster(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadVisibleClassGroup(user, classGroupId);
      await authorize(user, { action: "class_group.read_roster", classGroupId: group.id }, facts);
      const rows = await executor.query(selectRosterQuery(group.id));
      return rows.map((row) => ({
        enrollmentId: str(row.enrollment_id),
        learnerUid: str(row.learner_uid),
        displayName: strOrNull(row.full_name),
        enrollmentState: str(row.state),
      }));
    },

    /** Starts or completes a session (assigned teachers and administrators). */
    async conductSession(
      user: AuthUser,
      sessionId: unknown,
      input: { readonly action: unknown; readonly expectedRevision: unknown; readonly correlationId?: string | null },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      if (typeof input.action !== "string" || !(CONDUCT_ACTIONS as readonly string[]).includes(input.action)) {
        throw new DomainError("VALIDATION", "action must be start or complete.");
      }
      const id = parseUuid(sessionId, "sessionId");
      const session = await loadOptional(executor, selectSessionQuery(id), mapSessionRow);
      if (!session) {
        if (user.role === "admin") throw new DomainError("NOT_FOUND", "Session not found.");
        throw new AuthError("FORBIDDEN");
      }
      const decision = await evaluateAccess(user, { action: "session.conduct", classGroupId: session.classGroupId }, facts);
      if (!decision.allowed) throw new AuthError("FORBIDDEN");
      const to = input.action === "start" ? "live" : "completed";
      const plan = planSessionStatus(session, { to, expectedRevision: input.expectedRevision }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateSessionQuery(plan.record, session), plan.audit)]);
      return plan.record;
    },
  };
}

export type ParticipationService = ReturnType<typeof createParticipationService>;
