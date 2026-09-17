/**
 * Learner and teacher core workflow: dashboards, class group detail, roster,
 * running sessions and attendance.
 *
 * Required invariants covered here: dashboards act only on the caller,
 * outsiders learn nothing about a class group, rosters expose names only,
 * only assigned teachers (or administrators) run sessions and record
 * attendance, marks come only from the configured vocabulary, corrections
 * need a reason, and learners see only their own attendance.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import { parseMarks, planRecordAttendance, summariseAttendance, type AttendanceRecord } from "../../src/lib/academy/learning/attendance.ts";
import { evaluateAccess, type RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";
import { getPolicyDefinition } from "../../src/lib/academy/policies/registry.ts";
import { mapSessionRow } from "../../src/lib/academy/repo/delivery-repo.ts";
import * as participationRepo from "../../src/lib/academy/repo/participation-repo.ts";
import { createAttendanceService } from "../../src/lib/academy/services/attendance-service.ts";
import { createParticipationService } from "../../src/lib/academy/services/participation-service.ts";
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
  sessionRow,
  student,
  teacher,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const outsider: AuthUser = { uid: "student-2", profileId: "p-s2", role: "student", email: "s2@example.test" };
const otherTeacher: AuthUser = { uid: "teacher-2", profileId: "p-t2", role: "teacher", email: "t2@example.test" };
const OTHER_COURSE = "c0000000-0000-4000-8000-000000000099";

const facts: RelationshipFacts = {
  async isTeacherOfClassGroup(uid, groupId) {
    return uid === "teacher-1" && groupId === IDS.classGroup;
  },
  async isActiveLearnerOfClassGroup(uid, groupId) {
    return uid === "student-1" && groupId === IDS.classGroup;
  },
  async classGroupBelongsToCourse(groupId, courseId) {
    return groupId === IDS.classGroup && courseId === IDS.course;
  },
  async hasCourseAccess(uid, courseId) {
    return uid === "student-1" && courseId === IDS.course;
  },
  async hasActiveTeachingRelationship() {
    return false;
  },
};

const vocabulary = getPolicyDefinition("attendance.vocabulary").parse({
  marks: [
    { code: "present", countsAsAttended: true, labels: { en: "Present", ar: "حاضر", tr: "Var" } },
    { code: "late", countsAsAttended: true, labels: { en: "Late", ar: "متأخر", tr: "Geç" } },
    { code: "absent", countsAsAttended: false, labels: { en: "Absent", ar: "غائب", tr: "Yok" } },
  ],
});

const liveSession = mapSessionRow(sessionRow({ state: "live" }));
const ctx = { actor: { uid: "teacher-1", role: "teacher" as const }, clock: fixedClock, newId: sequentialIds("a7a7a7a7") };

describe("class group visibility", () => {
  const request = { action: "class_group.view" as const, courseId: IDS.course, classGroupId: IDS.classGroup };

  test("active learners, assigned teachers and administrators may view; others may not", async () => {
    assert.equal((await evaluateAccess(student, request, facts)).allowed, true);
    assert.equal((await evaluateAccess(teacher, request, facts)).allowed, true);
    assert.equal((await evaluateAccess(admin, request, facts)).allowed, true);
    assert.equal((await evaluateAccess(outsider, request, facts)).allowed, false);
    assert.equal((await evaluateAccess(otherTeacher, request, facts)).allowed, false);
    assert.equal((await evaluateAccess(student, { ...request, courseId: OTHER_COURSE }, facts)).allowed, false);
    assert.equal((await evaluateAccess(student, { ...request, classGroupId: "" }, facts)).allowed, false);
  });
});

describe("attendance planning", () => {
  test("mark requests are validated strictly", () => {
    expectDomain(() => parseMarks({ marks: [] }), "VALIDATION");
    expectDomain(() => parseMarks({ marks: new Array(501).fill({ learnerUid: "x", code: "present" }) }), "VALIDATION");
    expectDomain(() => parseMarks({ marks: [{ learnerUid: "student-1", code: "present" }, { learnerUid: "student-1", code: "late" }] }), "VALIDATION");
    expectDomain(() => parseMarks({ marks: [{ learnerUid: "has space", code: "present" }] }), "VALIDATION");
    expectDomain(() => parseMarks({ marks: [{ learnerUid: "student-1", code: "present", expectedRevision: 0 }] }), "VALIDATION");
  });

  test("attendance opens when the session starts", () => {
    const scheduled = mapSessionRow(sessionRow());
    expectDomain(
      () => planRecordAttendance({ session: scheduled, vocabulary, eligibleLearners: new Set(["student-1"]), existing: new Map(), marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "present" }] }) }, ctx),
      "CONFLICT",
    );
  });

  test("marks come from the vocabulary and only for learners enrolled during the session", () => {
    const base = { session: liveSession, vocabulary, eligibleLearners: new Set(["student-1"]), existing: new Map<string, AttendanceRecord>() };
    expectDomain(() => planRecordAttendance({ ...base, marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "excused" }] }) }, ctx), "VALIDATION");
    expectDomain(() => planRecordAttendance({ ...base, marks: parseMarks({ marks: [{ learnerUid: "student-2", code: "present" }] }) }, ctx), "VALIDATION");
    const [write] = planRecordAttendance({ ...base, marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "late" }] }) }, ctx);
    assert.equal(write.previous, null);
    assert.equal(write.record.countsAsAttended, true);
    assert.equal(write.audit.action, "attendance.record");
    assert.doesNotThrow(() => buildAuditEvent(write.audit));
  });

  test("changing a recorded mark is a reasoned, revision-checked correction; unchanged marks are skipped", () => {
    const [first] = planRecordAttendance(
      { session: liveSession, vocabulary, eligibleLearners: new Set(["student-1"]), existing: new Map(), marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "absent" }] }) },
      ctx,
    );
    const existing = new Map([["student-1", first.record]]);
    const base = { session: liveSession, vocabulary, eligibleLearners: new Set(["student-1"]), existing };
    expectDomain(() => planRecordAttendance({ ...base, marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "present", expectedRevision: 1 }] }) }, ctx), "VALIDATION");
    expectDomain(() => planRecordAttendance({ ...base, marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "present", reason: "Arrived late, marked wrongly" }] }) }, ctx), "CONFLICT");
    const [correction] = planRecordAttendance(
      { ...base, marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "present", reason: "Joined from another room", expectedRevision: 1 }] }) },
      ctx,
    );
    assert.equal(correction.audit.action, "attendance.correct");
    assert.equal(correction.record.revision, 2);
    assert.equal(buildAuditEvent(correction.audit).impact, "high");
    assert.deepEqual(planRecordAttendance({ ...base, marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "absent", expectedRevision: 1 }] }) }, ctx), []);
  });

  test("summaries use the snapshot taken when each mark was recorded", () => {
    assert.deepEqual(summariseAttendance([]), { recordedSessions: 0, attendedSessions: 0, attendedRatio: null });
    assert.deepEqual(summariseAttendance([{ countsAsAttended: true }, { countsAsAttended: false }, { countsAsAttended: true }, { countsAsAttended: true }]), {
      recordedSessions: 4,
      attendedSessions: 3,
      attendedRatio: 0.75,
    });
  });
});

describe("participation queries", () => {
  test("queries are well formed, keyed by the caller, and expose names only", () => {
    const queries = {
      learnerGroups: participationRepo.selectLearnerClassGroupsQuery("student-1"),
      learnerSessions: participationRepo.selectLearnerUpcomingSessionsQuery("student-1", "2026-09-17T12:00:00Z"),
      teacherGroups: participationRepo.selectTeacherClassGroupsQuery("teacher-1"),
      teacherSessions: participationRepo.selectTeacherUpcomingSessionsQuery("teacher-1", "2026-09-17T12:00:00Z"),
      courseTitle: participationRepo.selectCourseTitleQuery(IDS.course),
      groupSessions: participationRepo.selectClassGroupSessionsWithTitlesQuery(IDS.classGroup),
      roster: participationRepo.selectRosterQuery(IDS.classGroup),
      eligible: participationRepo.selectEligibleLearnersQuery(IDS.classGroup, "2026-10-05T16:00:00Z", "2026-10-05T17:30:00Z"),
      sessionAttendance: participationRepo.selectSessionAttendanceQuery(IDS.session),
      ownSessionAttendance: participationRepo.selectOwnSessionAttendanceQuery(IDS.session, "student-1"),
      ownGroupAttendance: participationRepo.selectOwnClassGroupAttendanceQuery("student-1", IDS.classGroup),
    };
    for (const [name, query] of Object.entries(queries)) assert.doesNotThrow(() => assertWellFormed(query), name);
    assert.equal(queries.learnerGroups.values[0], "student-1");
    assert.match(queries.learnerSessions.text, /e\.state = 'active'/);
    assert.match(queries.roster.text, /p\.full_name/);
    assert.doesNotMatch(queries.roster.text, /email|phone|whatsapp|country|gender|age/i);
    assert.match(queries.eligible.text, /activated_at <= \$\d+::timestamptz[\s\S]*ended_at >= \$\d+::timestamptz/);
  });

  test("attendance inserts re-check the session state in SQL with explicit casts", () => {
    const [write] = planRecordAttendance(
      { session: liveSession, vocabulary, eligibleLearners: new Set(["student-1"]), existing: new Map(), marks: parseMarks({ marks: [{ learnerUid: "student-1", code: "present" }] }) },
      ctx,
    );
    const insert = participationRepo.insertAttendanceQuery(write.record);
    assertWellFormed(insert);
    assert.match(insert.text, /s\.state IN \('live', 'completed'\)/);
    for (const match of insert.text.matchAll(/\$(\d+)(::)?/g)) assert.equal(match[2], "::", `$${match[1]} has no cast`);
    assertWellFormed(participationRepo.updateAttendanceQuery(write.record, 1));
  });
});

const R = {
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  session: /FROM academy_sessions WHERE id = \$1::uuid$/,
  course: /FROM academy_courses WHERE id = \$1::uuid$/,
  policy: /FROM academy_policy_values/,
  eligible: /SELECT DISTINCT e\.learner_uid/,
  sessionAttendance: /FROM academy_attendance_records WHERE session_id = \$1::uuid ORDER BY/,
  ownSessionAttendance: /FROM academy_attendance_records WHERE session_id = \$1::uuid AND learner_uid/,
};

const VOCABULARY_ROW = {
  id: "88888888-8888-4888-8888-888888888888", policy_key: "attendance.vocabulary", scope: "academy", program_id: null, course_id: null,
  value: JSON.stringify({
    marks: [
      { code: "present", countsAsAttended: true, labels: { en: "Present", ar: "حاضر", tr: "Var" } },
      { code: "absent", countsAsAttended: false, labels: { en: "Absent", ar: "غائب", tr: "Yok" } },
    ],
  }),
  revision: 1, set_by: "admin-1", set_at: "2026-09-01T00:00:00Z", reason: "Academy attendance marks",
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    classGroup: [classGroupRow()],
    session: [sessionRow({ state: "live" })],
    course: [courseRow()],
    policy: [VOCABULARY_ROW],
    eligible: [{ learner_uid: "student-1" }],
    sessionAttendance: [],
    ownSessionAttendance: [],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

function participation(executor: FakeExecutor) {
  return createParticipationService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("b7b7b7b7"), facts });
}

function attendance(executor: FakeExecutor) {
  return createAttendanceService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("c7c7c7c7"), facts });
}

describe("participation service", () => {
  test("dashboards belong to their role and act only on the caller", async () => {
    await rejectsForbidden(participation(fakeExecutor()).myLearning(teacher));
    await rejectsForbidden(participation(fakeExecutor()).myTeaching(student));
    const executor = fakeExecutor();
    await participation(executor).myLearning(student);
    assert.ok(executor.queries.length > 0);
    for (const query of executor.queries) assert.equal(query.values[0], "student-1");
  });

  test("outsiders get no class group detail or roster, and nothing beyond the class group row is read", async () => {
    for (const user of [outsider, otherTeacher]) {
      const executor = fakeExecutor(world());
      await rejectsForbidden(participation(executor).classGroupDetail(user, IDS.classGroup));
      assert.equal(executor.queries.length, 1);
    }
    await rejectsForbidden(participation(fakeExecutor(world())).roster(student, IDS.classGroup));
    await rejectsForbidden(participation(fakeExecutor(world({ classGroup: [] }))).classGroupDetail(student, IDS.classGroup));
    await rejectsDomain(participation(fakeExecutor(world({ classGroup: [] }))).classGroupDetail(admin, IDS.classGroup), "NOT_FOUND");
  });

  test("assigned teachers start and complete sessions with an audit; others cannot", async () => {
    const scheduled = fakeExecutor(world({ session: [sessionRow()] }));
    const started = await participation(scheduled).conductSession(teacher, IDS.session, { action: "start", expectedRevision: 1 });
    assert.equal(started.state, "live");
    assert.match(scheduled.transactions[0][0].text, /UPDATE academy_sessions[\s\S]*academy_audit_events/);

    await rejectsForbidden(participation(fakeExecutor(world({ session: [sessionRow()] }))).conductSession(otherTeacher, IDS.session, { action: "start", expectedRevision: 1 }));
    await rejectsForbidden(participation(fakeExecutor(world({ session: [sessionRow()] }))).conductSession(student, IDS.session, { action: "start", expectedRevision: 1 }));
    await rejectsForbidden(participation(fakeExecutor(world({ session: [] }))).conductSession(teacher, IDS.session, { action: "start", expectedRevision: 1 }));
    await rejectsDomain(participation(fakeExecutor(world({ session: [sessionRow()] }))).conductSession(teacher, IDS.session, { action: "cancel", expectedRevision: 1 }), "VALIDATION");
    await rejectsDomain(participation(fakeExecutor(world({ session: [sessionRow()] }))).conductSession(teacher, IDS.session, { action: "complete", expectedRevision: 1 }), "INVALID_TRANSITION");
  });
});

describe("participant reads for the workspace screens", () => {
  const teachersRule = { match: /FROM academy_class_group_teachers t\s+JOIN profiles p ON p\.firebase_uid = t\.teacher_uid AND p\.role = 'teacher'/, rows: [{ teacher_uid: "teacher-1", full_name: "Ustadha Maryam" }] };
  const titleRule = { match: /SELECT vl\.title, vl\.summary/, rows: [{ title: "The nominal sentence", summary: null }] };
  const namesRule = { match: /SELECT e\.learner_uid, max\(p\.full_name\)/, rows: [{ learner_uid: "student-1", full_name: "Amina" }] };

  test("class group detail names the assigned teachers, with names and uids only", async () => {
    const executor = fakeExecutor([teachersRule, ...world()]);
    const detail = await participation(executor).classGroupDetail(student, IDS.classGroup);
    assert.deepEqual(detail.teachers, [{ uid: "teacher-1", displayName: "Ustadha Maryam" }]);
    const query = participationRepo.selectClassGroupTeachersQuery(IDS.classGroup);
    assertWellFormed(query);
    assert.match(query.text, /t\.unassigned_at IS NULL/);
    const selected = query.text.slice(0, query.text.indexOf("FROM"));
    assert.doesNotMatch(selected, /email|phone|whatsapp|country|gender|age|status/i, "only the uid and name are selected");
    assert.match(query.text, /JOIN profiles p ON p\.firebase_uid = t\.teacher_uid AND p\.role = 'teacher' AND p\.status = 'active'/, "only active teachers are shown");
  });

  test("session detail: outsiders are refused before anything else is read; missing looks forbidden", async () => {
    for (const user of [outsider, otherTeacher]) {
      const executor = fakeExecutor([titleRule, ...world({ session: [sessionRow()] })]);
      await rejectsForbidden(participation(executor).sessionDetail(user, IDS.session));
      assert.equal(executor.queries.some((q) => titleRule.match.test(q.text)), false);
    }
    await rejectsForbidden(participation(fakeExecutor(world({ session: [] }))).sessionDetail(student, IDS.session));
    await rejectsDomain(participation(fakeExecutor(world({ session: [] }))).sessionDetail(admin, IDS.session), "NOT_FOUND");
  });

  test("session detail: learners get the link while it is ahead, no revision and no staff permissions", async () => {
    const scheduled = sessionRow({ meeting_url: "https://meet.example.test/abc" });
    const learnerView = await participation(fakeExecutor([titleRule, ...world({ session: [scheduled] })])).sessionDetail(student, IDS.session);
    assert.equal(learnerView.session.meetingUrl, "https://meet.example.test/abc");
    assert.equal(learnerView.session.lessonTitle, "The nominal sentence");
    assert.equal(learnerView.session.revision, null);
    assert.deepEqual(learnerView.permissions, { conduct: false, prepare: false, recordAttendance: false });

    const teacherView = await participation(fakeExecutor([titleRule, ...world({ session: [scheduled] })])).sessionDetail(teacher, IDS.session);
    assert.equal(teacherView.session.revision, 1);
    assert.deepEqual(teacherView.permissions, { conduct: true, prepare: true, recordAttendance: true });

    const adminView = await participation(fakeExecutor([titleRule, ...world({ session: [scheduled] })])).sessionDetail(admin, IDS.session);
    assert.deepEqual(adminView.permissions, { conduct: true, prepare: false, recordAttendance: true }, "preparation stays the teacher's own work");

    const completed = sessionRow({ state: "completed", meeting_url: "https://meet.example.test/abc" });
    const past = await participation(fakeExecutor([titleRule, ...world({ session: [completed] })])).sessionDetail(student, IDS.session);
    assert.equal(past.session.meetingUrl, null, "no meeting link once the session is over");
  });

  test("staff attendance lists the markable learners by name and the vocabulary; learners get labels, never the class list", async () => {
    const staff = await attendance(fakeExecutor([namesRule, ...world()])).sessionAttendance(teacher, IDS.session);
    assert.ok("learners" in staff);
    assert.deepEqual(staff.learners, [{ uid: "student-1", displayName: "Amina" }]);
    assert.deepEqual(staff.vocabulary?.marks.map((m) => m.code), ["present", "absent"]);

    const own = await attendance(fakeExecutor([namesRule, ...world()])).sessionAttendance(student, IDS.session);
    assert.equal("learners" in own, false);
    assert.equal(JSON.stringify(own).includes("Amina"), false);
    assert.equal(own.vocabulary?.marks[0].labels.ar, "حاضر");

    // An unconfigured vocabulary does not break reading; recording still fails closed.
    const unconfigured = await attendance(fakeExecutor([namesRule, ...world({ policy: [] })])).sessionAttendance(teacher, IDS.session);
    assert.equal(unconfigured.vocabulary, null);

    const query = participationRepo.selectEligibleLearnerNamesQuery(IDS.classGroup, "2026-10-05T16:00:00Z", "2026-10-05T17:30:00Z");
    assertWellFormed(query);
    assert.doesNotMatch(query.text, /email|phone|whatsapp|country|gender|age/i);
    assert.match(query.text, /activated_at <= \$\d+::timestamptz[\s\S]*ended_at >= \$\d+::timestamptz/);
  });
});

describe("attendance service", () => {
  test("teachers record marks from the configured vocabulary in one audited transaction", async () => {
    const executor = fakeExecutor(world());
    const result = await attendance(executor).recordAttendance(teacher, IDS.session, { marks: [{ learnerUid: "student-1", code: "present" }] });
    assert.equal(result.written.length, 1);
    const [insert] = executor.transactions[0];
    assert.match(insert.text, /INSERT INTO academy_attendance_records[\s\S]*academy_audit_events/);
    assert.ok(insert.values.includes("attendance.record"));
  });

  test("recording fails closed without a vocabulary and refuses learners and outsiders", async () => {
    await rejectsDomain(attendance(fakeExecutor(world({ policy: [] }))).recordAttendance(teacher, IDS.session, { marks: [{ learnerUid: "student-1", code: "present" }] }), "POLICY_UNCONFIGURED");
    for (const user of [student, otherTeacher]) {
      const executor = fakeExecutor(world());
      await rejectsForbidden(attendance(executor).recordAttendance(user, IDS.session, { marks: [{ learnerUid: "student-1", code: "present" }] }));
      assert.equal(executor.transactions.length, 0);
    }
  });

  test("learners read only their own marks; teachers read the session", async () => {
    const own = fakeExecutor(world({ ownSessionAttendance: [] }));
    await attendance(own).sessionAttendance(student, IDS.session);
    const ownQuery = own.queries.find((q) => R.ownSessionAttendance.test(q.text));
    assert.equal(ownQuery?.values[1], "student-1");
    assert.equal(own.queries.some((q) => R.sessionAttendance.test(q.text)), false);

    await rejectsForbidden(attendance(fakeExecutor(world())).sessionAttendance(outsider, IDS.session));
    const staff = fakeExecutor(world());
    await attendance(staff).sessionAttendance(teacher, IDS.session);
    assert.equal(staff.queries.some((q) => R.sessionAttendance.test(q.text)), true);
  });

  test("'my attendance' is learner-only and keyed by the caller", async () => {
    await rejectsForbidden(attendance(fakeExecutor()).myAttendance(teacher, IDS.classGroup));
    const executor = fakeExecutor([{ match: /FROM academy_attendance_records a/, rows: [{ session_id: IDS.session, mark_code: "present", counts_as_attended: true, updated_at: "2026-10-05T18:00:00Z", starts_at: "2026-10-05T16:00:00Z", lesson_title: "Prepositions" }] }]);
    const mine = await attendance(executor).myAttendance(student, IDS.classGroup);
    assert.equal(executor.queries[0].values[0], "student-1");
    assert.deepEqual(mine.summary, { recordedSessions: 1, attendedSessions: 1, attendedRatio: 1 });

    // With the class group and vocabulary available, the learner receives the labels for their marks.
    const labelled = fakeExecutor([{ match: /FROM academy_attendance_records a/, rows: [{ session_id: IDS.session, mark_code: "present", counts_as_attended: true, updated_at: "2026-10-05T18:00:00Z", starts_at: "2026-10-05T16:00:00Z", lesson_title: "Prepositions" }] }, ...world()]);
    const withLabels = await attendance(labelled).myAttendance(student, IDS.classGroup);
    assert.equal(withLabels.vocabulary?.marks.find((m) => m.code === "present")?.labels.tr, "Var");
    // Without any attendance, nothing else is looked up.
    const none = fakeExecutor(world());
    const empty = await attendance(none).myAttendance(student, IDS.classGroup);
    assert.equal(empty.vocabulary, null);
    assert.equal(none.queries.length, 1);
  });
});
