/**
 * Attendance: teachers and administrators record marks for a session;
 * learners read only their own attendance.
 *
 * The mark vocabulary is the academy's `attendance.vocabulary` policy
 * resolved for the session's course (ACADEMY -> PROGRAM -> COURSE). If it
 * is not configured, recording fails closed.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { parseMarks, planRecordAttendance, summariseAttendance, type AttendanceRecord } from "../learning/attendance.ts";
import { authorize, type RelationshipFacts } from "../permissions/permissions.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import { mapClassGroupRow, mapSessionRow, selectClassGroupQuery, selectSessionQuery } from "../repo/delivery-repo.ts";
import type { AttendanceVocabulary } from "../policies/registry.ts";
import {
  insertAttendanceQuery,
  mapAttendanceRow,
  selectEligibleLearnerNamesQuery,
  selectEligibleLearnersQuery,
  selectOwnClassGroupAttendanceQuery,
  selectOwnSessionAttendanceQuery,
  selectSessionAttendanceQuery,
  updateAttendanceQuery,
} from "../repo/participation-repo.ts";
import { iso, str, strOrNull } from "../repo/rows.ts";
import { effectivePolicy } from "./policy-lookup.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

export interface AttendanceDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
}

export function createAttendanceService(deps: AttendanceDeps) {
  const { executor, facts } = deps;

  async function loadSessionFor(user: AuthUser, sessionId: unknown) {
    const session = await loadOptional(executor, selectSessionQuery(parseUuid(sessionId, "sessionId")), mapSessionRow);
    if (!session) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Session not found.");
      throw new AuthError("FORBIDDEN");
    }
    return session;
  }

  /** The mark vocabulary to display, or null while the academy has not configured it (recording then fails closed). */
  async function displayVocabulary(courseId: string): Promise<AttendanceVocabulary | null> {
    const course = await loadRequired(executor, selectCourseQuery(courseId), mapCourseRow, "Course not found.");
    try {
      return await effectivePolicy(executor, "attendance.vocabulary", { programId: course.programId, courseId: course.id });
    } catch (error) {
      if (error instanceof DomainError && error.code === "POLICY_UNCONFIGURED") return null;
      throw error;
    }
  }

  return {
    /**
     * Teachers and administrators: every mark for the session, the learners who
     * can be marked (names only) and the mark vocabulary.
     * Learners: only their own mark, with the vocabulary to read it.
     */
    async sessionAttendance(user: AuthUser, sessionId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const session = await loadSessionFor(user, sessionId);
      if (user.role === "student") {
        const group = await loadRequired(executor, selectClassGroupQuery(session.classGroupId), mapClassGroupRow, "Class group not found.");
        await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
        const [own, vocabulary] = await Promise.all([
          loadMany(executor, selectOwnSessionAttendanceQuery(session.id, user.uid), mapAttendanceRow),
          displayVocabulary(group.courseId),
        ]);
        return { sessionId: session.id, records: own.map(learnerView), vocabulary };
      }
      await authorize(user, { action: "attendance.record", classGroupId: session.classGroupId }, facts);
      const group = await loadRequired(executor, selectClassGroupQuery(session.classGroupId), mapClassGroupRow, "Class group not found.");
      const [records, learnerRows, vocabulary] = await Promise.all([
        loadMany(executor, selectSessionAttendanceQuery(session.id), mapAttendanceRow),
        executor.query(selectEligibleLearnerNamesQuery(session.classGroupId, session.startsAt, session.endsAt)),
        displayVocabulary(group.courseId),
      ]);
      return {
        sessionId: session.id,
        sessionState: session.state,
        records,
        learners: learnerRows.map((row) => ({ uid: str(row.learner_uid), displayName: strOrNull(row.full_name) })),
        vocabulary,
      };
    },

    async recordAttendance(
      user: AuthUser,
      sessionId: unknown,
      input: { readonly marks: unknown; readonly correlationId?: string | null },
    ): Promise<{ written: AttendanceRecord[]; unchanged: number }> {
      assertAcademyCoreAvailable(deps.flags);
      const session = await loadSessionFor(user, sessionId);
      await authorize(user, { action: "attendance.record", classGroupId: session.classGroupId }, facts);
      const marks = parseMarks({ marks: input.marks });

      const group = await loadRequired(executor, selectClassGroupQuery(session.classGroupId), mapClassGroupRow, "Class group not found.");
      const course = await loadRequired(executor, selectCourseQuery(group.courseId), mapCourseRow, "Course not found.");
      const vocabulary = await effectivePolicy(executor, "attendance.vocabulary", { programId: course.programId, courseId: course.id });

      const [eligibleRows, existingRecords] = await Promise.all([
        executor.query(selectEligibleLearnersQuery(session.classGroupId, session.startsAt, session.endsAt)),
        loadMany(executor, selectSessionAttendanceQuery(session.id), mapAttendanceRow),
      ]);
      const writes = planRecordAttendance(
        {
          session,
          vocabulary,
          eligibleLearners: new Set(eligibleRows.map((row) => str(row.learner_uid))),
          existing: new Map(existingRecords.map((record) => [record.learnerUid, record])),
          marks,
        },
        contextFor(user, deps, input.correlationId),
      );
      if (writes.length > 0) {
        const statements: SqlQuery[] = writes.map((write) =>
          audited(deps, write.previous ? updateAttendanceQuery(write.record, write.previous.revision) : insertAttendanceQuery(write.record), write.audit),
        );
        await runGuarded(executor, statements, { unique: "Attendance was recorded by someone else at the same time. Reload and try again." });
      }
      return { written: writes.map((w) => w.record), unchanged: marks.length - writes.length };
    },

    /** A learner's own attendance in one class group, with a summary. */
    async myAttendance(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      if (user.role !== "student") throw new AuthError("FORBIDDEN");
      const id = parseUuid(classGroupId, "classGroupId");
      const rows = await executor.query(selectOwnClassGroupAttendanceQuery(user.uid, id));
      const records = rows.map((row) => ({
        sessionId: str(row.session_id),
        lessonTitle: str(row.lesson_title),
        sessionStartsAt: iso(row.starts_at),
        markCode: str(row.mark_code),
        countsAsAttended: row.counts_as_attended === true,
      }));
      return { classGroupId: id, records, summary: summariseAttendance(records) };
    },
  };
}

/** Learners see their mark, not who recorded it. */
function learnerView(record: AttendanceRecord) {
  return {
    sessionId: record.sessionId,
    markCode: record.markCode,
    countsAsAttended: record.countsAsAttended,
    updatedAt: record.updatedAt,
  };
}

export type AttendanceService = ReturnType<typeof createAttendanceService>;
