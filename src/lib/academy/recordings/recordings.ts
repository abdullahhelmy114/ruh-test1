/**
 * Session recordings.
 *
 * Lifecycle (domain/states.ts): processing -> in review -> published, with
 * failed, restricted and archived states. Only administrators manage
 * recordings (recording.manage).
 *
 * Who may watch:
 *   - administrators and the class group's assigned teachers: any recording
 *     that is not archived, to review it;
 *   - learners: only a PUBLISHED recording of a class group where they are
 *     active, only when the course's `recordings.access` policy gives
 *     enrolled learners access, and only inside its availability window,
 *     counted from publication.
 * The media link is returned only when the caller may watch.
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, optionalReason, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, systemClock, toIso } from "../domain/ids.ts";
import { RECORDING_MACHINE, assertTransition, parseState, type RecordingState } from "../domain/states.ts";
import { assertRevision, parseOptionalHttpsUrl, parseOptionalInt, parseRequiredRevision, parseTitle } from "../domain/text.ts";
import type { RecordingAccessPolicy } from "../policies/registry.ts";
import type { Planned, StructureContext } from "../structure/catalog.ts";
import type { SessionRecord } from "../structure/delivery.ts";

export interface RecordingRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly classGroupId: string;
  readonly courseId: string;
  readonly title: string;
  readonly mediaUrl: string;
  readonly durationSeconds: number | null;
  readonly state: RecordingState;
  readonly stateReason: string | null;
  readonly publishedAt: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export function planCreateRecording(
  input: { readonly session: SessionRecord; readonly courseId: string; readonly title: unknown; readonly mediaUrl: unknown; readonly durationSeconds?: unknown },
  ctx: StructureContext,
): Planned<RecordingRecord> {
  if (input.session.state !== "live" && input.session.state !== "completed") {
    throw new DomainError("CONFLICT", "A recording can only be added to a session that has taken place.");
  }
  const mediaUrl = parseOptionalHttpsUrl(input.mediaUrl, "mediaUrl");
  if (!mediaUrl) throw new DomainError("VALIDATION", "mediaUrl is required.");
  const uid = parseUid(ctx.actor.uid, "actor");
  const at = toIso((ctx.clock ?? systemClock)());
  const record: RecordingRecord = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    sessionId: input.session.id,
    classGroupId: input.session.classGroupId,
    courseId: input.courseId,
    title: parseTitle(input.title, "title"),
    mediaUrl,
    durationSeconds: parseOptionalInt(input.durationSeconds, "durationSeconds", 1, 86_400),
    state: RECORDING_MACHINE.initial,
    stateReason: null,
    publishedAt: null,
    revision: 1,
    createdBy: uid,
    createdAt: at,
    updatedBy: uid,
    updatedAt: at,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "recording.create",
      object: { kind: "recording", id: record.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [{ change: "linked", relationship: "session_recordings", from: { kind: "session", id: record.sessionId }, to: { kind: "recording", id: record.id } }],
      metadata: { classGroupId: record.classGroupId, title: record.title },
    },
  };
}

const REASONED: readonly RecordingState[] = ["failed", "restricted", "archived"];

export function planRecordingStatus(
  recording: RecordingRecord,
  input: { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<RecordingRecord> {
  assertRevision(recording.revision, parseRequiredRevision(input.expectedRevision));
  const to = parseState(RECORDING_MACHINE, input.to);
  assertTransition(RECORDING_MACHINE, recording.state, to);
  const reason = REASONED.includes(to) ? requireReason(input.reason) : optionalReason(input.reason);
  const at = toIso((ctx.clock ?? systemClock)());
  const record: RecordingRecord = Object.freeze({
    ...recording,
    state: to,
    stateReason: reason,
    // Availability counts from the first publication; re-publishing after a restriction keeps it.
    publishedAt: to === "published" && recording.publishedAt === null ? at : recording.publishedAt,
    revision: recording.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: at,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "recording.change_status",
      object: { kind: "recording", id: recording.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { from: recording.state, to, revision: record.revision },
    },
  };
}

export type WatchDecision =
  | { readonly allowed: true; readonly downloadAllowed: boolean; readonly availableUntil: string | null }
  | { readonly allowed: false; readonly reason: "not_published" | "no_learner_access" | "expired" };

/** The learner rule. Staff viewing is decided by permissions before this is consulted. */
export function learnerWatchDecision(recording: RecordingRecord, policy: RecordingAccessPolicy, now: Date): WatchDecision {
  if (recording.state !== "published" || recording.publishedAt === null) return { allowed: false, reason: "not_published" };
  if (policy.learnerAccess !== "enrolled_learners") return { allowed: false, reason: "no_learner_access" };
  let availableUntil: string | null = null;
  if (policy.availableForDays !== null) {
    const until = Date.parse(recording.publishedAt) + policy.availableForDays * 86_400_000;
    if (now.getTime() > until) return { allowed: false, reason: "expired" };
    availableUntil = new Date(until).toISOString();
  }
  return { allowed: true, downloadAllowed: policy.downloadAllowed, availableUntil };
}

/** What a viewer receives. The media link is present only when watching is allowed. */
export function recordingView(recording: RecordingRecord, decision: WatchDecision | { readonly staff: true }) {
  const staff = "staff" in decision;
  const allowed = staff || decision.allowed;
  return {
    id: recording.id,
    sessionId: recording.sessionId,
    classGroupId: recording.classGroupId,
    title: recording.title,
    durationSeconds: recording.durationSeconds,
    state: staff ? recording.state : undefined,
    // Staff need the revision to change a recording's state; learners never do.
    revision: staff ? recording.revision : undefined,
    publishedAt: recording.publishedAt,
    mediaUrl: allowed ? recording.mediaUrl : null,
    downloadAllowed: staff ? true : decision.allowed ? decision.downloadAllowed : false,
    availableUntil: !staff && decision.allowed ? decision.availableUntil : null,
    unavailableReason: !staff && !decision.allowed ? decision.reason : null,
  };
}
