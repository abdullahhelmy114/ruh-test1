/**
 * Messaging, announcements and notifications.
 *
 * Messaging permission is decided twice, with the same rules: when a
 * conversation is opened and again on every message, so a relationship that
 * has ended (an unassigned teacher, a withdrawn learner) stops new messages
 * immediately. Reading one's own conversation history stays available.
 */
import { AuthError, sessionRoleFor, type AuthUser } from "../../auth/core.ts";
import {
  assertPolicyAllows,
  isParticipant,
  messagingRequirement,
  otherParticipant,
  planMessage,
  planNotification,
  planOpenThread,
  planPublishAnnouncement,
  planWithdrawAnnouncement,
  orderedPair,
  type Participant,
  type ThreadRecord,
} from "../communication/messaging.ts";
import { DomainError } from "../domain/errors.ts";
import { parseOptionalUuid, parseUid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorize, authorizeAdminAction, type RelationshipFacts } from "../permissions/permissions.ts";
import { expectRows } from "../repo/audit-repo.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import {
  fanOutAnnouncementNotificationsQuery,
  insertAnnouncementQuery,
  insertMessageQuery,
  insertThreadQuery,
  listAcademyAnnouncementsQuery,
  listClassGroupAnnouncementsQuery,
  listNotificationsQuery,
  listThreadMessagesQuery,
  listUserThreadsQuery,
  mapAnnouncementRow,
  mapMessageRow,
  mapNotificationRow,
  mapThreadRow,
  markAllNotificationsReadQuery,
  markNotificationReadQuery,
  selectAnnouncementQuery,
  selectDisplayNameQuery,
  selectThreadByPairQuery,
  selectThreadQuery,
  touchThreadQuery,
  unreadNotificationCountQuery,
  upsertNotificationQuery,
  upsertThreadReadQuery,
  withdrawAnnouncementQuery,
} from "../repo/communication-repo.ts";
import { mapClassGroupRow, selectClassGroupQuery } from "../repo/delivery-repo.ts";
import { mapProfileFacts, selectProfileFactsQuery } from "../repo/profile-repo.ts";
import { num, str, strOrNull } from "../repo/rows.ts";
import { parseInstant } from "../domain/text.ts";
import type { ClassGroupRecord } from "../structure/delivery.ts";
import { effectivePolicy } from "./policy-lookup.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

export interface CommunicationDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
}

type Correlated = { readonly correlationId?: string | null };

export function createCommunicationService(deps: CommunicationDeps) {
  const { executor, facts } = deps;
  const now = () => toIso((deps.clock ?? systemClock)());

  async function loadParticipant(user: AuthUser, uid: unknown): Promise<Participant> {
    const profile = mapProfileFacts((await executor.query(selectProfileFactsQuery(parseUid(uid, "recipientUid"))))[0]);
    if (!profile) {
      // Non-administrators cannot probe which accounts exist.
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Recipient not found.");
      throw new AuthError("FORBIDDEN");
    }
    return { uid: profile.uid, role: sessionRoleFor(profile.role, profile.status) };
  }

  async function loadVisibleClassGroup(user: AuthUser, classGroupId: string): Promise<ClassGroupRecord> {
    const group = await loadOptional(executor, selectClassGroupQuery(classGroupId), mapClassGroupRow);
    if (!group || group.deletedAt !== null) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Class group not found.");
      throw new AuthError("FORBIDDEN");
    }
    return group;
  }

  /**
   * The complete messaging decision for a sender, a recipient and a context.
   * Returns the class group context to use (null for conversations with administrators).
   */
  async function assertMayMessage(sender: AuthUser, recipient: Participant, classGroupId: string | null): Promise<string | null> {
    await authorize(sender, { action: "message.send", recipient }, facts);
    const need = messagingRequirement({ uid: sender.uid, role: sender.role }, recipient);
    if (need === "none") return null;
    if (!classGroupId) throw new DomainError("VALIDATION", "Choose the class group this conversation belongs to.");
    const group = await loadVisibleClassGroup(sender, classGroupId);
    if (group.status !== "planned" && group.status !== "active") throw new AuthError("FORBIDDEN");
    const teacherUid = sender.role === "teacher" ? sender.uid : recipient.uid;
    const learnerUid = sender.role === "student" ? sender.uid : recipient.uid;
    const [teaches, learns] = await Promise.all([
      facts.isTeacherOfClassGroup(teacherUid, group.id),
      facts.isActiveLearnerOfClassGroup(learnerUid, group.id),
    ]);
    if (!teaches || !learns) throw new AuthError("FORBIDDEN");
    const course = await loadRequired(executor, selectCourseQuery(group.courseId), mapCourseRow, "Course not found.");
    const policy = await effectivePolicy(executor, "communications.messaging", { programId: course.programId, courseId: course.id });
    assertPolicyAllows({ uid: sender.uid, role: sender.role }, recipient, policy);
    return group.id;
  }

  async function loadOwnThread(user: AuthUser, threadId: unknown): Promise<ThreadRecord> {
    const thread = await loadOptional(executor, selectThreadQuery(parseUuid(threadId, "threadId")), mapThreadRow);
    // Other people's conversations are indistinguishable from missing ones.
    if (!thread || !isParticipant(thread, user.uid)) throw new DomainError("NOT_FOUND", "Conversation not found.");
    return thread;
  }

  return {
    // -- Messaging -------------------------------------------------------------

    async listThreads(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      const rows = await executor.query(listUserThreadsQuery(user.uid));
      return rows.map((row) => {
        const thread = mapThreadRow(row);
        const body = strOrNull(row.last_body);
        const otherUid = otherParticipant(thread, user.uid);
        return {
          ...thread,
          otherParticipantUid: otherUid,
          otherParticipant: { uid: otherUid, displayName: strOrNull(row.other_name) },
          classGroupName: strOrNull(row.class_group_name),
          lastMessagePreview: body === null ? null : body.slice(0, 140),
          unread: num(row.unread),
        };
      });
    },

    async openThread(user: AuthUser, input: { readonly recipientUid: unknown; readonly classGroupId?: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const recipient = await loadParticipant(user, input.recipientUid);
      const context = await assertMayMessage(user, recipient, parseOptionalUuid(input.classGroupId, "classGroupId"));
      const [low, high] = orderedPair(user.uid, recipient.uid);
      const existing = await loadOptional(executor, selectThreadByPairQuery(low, high, context), mapThreadRow);
      if (existing) return existing;
      const thread = planOpenThread({ sender: user, recipientUid: recipient.uid, classGroupId: context }, { clock: deps.clock, newId: deps.newId });
      await executor.query(insertThreadQuery(thread));
      // A concurrent request may have created the same conversation first.
      return loadRequired(executor, selectThreadByPairQuery(low, high, context), mapThreadRow, "Conversation not found.");
    },

    async getThread(user: AuthUser, threadId: unknown, options: { readonly before?: unknown } = {}) {
      assertAcademyCoreAvailable(deps.flags);
      const thread = await loadOwnThread(user, threadId);
      const before = options.before === undefined || options.before === null || options.before === "" ? null : parseInstant(options.before, "before");
      const otherUid = otherParticipant(thread, user.uid);
      const [messages, nameRows] = await Promise.all([
        loadMany(executor, listThreadMessagesQuery(thread.id, before, 50), mapMessageRow),
        executor.query(selectDisplayNameQuery(otherUid)),
      ]);
      return {
        thread,
        otherParticipantUid: otherUid,
        otherParticipant: { uid: otherUid, displayName: nameRows[0] ? strOrNull(nameRows[0].full_name) : null },
        messages,
      };
    },

    async sendMessage(user: AuthUser, threadId: unknown, input: { readonly body: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const thread = await loadOwnThread(user, threadId);
      const recipient = await loadParticipant(user, otherParticipant(thread, user.uid));
      const context = await assertMayMessage(user, recipient, thread.classGroupId);
      if (context !== thread.classGroupId) throw new AuthError("FORBIDDEN");
      const message = planMessage({ thread, senderUid: user.uid, body: input.body }, { clock: deps.clock, newId: deps.newId });
      const notification = planNotification(
        { recipientUid: recipient.uid, kind: "message", title: "New message", link: `/academy/messages/${thread.id}`, sourceId: thread.id },
        { clock: deps.clock, newId: deps.newId },
      );
      await runGuarded(executor, [
        expectRows(insertMessageQuery(message), 1),
        expectRows(touchThreadQuery(thread.id, message.createdAt), 1),
        expectRows(upsertThreadReadQuery(thread.id, user.uid, message.createdAt), 1),
        expectRows(upsertNotificationQuery(notification), 1),
      ]);
      return message;
    },

    async markThreadRead(user: AuthUser, threadId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const thread = await loadOwnThread(user, threadId);
      await runGuarded(executor, [expectRows(upsertThreadReadQuery(thread.id, user.uid, now()), 1)]);
      return { threadId: thread.id, read: true };
    },

    // -- Announcements ---------------------------------------------------------

    async listClassGroupAnnouncements(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadVisibleClassGroup(user, parseUuid(classGroupId, "classGroupId"));
      await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
      return loadMany(executor, listClassGroupAnnouncementsQuery(group.id, group.courseId), mapAnnouncementRow);
    },

    async listAcademyAnnouncements(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      void user;
      return loadMany(executor, listAcademyAnnouncementsQuery(), mapAnnouncementRow);
    },

    async publishClassGroupAnnouncement(user: AuthUser, classGroupId: unknown, input: Correlated & { readonly title: unknown; readonly body: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadVisibleClassGroup(user, parseUuid(classGroupId, "classGroupId"));
      await authorize(user, { action: "announcement.publish", classGroupId: group.id }, facts);
      if (group.status !== "planned" && group.status !== "active") throw new DomainError("CONFLICT", "This class group has finished.");
      const plan = planPublishAnnouncement(
        { scope: "class_group", courseId: group.courseId, classGroupId: group.id, title: input.title, body: input.body },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(executor, [
        audited(deps, insertAnnouncementQuery(plan.record), plan.audit),
        fanOutAnnouncementNotificationsQuery(plan.record, `New announcement: ${plan.record.title}`.slice(0, 200), `/academy/class-groups/${group.id}/announcements`),
      ]);
      return plan.record;
    },

    /** Academy-wide or course-wide announcements (administrators). */
    async publishAnnouncement(
      user: AuthUser,
      input: Correlated & { readonly scope: unknown; readonly courseId?: unknown; readonly title: unknown; readonly body: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "announcement.manage");
      if (input.scope !== "academy" && input.scope !== "course") throw new DomainError("VALIDATION", "scope must be academy or course.");
      let courseId: string | null = null;
      if (input.scope === "course") {
        const course = await loadRequired(executor, selectCourseQuery(parseUuid(input.courseId, "courseId")), mapCourseRow, "Course not found.");
        if (course.deletedAt !== null) throw new DomainError("NOT_FOUND", "Course not found.");
        courseId = course.id;
      }
      const plan = planPublishAnnouncement(
        { scope: input.scope, courseId, classGroupId: null, title: input.title, body: input.body },
        contextFor(user, deps, input.correlationId),
      );
      const statements: SqlQuery[] = [audited(deps, insertAnnouncementQuery(plan.record), plan.audit)];
      if (plan.record.scope === "course") {
        statements.push(fanOutAnnouncementNotificationsQuery(plan.record, `New announcement: ${plan.record.title}`.slice(0, 200), "/academy/announcements"));
      }
      await runGuarded(executor, statements);
      return plan.record;
    },

    async withdrawAnnouncement(user: AuthUser, announcementId: unknown, input: Correlated & { readonly reason: unknown; readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const announcement = await loadRequired(executor, selectAnnouncementQuery(parseUuid(announcementId, "announcementId")), mapAnnouncementRow, "Announcement not found.");
      const plan = planWithdrawAnnouncement(announcement, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, withdrawAnnouncementQuery(plan.record, announcement.revision), plan.audit)]);
      return plan.record;
    },

    // -- Notifications ---------------------------------------------------------

    async listNotifications(user: AuthUser, options: { readonly unreadOnly?: boolean; readonly before?: unknown } = {}) {
      assertAcademyCoreAvailable(deps.flags);
      const before = options.before === undefined || options.before === null || options.before === "" ? null : parseInstant(options.before, "before");
      const [items, count] = await Promise.all([
        loadMany(executor, listNotificationsQuery(user.uid, { unreadOnly: options.unreadOnly === true, before }), mapNotificationRow),
        executor.query(unreadNotificationCountQuery(user.uid)),
      ]);
      return { items, unreadCount: count.length === 0 ? 0 : num(count[0].n) };
    },

    async markNotificationRead(user: AuthUser, notificationId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const rows = await executor.query(markNotificationReadQuery(user.uid, parseUuid(notificationId, "notificationId"), now()));
      if (rows.length === 0) throw new DomainError("NOT_FOUND", "Notification not found.");
      return { id: str(rows[0].id), read: true };
    },

    async markAllNotificationsRead(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      await executor.query(markAllNotificationsReadQuery(user.uid, now()));
      return { read: true };
    },
  };
}

export type CommunicationService = ReturnType<typeof createCommunicationService>;
