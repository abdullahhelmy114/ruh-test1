/**
 * Relationship-based messaging, announcements and in-app notifications.
 *
 * Messaging rules (enforced by services with relationship facts and policy):
 *   - nobody messages themselves;
 *   - administrators may message anyone and anyone may message an
 *     administrator;
 *   - a learner and a teacher may message only inside a class group where
 *     the teacher is assigned and the learner is active, and only in the
 *     directions the course's `communications.messaging` policy allows;
 *   - learner-to-learner and teacher-to-teacher messaging is not offered.
 * Messages are append-only records.
 *
 * Notifications never contain message text or private content: they name
 * what happened and link to where it can be read with normal access checks.
 */
import { AuthError, type AuthUser, type Role } from "../../auth/core.ts";
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, systemClock, toIso, type Clock, type IdGenerator } from "../domain/ids.ts";
import { assertRevision, parseRequiredRevision, parseTitle } from "../domain/text.ts";
import type { MessagingPolicy } from "../policies/registry.ts";
import type { StructureContext } from "../structure/catalog.ts";

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_ANNOUNCEMENT_BODY = 20_000;

export interface ThreadRecord {
  readonly id: string;
  readonly participantLowUid: string;
  readonly participantHighUid: string;
  readonly classGroupId: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly lastMessageAt: string | null;
}

export interface MessageRecord {
  readonly id: string;
  readonly threadId: string;
  readonly senderUid: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface Participant {
  readonly uid: string;
  readonly role: Role;
}

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function isParticipant(thread: ThreadRecord, uid: string): boolean {
  return thread.participantLowUid === uid || thread.participantHighUid === uid;
}

export function otherParticipant(thread: ThreadRecord, uid: string): string {
  return thread.participantLowUid === uid ? thread.participantHighUid : thread.participantLowUid;
}

export type MessagingContextNeed = "none" | "class_group";

/**
 * Which pairs may talk at all, and whether a class group context is needed.
 * Throws FORBIDDEN for pairs the product does not offer.
 */
export function messagingRequirement(sender: Participant, recipient: Participant): MessagingContextNeed {
  if (sender.uid === recipient.uid) throw new DomainError("VALIDATION", "You cannot message yourself.");
  if (sender.role === "admin" || recipient.role === "admin") return "none";
  const pair = new Set([sender.role, recipient.role]);
  if (pair.has("student") && pair.has("teacher")) return "class_group";
  throw new AuthError("FORBIDDEN");
}

/** Applies the course policy direction for learner/teacher messaging (it can only restrict). */
export function assertPolicyAllows(sender: Participant, recipient: Participant, policy: MessagingPolicy): void {
  if (sender.role === "student" && recipient.role === "teacher" && !policy.learnerMayMessageTeacher) throw new AuthError("FORBIDDEN");
  if (sender.role === "teacher" && recipient.role === "student" && !policy.teacherMayMessageLearner) throw new AuthError("FORBIDDEN");
}

export function planOpenThread(
  input: { readonly sender: AuthUser; readonly recipientUid: string; readonly classGroupId: string | null },
  ctx: { readonly clock?: Clock; readonly newId?: IdGenerator },
): ThreadRecord {
  const [low, high] = orderedPair(parseUid(input.sender.uid, "sender"), parseUid(input.recipientUid, "recipientUid"));
  return Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    participantLowUid: low,
    participantHighUid: high,
    classGroupId: input.classGroupId,
    createdBy: input.sender.uid,
    createdAt: toIso((ctx.clock ?? systemClock)()),
    lastMessageAt: null,
  });
}

export function planMessage(
  input: { readonly thread: ThreadRecord; readonly senderUid: string; readonly body: unknown },
  ctx: { readonly clock?: Clock; readonly newId?: IdGenerator },
): MessageRecord {
  if (!isParticipant(input.thread, input.senderUid)) throw new DomainError("NOT_FOUND", "Conversation not found.");
  if (typeof input.body !== "string") throw new DomainError("VALIDATION", "A message needs text.");
  const body = input.body.replace(/\r\n?/g, "\n").trim();
  if (body.length === 0) throw new DomainError("VALIDATION", "A message needs text.");
  if (body.length > MAX_MESSAGE_LENGTH) throw new DomainError("VALIDATION", `A message can have at most ${MAX_MESSAGE_LENGTH} characters.`);
  return Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    threadId: input.thread.id,
    senderUid: input.senderUid,
    body,
    createdAt: toIso((ctx.clock ?? systemClock)()),
  });
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export const ANNOUNCEMENT_SCOPES = ["academy", "course", "class_group"] as const;
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];

export interface AnnouncementRecord {
  readonly id: string;
  readonly scope: AnnouncementScope;
  readonly courseId: string | null;
  readonly classGroupId: string | null;
  readonly title: string;
  readonly body: string;
  readonly authorUid: string;
  readonly state: "published" | "withdrawn";
  readonly publishedAt: string;
  readonly withdrawnAt: string | null;
  readonly withdrawnBy: string | null;
  readonly withdrawReason: string | null;
  readonly revision: number;
}

function parseBody(value: unknown): string {
  if (typeof value !== "string") throw new DomainError("VALIDATION", "The announcement needs text.");
  const body = value.replace(/\r\n?/g, "\n").trim();
  if (body.length === 0) throw new DomainError("VALIDATION", "The announcement needs text.");
  if (body.length > MAX_ANNOUNCEMENT_BODY) throw new DomainError("VALIDATION", `An announcement can have at most ${MAX_ANNOUNCEMENT_BODY} characters.`);
  return body;
}

export function planPublishAnnouncement(
  input: {
    readonly scope: AnnouncementScope;
    readonly courseId: string | null;
    readonly classGroupId: string | null;
    readonly title: unknown;
    readonly body: unknown;
  },
  ctx: StructureContext,
): { readonly record: AnnouncementRecord; readonly audit: AuditEventInput } {
  if (input.scope === "academy" && (input.courseId !== null || input.classGroupId !== null)) throw new DomainError("VALIDATION", "Invalid announcement scope.");
  if (input.scope === "course" && (input.courseId === null || input.classGroupId !== null)) throw new DomainError("VALIDATION", "Invalid announcement scope.");
  if (input.scope === "class_group" && (input.courseId === null || input.classGroupId === null)) throw new DomainError("VALIDATION", "Invalid announcement scope.");
  const record: AnnouncementRecord = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    scope: input.scope,
    courseId: input.courseId,
    classGroupId: input.classGroupId,
    title: parseTitle(input.title, "title"),
    body: parseBody(input.body),
    authorUid: parseUid(ctx.actor.uid, "actor"),
    state: "published",
    publishedAt: toIso((ctx.clock ?? systemClock)()),
    withdrawnAt: null,
    withdrawnBy: null,
    withdrawReason: null,
    revision: 1,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "announcement.publish",
      object: { kind: "announcement", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { scope: record.scope, courseId: record.courseId, classGroupId: record.classGroupId, title: record.title },
    },
  };
}

export function planWithdrawAnnouncement(
  announcement: AnnouncementRecord,
  input: { readonly reason: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): { readonly record: AnnouncementRecord; readonly audit: AuditEventInput } {
  const actorUid = parseUid(ctx.actor.uid, "actor");
  if (ctx.actor.role !== "admin" && announcement.authorUid !== actorUid) throw new AuthError("FORBIDDEN");
  assertRevision(announcement.revision, parseRequiredRevision(input.expectedRevision));
  if (announcement.state !== "published") throw new DomainError("CONFLICT", "This announcement has already been withdrawn.");
  const reason = requireReason(input.reason);
  const record: AnnouncementRecord = Object.freeze({
    ...announcement,
    state: "withdrawn",
    withdrawnAt: toIso((ctx.clock ?? systemClock)()),
    withdrawnBy: actorUid,
    withdrawReason: reason,
    revision: announcement.revision + 1,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "announcement.withdraw",
      object: { kind: "announcement", id: announcement.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { scope: announcement.scope },
    },
  };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATION_KINDS = ["message", "announcement", "assessment_result", "assessment_returned"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationRecord {
  readonly id: string;
  readonly recipientUid: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly link: string | null;
  readonly sourceId: string;
  readonly createdAt: string;
  readonly readAt: string | null;
}

const SAFE_LINK = /^\/[A-Za-z0-9/_\-]*$/;

/** Builds a notification. Links are same-site paths only; titles never carry private content. */
export function planNotification(
  input: { readonly recipientUid: string; readonly kind: NotificationKind; readonly title: string; readonly link: string | null; readonly sourceId: string },
  ctx: { readonly clock?: Clock; readonly newId?: IdGenerator },
): NotificationRecord {
  if (!(NOTIFICATION_KINDS as readonly string[]).includes(input.kind)) throw new Error("Unknown notification kind.");
  if (input.link !== null && !SAFE_LINK.test(input.link)) throw new Error("Notification links must be same-site paths.");
  return Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    recipientUid: parseUid(input.recipientUid, "recipient"),
    kind: input.kind,
    title: parseTitle(input.title, "title", 200),
    link: input.link,
    sourceId: input.sourceId,
    createdAt: toIso((ctx.clock ?? systemClock)()),
    readAt: null,
  });
}
