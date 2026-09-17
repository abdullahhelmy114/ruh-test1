/**
 * Messaging, announcements and notifications.
 *
 * Required invariants covered here: relationship-based messaging (learner
 * and teacher only inside a shared class group, within the course policy;
 * no learner-to-learner or teacher-to-teacher messaging), permission
 * re-checked on every message, conversations private to their two
 * participants, no account probing by non-administrators, announcements
 * published only by those responsible, and notifications that never carry
 * private content and link only within the site.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AuthError, type AuthUser } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import {
  assertPolicyAllows,
  messagingRequirement,
  orderedPair,
  planMessage,
  planNotification,
  planOpenThread,
  planPublishAnnouncement,
  planWithdrawAnnouncement,
} from "../../src/lib/academy/communication/messaging.ts";
import type { RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";
import * as communicationRepo from "../../src/lib/academy/repo/communication-repo.ts";
import { createCommunicationService } from "../../src/lib/academy/services/communication-service.ts";
import {
  IDS,
  admin,
  assertWellFormed,
  classGroupRow,
  courseRow,
  expectDomain,
  fakeExecutor,
  fixedClock,
  rejectsDomain,
  rejectsForbidden,
  sequentialIds,
  student,
  teacher,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const otherStudent: AuthUser = { uid: "student-2", profileId: "p-s2", role: "student", email: "s2@example.test" };
const otherTeacher: AuthUser = { uid: "teacher-2", profileId: "p-t2", role: "teacher", email: "t2@example.test" };
const THREAD = "70700000-0000-4000-8000-000000000001";
const ANNOUNCEMENT = "70800000-0000-4000-8000-000000000001";

const ctx = { clock: fixedClock, newId: sequentialIds("7a7a7a7a") };

function expectForbidden(fn: () => unknown) {
  assert.throws(fn, (e: unknown) => e instanceof AuthError && e.status === 403);
}

describe("messaging rules", () => {
  test("who may talk to whom", () => {
    expectDomain(() => messagingRequirement({ uid: "a", role: "student" }, { uid: "a", role: "teacher" }), "VALIDATION");
    assert.equal(messagingRequirement({ uid: "s", role: "student" }, { uid: "x", role: "admin" }), "none");
    assert.equal(messagingRequirement({ uid: "x", role: "admin" }, { uid: "t", role: "teacher" }), "none");
    assert.equal(messagingRequirement({ uid: "s", role: "student" }, { uid: "t", role: "teacher" }), "class_group");
    assert.equal(messagingRequirement({ uid: "t", role: "teacher" }, { uid: "s", role: "student" }), "class_group");
    expectForbidden(() => messagingRequirement({ uid: "s1", role: "student" }, { uid: "s2", role: "student" }));
    expectForbidden(() => messagingRequirement({ uid: "t1", role: "teacher" }, { uid: "t2", role: "teacher" }));
  });

  test("course policy can close either direction", () => {
    const learner = { uid: "s", role: "student" as const };
    const teacherP = { uid: "t", role: "teacher" as const };
    expectForbidden(() => assertPolicyAllows(learner, teacherP, { learnerMayMessageTeacher: false, teacherMayMessageLearner: true }));
    expectForbidden(() => assertPolicyAllows(teacherP, learner, { learnerMayMessageTeacher: true, teacherMayMessageLearner: false }));
    assert.doesNotThrow(() => assertPolicyAllows(learner, teacherP, { learnerMayMessageTeacher: true, teacherMayMessageLearner: false }));
  });

  test("threads store an ordered pair; messages are validated and belong to participants", () => {
    const thread = planOpenThread({ sender: teacher, recipientUid: "student-1", classGroupId: IDS.classGroup }, ctx);
    assert.deepEqual([thread.participantLowUid, thread.participantHighUid], orderedPair("teacher-1", "student-1"));
    expectDomain(() => planMessage({ thread, senderUid: "student-2", body: "hi" }, ctx), "NOT_FOUND");
    expectDomain(() => planMessage({ thread, senderUid: "student-1", body: "   " }, ctx), "VALIDATION");
    expectDomain(() => planMessage({ thread, senderUid: "student-1", body: "x".repeat(4001) }, ctx), "VALIDATION");
    assert.equal(planMessage({ thread, senderUid: "student-1", body: " line one\r\nline two " }, ctx).body, "line one\nline two");
  });
});

describe("announcements and notifications (pure)", () => {
  const actorCtx = (uid: string, role: AuthUser["role"]) => ({ actor: { uid, role }, clock: fixedClock, newId: sequentialIds("7b7b7b7b") });

  test("scope shapes are enforced", () => {
    const plan = planPublishAnnouncement({ scope: "class_group", courseId: IDS.course, classGroupId: IDS.classGroup, title: "Room change", body: "We meet in room 4." }, actorCtx("teacher-1", "teacher"));
    assert.doesNotThrow(() => buildAuditEvent(plan.audit));
    expectDomain(() => planPublishAnnouncement({ scope: "academy", courseId: IDS.course, classGroupId: null, title: "t", body: "b" }, actorCtx("admin-1", "admin")), "VALIDATION");
    expectDomain(() => planPublishAnnouncement({ scope: "class_group", courseId: IDS.course, classGroupId: null, title: "t", body: "b" }, actorCtx("admin-1", "admin")), "VALIDATION");
    expectDomain(() => planPublishAnnouncement({ scope: "course", courseId: IDS.course, classGroupId: null, title: "t", body: " " }, actorCtx("admin-1", "admin")), "VALIDATION");
  });

  test("only the author or an administrator withdraws, with a reason", () => {
    const record = planPublishAnnouncement({ scope: "class_group", courseId: IDS.course, classGroupId: IDS.classGroup, title: "Room change", body: "Room 4." }, actorCtx("teacher-1", "teacher")).record;
    expectForbidden(() => planWithdrawAnnouncement(record, { reason: "Wrong room", expectedRevision: 1 }, actorCtx("teacher-2", "teacher")));
    expectDomain(() => planWithdrawAnnouncement(record, { reason: "", expectedRevision: 1 }, actorCtx("teacher-1", "teacher")), "VALIDATION");
    const withdrawn = planWithdrawAnnouncement(record, { reason: "Wrong room", expectedRevision: 1 }, actorCtx("admin-1", "admin")).record;
    expectDomain(() => planWithdrawAnnouncement(withdrawn, { reason: "Again", expectedRevision: 2 }, actorCtx("admin-1", "admin")), "CONFLICT");
  });

  test("notification links stay on this site", () => {
    const base = { recipientUid: "student-1", kind: "message" as const, title: "New message", sourceId: THREAD };
    assert.equal(planNotification({ ...base, link: `/academy/messages/${THREAD}` }, ctx).link, `/academy/messages/${THREAD}`);
    for (const link of ["https://evil.example.test/x", "//evil.example.test", "javascript:alert(1)", "/a?next=https://x"]) {
      assert.throws(() => planNotification({ ...base, link }, ctx), link);
    }
  });
});

describe("communication queries", () => {
  test("messages can only be inserted by a participant; notifications and threads are keyed by the caller", () => {
    const thread = planOpenThread({ sender: student, recipientUid: "teacher-1", classGroupId: IDS.classGroup }, ctx);
    const message = planMessage({ thread, senderUid: "student-1", body: "Salaam" }, ctx);
    const announcement = planPublishAnnouncement(
      { scope: "class_group", courseId: IDS.course, classGroupId: IDS.classGroup, title: "Room change", body: "Room 4." },
      { actor: { uid: "teacher-1", role: "teacher" }, clock: fixedClock, newId: sequentialIds("7c7c7c7c") },
    ).record;
    const queries = {
      threads: communicationRepo.listUserThreadsQuery("student-1"),
      pair: communicationRepo.selectThreadByPairQuery("student-1", "teacher-1", IDS.classGroup),
      insertThread: communicationRepo.insertThreadQuery(thread),
      messages: communicationRepo.listThreadMessagesQuery(THREAD, null, 50),
      insertMessage: communicationRepo.insertMessageQuery(message),
      read: communicationRepo.upsertThreadReadQuery(THREAD, "student-1", "2026-09-17T12:00:00Z"),
      fanOut: communicationRepo.fanOutAnnouncementNotificationsQuery(announcement, "New announcement", "/academy/announcements"),
      notifications: communicationRepo.listNotificationsQuery("student-1", { unreadOnly: true, before: null }),
      markRead: communicationRepo.markNotificationReadQuery("student-1", THREAD, "2026-09-17T12:00:00Z"),
      classGroupAnnouncements: communicationRepo.listClassGroupAnnouncementsQuery(IDS.classGroup, IDS.course),
    };
    for (const [name, query] of Object.entries(queries)) assert.doesNotThrow(() => assertWellFormed(query), name);
    assert.match(queries.insertMessage.text, /t\.participant_low_uid = \$\d+::text OR t\.participant_high_uid = \$\d+::text/);
    for (const name of ["insertMessage", "fanOut"] as const) {
      for (const match of queries[name].text.matchAll(/\$(\d+)(::)?/g)) assert.equal(match[2], "::", `${name}: $${match[1]} has no cast`);
    }
    assert.match(queries.fanOut.text, /e\.state = 'active'[\s\S]*t\.unassigned_at IS NULL[\s\S]*p\.uid <> \$\d+::text/);
    assert.match(queries.markRead.text, /recipient_uid = \$\d+/);
    assert.match(queries.notifications.text, /WHERE recipient_uid = \$1/);
  });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

function facts(options: { teaching?: boolean } = {}): RelationshipFacts {
  const teaching = options.teaching ?? true;
  return {
    async isTeacherOfClassGroup(uid, groupId) {
      return teaching && uid === "teacher-1" && groupId === IDS.classGroup;
    },
    async isActiveLearnerOfClassGroup(uid, groupId) {
      return teaching && uid === "student-1" && groupId === IDS.classGroup;
    },
    async classGroupBelongsToCourse(groupId, courseId) {
      return groupId === IDS.classGroup && courseId === IDS.course;
    },
    async hasCourseAccess(uid, courseId) {
      return uid === "student-1" && courseId === IDS.course;
    },
    async hasActiveTeachingRelationship(teacherUid, learnerUid) {
      return teaching && teacherUid === "teacher-1" && learnerUid === "student-1";
    },
  };
}

const PROFILES: Record<string, { firebase_uid: string; role: string; status: string }> = {
  "student-1": { firebase_uid: "student-1", role: "student", status: "active" },
  "student-2": { firebase_uid: "student-2", role: "student", status: "active" },
  "teacher-1": { firebase_uid: "teacher-1", role: "teacher", status: "active" },
  "teacher-2": { firebase_uid: "teacher-2", role: "teacher", status: "active" },
  "admin-1": { firebase_uid: "admin-1", role: "admin", status: "active" },
};

const MESSAGING_OPEN = { learnerMayMessageTeacher: true, teacherMayMessageLearner: true };

function policyRow(value: unknown) {
  return [{ id: "71000000-0000-4000-8000-000000000001", policy_key: "communications.messaging", scope: "academy", program_id: null, course_id: null, value: JSON.stringify(value), revision: 1, set_by: "admin-1", set_at: "2026-09-01T00:00:00Z", reason: "Messaging rules" }];
}

const threadRow = { id: THREAD, participant_low_uid: "student-1", participant_high_uid: "teacher-1", class_group_id: IDS.classGroup, created_by: "student-1", created_at: "2026-09-10T00:00:00Z", last_message_at: null };

const R = {
  profile: /FROM profiles/,
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  course: /FROM academy_courses WHERE id = \$1::uuid$/,
  policy: /FROM academy_policy_values/,
  threadByPair: /FROM academy_message_threads\s+WHERE participant_low_uid/,
  thread: /FROM academy_message_threads WHERE id = \$1::uuid$/,
  announcement: /FROM academy_announcements WHERE id = \$1::uuid$/,
  markRead: /UPDATE academy_notifications SET read_at = COALESCE/,
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    profile: (q) => (PROFILES[String(q.values[0])] ? [PROFILES[String(q.values[0])]] : []),
    classGroup: [classGroupRow()],
    course: [courseRow()],
    policy: policyRow(MESSAGING_OPEN),
    threadByPair: [],
    thread: [threadRow],
    announcement: [],
    markRead: [],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

function comms(executor: FakeExecutor, relationship = facts()) {
  return createCommunicationService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("7d7d7d7d"), facts: relationship });
}

describe("messaging service", () => {
  test("a learner opens a conversation with their teacher inside the shared class group", async () => {
    const executor = fakeExecutor(world({ threadByPair: [threadRow] }));
    const thread = await comms(executor).openThread(student, { recipientUid: "teacher-1", classGroupId: IDS.classGroup });
    assert.equal(thread.classGroupId, IDS.classGroup);
  });

  test("unrelated pairs, missing context and closed policy directions are refused", async () => {
    await rejectsForbidden(comms(fakeExecutor(world())).openThread(student, { recipientUid: "teacher-2", classGroupId: IDS.classGroup }));
    await rejectsForbidden(comms(fakeExecutor(world())).openThread(student, { recipientUid: "student-2", classGroupId: IDS.classGroup }));
    await rejectsForbidden(comms(fakeExecutor(world())).openThread(teacher, { recipientUid: "teacher-2" }));
    await rejectsDomain(comms(fakeExecutor(world())).openThread(student, { recipientUid: "teacher-1" }), "VALIDATION");
    await rejectsForbidden(comms(fakeExecutor(world({ policy: policyRow({ learnerMayMessageTeacher: false, teacherMayMessageLearner: true }) }))).openThread(student, { recipientUid: "teacher-1", classGroupId: IDS.classGroup }));
    await rejectsDomain(comms(fakeExecutor(world({ policy: [] }))).openThread(student, { recipientUid: "teacher-1", classGroupId: IDS.classGroup }), "POLICY_UNCONFIGURED");
  });

  test("non-administrators cannot probe which accounts exist", async () => {
    await rejectsForbidden(comms(fakeExecutor(world())).openThread(student, { recipientUid: "ghost-account" }));
    await rejectsDomain(comms(fakeExecutor(world())).openThread(admin, { recipientUid: "ghost-account" }), "NOT_FOUND");
    const adminThread = await comms(fakeExecutor(world({ threadByPair: [{ ...threadRow, participant_low_uid: "admin-1", participant_high_uid: "student-2", class_group_id: null }] }))).openThread(admin, { recipientUid: "student-2" });
    assert.equal(adminThread.classGroupId, null);
  });

  test("every message re-checks the relationship; an ended relationship stops new messages", async () => {
    const ended = fakeExecutor(world());
    await rejectsForbidden(comms(ended, facts({ teaching: false })).sendMessage(student, THREAD, { body: "Are you there?" }));
    assert.equal(ended.transactions.length, 0);

    const executor = fakeExecutor(world());
    const message = await comms(executor).sendMessage(student, THREAD, { body: "Private question about my essay" });
    assert.equal(message.senderUid, "student-1");
    const statements = executor.transactions[0].map((q) => q.text);
    assert.equal(statements.length, 4);
    assert.match(statements[0], /INSERT INTO academy_messages/);
    assert.match(statements[3], /INSERT INTO academy_notifications/);
    const notification = executor.transactions[0][3];
    assert.ok(notification.values.includes("teacher-1"));
    assert.equal(notification.values.some((v) => typeof v === "string" && v.includes("essay")), false, "notifications never carry message text");
  });

  test("conversations are private to their participants", async () => {
    await rejectsDomain(comms(fakeExecutor(world())).getThread(otherStudent, THREAD), "NOT_FOUND");
    await rejectsDomain(comms(fakeExecutor(world())).sendMessage(otherTeacher, THREAD, { body: "hi" }), "NOT_FOUND");
    await rejectsDomain(comms(fakeExecutor(world())).getThread(admin, THREAD), "NOT_FOUND");
  });

  test("conversation lists name the other participant (display name only), keyed by the caller", async () => {
    const listRow = { ...threadRow, other_name: "Ustadha Maryam", class_group_name: "Autumn cohort", last_body: "See you Tuesday", unread: "2" };
    const executor = fakeExecutor([{ match: /FROM academy_message_threads t\s+WHERE t\.participant_low_uid = \$1/, rows: [listRow] }]);
    const [thread] = await comms(executor).listThreads(student);
    assert.deepEqual(thread.otherParticipant, { uid: "teacher-1", displayName: "Ustadha Maryam" });
    assert.equal(thread.classGroupName, "Autumn cohort");
    assert.equal(thread.unread, 2);
    const query = executor.queries[0];
    assert.deepEqual(query.values, ["student-1"]);
    assert.match(query.text, /SELECT p\.full_name FROM profiles p/);
    assert.doesNotMatch(query.text, /email|phone|whatsapp/i);

    const opened = await comms(fakeExecutor([{ match: /SELECT full_name FROM profiles WHERE firebase_uid/, rows: [{ full_name: "Ustadha Maryam" }] }, ...world()])).getThread(student, THREAD);
    assert.deepEqual(opened.otherParticipant, { uid: "teacher-1", displayName: "Ustadha Maryam" });
  });
});

describe("announcement and notification services", () => {
  test("assigned teachers publish to their class group with fan-out; others cannot", async () => {
    const executor = fakeExecutor(world());
    const announcement = await comms(executor).publishClassGroupAnnouncement(teacher, IDS.classGroup, { title: "Room change", body: "We meet in room 4." });
    assert.equal(announcement.scope, "class_group");
    const [insert, fanOut] = executor.transactions[0];
    assert.match(insert.text, /INSERT INTO academy_announcements[\s\S]*academy_audit_events/);
    assert.match(fanOut.text, /INSERT INTO academy_notifications/);
    await rejectsForbidden(comms(fakeExecutor(world())).publishClassGroupAnnouncement(otherTeacher, IDS.classGroup, { title: "x", body: "y" }));
    await rejectsForbidden(comms(fakeExecutor(world())).publishClassGroupAnnouncement(student, IDS.classGroup, { title: "x", body: "y" }));
  });

  test("academy and course announcements are for administrators only", async () => {
    await rejectsForbidden(comms(fakeExecutor(world())).publishAnnouncement(teacher, { scope: "academy", title: "x", body: "y" }));
    const executor = fakeExecutor(world());
    const record = await comms(executor).publishAnnouncement(admin, { scope: "course", courseId: IDS.course, title: "Exam week", body: "Finals start Monday." });
    assert.equal(record.courseId, IDS.course);
    assert.equal(executor.transactions[0].length, 2);
    const academyWide = fakeExecutor(world());
    await comms(academyWide).publishAnnouncement(admin, { scope: "academy", title: "Eid break", body: "No sessions this week." });
    assert.equal(academyWide.transactions[0].length, 1, "academy-wide announcements are read from the feed, not fanned out");
  });

  test("notifications belong to the caller", async () => {
    const executor = fakeExecutor(world());
    await comms(executor).listNotifications(student, { unreadOnly: true });
    for (const query of executor.queries) assert.equal(query.values[0], "student-1");
    await rejectsDomain(comms(fakeExecutor(world({ markRead: [] }))).markNotificationRead(student, THREAD), "NOT_FOUND");
  });
});
