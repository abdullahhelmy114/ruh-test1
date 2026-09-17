/**
 * Attendance for sessions.
 *
 * Marks come from the academy's attendance vocabulary (policy
 * `attendance.vocabulary`, resolved for the course). Nothing here invents a
 * mark: an unconfigured vocabulary fails closed before this module is used.
 *
 * Each record snapshots whether its mark counted as attended when it was
 * recorded, so a later vocabulary change never silently rewrites history.
 *
 * Rules:
 *   - attendance is recorded only for a session that is live or completed;
 *   - only learners enrolled during the session can be marked;
 *   - the first mark is a recording; changing an existing mark is a
 *     correction and always needs a reason.
 */
import type { AuditActor, AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, systemClock, toIso, type Clock, type IdGenerator } from "../domain/ids.ts";
import type { AttendanceVocabulary } from "../policies/registry.ts";
import type { SessionRecord } from "../structure/delivery.ts";

export const MAX_MARKS_PER_REQUEST = 500;

export interface AttendanceRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly classGroupId: string;
  readonly learnerUid: string;
  readonly markCode: string;
  readonly countsAsAttended: boolean;
  readonly revision: number;
  readonly recordedBy: string;
  readonly recordedAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface MarkInput {
  readonly learnerUid: string;
  readonly code: string;
  readonly reason: string | null;
  readonly expectedRevision: number | null;
}

/** Parses `{ marks: [{ learnerUid, code, reason?, expectedRevision? }] }`. */
export function parseMarks(input: unknown): MarkInput[] {
  const marks = (input as { marks?: unknown } | null)?.marks;
  if (!Array.isArray(marks) || marks.length === 0 || marks.length > MAX_MARKS_PER_REQUEST) {
    throw new DomainError("VALIDATION", `marks must list 1 to ${MAX_MARKS_PER_REQUEST} entries.`);
  }
  const seen = new Set<string>();
  return marks.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new DomainError("VALIDATION", `marks[${index}] must be an object.`);
    const mark = raw as Record<string, unknown>;
    const learnerUid = parseUid(mark.learnerUid, `marks[${index}].learnerUid`);
    if (seen.has(learnerUid)) throw new DomainError("VALIDATION", "A learner appears twice in the same request.");
    seen.add(learnerUid);
    if (typeof mark.code !== "string" || mark.code.length === 0 || mark.code.length > 32) {
      throw new DomainError("VALIDATION", `marks[${index}].code is required.`);
    }
    let expectedRevision: number | null = null;
    if (mark.expectedRevision !== undefined && mark.expectedRevision !== null) {
      if (!Number.isInteger(mark.expectedRevision) || (mark.expectedRevision as number) < 1) {
        throw new DomainError("VALIDATION", `marks[${index}].expectedRevision must be a positive whole number.`);
      }
      expectedRevision = mark.expectedRevision as number;
    }
    const reason = typeof mark.reason === "string" && mark.reason.trim() !== "" ? mark.reason : null;
    return { learnerUid, code: mark.code, reason, expectedRevision };
  });
}

export interface AttendanceContext {
  readonly actor: AuditActor;
  readonly clock?: Clock;
  readonly newId?: IdGenerator;
  readonly correlationId?: string | null;
}

export interface AttendanceWrite {
  readonly record: AttendanceRecord;
  readonly previous: AttendanceRecord | null;
  readonly audit: AuditEventInput;
}

export interface RecordAttendanceInput {
  readonly session: SessionRecord;
  readonly vocabulary: AttendanceVocabulary;
  /** Learners whose enrollment overlapped the session. */
  readonly eligibleLearners: ReadonlySet<string>;
  /** Existing records for this session, by learner uid. */
  readonly existing: ReadonlyMap<string, AttendanceRecord>;
  readonly marks: readonly MarkInput[];
}

export function planRecordAttendance(input: RecordAttendanceInput, ctx: AttendanceContext): AttendanceWrite[] {
  const session = input.session;
  if (session.state !== "live" && session.state !== "completed") {
    throw new DomainError("CONFLICT", "Attendance can be recorded once the session has started.");
  }
  const actorUid = parseUid(ctx.actor.uid, "actor");
  const now = toIso((ctx.clock ?? systemClock)());
  const byCode = new Map(input.vocabulary.marks.map((mark) => [mark.code, mark]));
  const writes: AttendanceWrite[] = [];

  for (const mark of input.marks) {
    const definition = byCode.get(mark.code);
    if (!definition) throw new DomainError("VALIDATION", `"${mark.code}" is not an attendance mark used by this course.`);
    if (!input.eligibleLearners.has(mark.learnerUid)) {
      throw new DomainError("VALIDATION", "Attendance can only be recorded for learners enrolled during the session.");
    }
    const previous = input.existing.get(mark.learnerUid) ?? null;

    if (!previous) {
      if (mark.expectedRevision !== null) {
        throw new DomainError("CONFLICT", "This attendance was changed by someone else. Reload and try again.");
      }
      const record: AttendanceRecord = Object.freeze({
        id: (ctx.newId ?? defaultIdGenerator)(),
        sessionId: session.id,
        classGroupId: session.classGroupId,
        learnerUid: mark.learnerUid,
        markCode: definition.code,
        countsAsAttended: definition.countsAsAttended,
        revision: 1,
        recordedBy: actorUid,
        recordedAt: now,
        updatedBy: actorUid,
        updatedAt: now,
      });
      writes.push({
        record,
        previous: null,
        audit: {
          actor: ctx.actor,
          action: "attendance.record",
          object: { kind: "attendance_record", id: record.id },
          correlationId: ctx.correlationId ?? null,
          metadata: { sessionId: session.id, learnerUid: mark.learnerUid, markCode: record.markCode },
        },
      });
      continue;
    }

    if (mark.expectedRevision !== previous.revision) {
      throw new DomainError("CONFLICT", "This attendance was changed by someone else. Reload and try again.");
    }
    if (previous.markCode === definition.code) continue; // unchanged
    const reason = requireReason(mark.reason);
    const record: AttendanceRecord = Object.freeze({
      ...previous,
      markCode: definition.code,
      countsAsAttended: definition.countsAsAttended,
      revision: previous.revision + 1,
      updatedBy: actorUid,
      updatedAt: now,
    });
    writes.push({
      record,
      previous,
      audit: {
        actor: ctx.actor,
        action: "attendance.correct",
        object: { kind: "attendance_record", id: record.id },
        reason,
        correlationId: ctx.correlationId ?? null,
        metadata: { sessionId: session.id, learnerUid: mark.learnerUid, fromCode: previous.markCode, toCode: record.markCode },
      },
    });
  }
  return writes;
}

export interface AttendanceSummary {
  readonly recordedSessions: number;
  readonly attendedSessions: number;
  /** null when nothing has been recorded yet. */
  readonly attendedRatio: number | null;
}

export function summariseAttendance(records: readonly Pick<AttendanceRecord, "countsAsAttended">[]): AttendanceSummary {
  const attended = records.filter((r) => r.countsAsAttended).length;
  return {
    recordedSessions: records.length,
    attendedSessions: attended,
    attendedRatio: records.length === 0 ? null : attended / records.length,
  };
}
