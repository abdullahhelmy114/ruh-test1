/**
 * Teacher preparation for a session.
 *
 * Each assigned teacher tracks their own preparation for a session
 * (not started, in progress, ready) with optional private notes. The status
 * is visible to administrators so they can see which sessions are ready;
 * the notes belong to the teacher alone and are never returned to anyone
 * else.
 *
 * Preparation opens when the session's Lesson Sheet is released to the
 * teacher (the locked release rule); services enforce that gate.
 */
import { DomainError } from "../domain/errors.ts";
import { parseUid, systemClock, toIso, type Clock } from "../domain/ids.ts";
import { PREPARATION_MACHINE, assertTransition, parseState, type PreparationState } from "../domain/states.ts";
import { assertRevision, parseRequiredRevision } from "../domain/text.ts";

export const MAX_PREPARATION_NOTES = 10_000;

export interface PreparationRecord {
  readonly sessionId: string;
  readonly teacherUid: string;
  readonly status: PreparationState;
  readonly privateNotes: string | null;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly readyAt: string | null;
}

/** What administrators may see about a teacher's preparation. */
export interface PreparationStatusView {
  readonly sessionId: string;
  readonly teacherUid: string;
  readonly status: PreparationState;
  readonly updatedAt: string;
  readonly readyAt: string | null;
}

export function toStatusView(record: PreparationRecord): PreparationStatusView {
  return Object.freeze({
    sessionId: record.sessionId,
    teacherUid: record.teacherUid,
    status: record.status,
    updatedAt: record.updatedAt,
    readyAt: record.readyAt,
  });
}

function parseNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new DomainError("VALIDATION", "Notes must be text.");
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_PREPARATION_NOTES) {
    throw new DomainError("VALIDATION", `Notes can have at most ${MAX_PREPARATION_NOTES} characters.`);
  }
  return trimmed;
}

/** A fresh, unsaved preparation record for a teacher who has not started yet. */
export function emptyPreparation(sessionId: string, teacherUid: string, at: string): PreparationRecord {
  return Object.freeze({
    sessionId,
    teacherUid,
    status: PREPARATION_MACHINE.initial,
    privateNotes: null,
    revision: 0,
    createdAt: at,
    updatedAt: at,
    readyAt: null,
  });
}

export function planUpdatePreparation(
  current: PreparationRecord,
  input: { readonly status?: unknown; readonly privateNotes?: unknown; readonly expectedRevision: unknown },
  ctx: { readonly teacherUid: string; readonly clock?: Clock },
): PreparationRecord {
  const teacherUid = parseUid(ctx.teacherUid, "teacher");
  if (current.teacherUid !== teacherUid) throw new DomainError("NOT_FOUND", "Preparation not found.");
  const expected = input.expectedRevision === 0 ? 0 : parseRequiredRevision(input.expectedRevision);
  assertRevision(current.revision, expected);

  let status = current.status;
  if (input.status !== undefined) {
    const to = parseState(PREPARATION_MACHINE, input.status);
    if (to !== current.status) {
      assertTransition(PREPARATION_MACHINE, current.status, to);
      status = to;
    }
  }
  const privateNotes = input.privateNotes === undefined ? current.privateNotes : parseNotes(input.privateNotes);
  if (status === current.status && privateNotes === current.privateNotes) {
    throw new DomainError("VALIDATION", "Nothing to change.");
  }
  const now = toIso((ctx.clock ?? systemClock)());
  return Object.freeze({
    ...current,
    status,
    privateNotes,
    revision: current.revision + 1,
    updatedAt: now,
    readyAt: status === "ready" ? (current.status === "ready" ? current.readyAt : now) : null,
  });
}
