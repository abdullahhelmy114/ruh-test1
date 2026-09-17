/**
 * Teacher assignment and teaching access, end to end at the code level:
 *
 *   administrator → approved, active teacher → class group assignment →
 *   teacher workspace and relationship-scoped permissions
 *
 * Covered: assign, duplicate, unassign, reassign, class groups that no longer
 * take teachers, unassigning a deactivated teacher, concurrent unassignment,
 * the administrator's view of idle assignments (teacher not active), the
 * relationship facts and workspace queries that end access on unassignment or
 * deactivation, the permission matrix for assigned, unrelated, unassigned and
 * applicant teachers, and the absence of any cached permission.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sessionRoleFor, type AuthUser } from "../../src/lib/auth/core.ts";
import { evaluateAccess, type AccessRequest, type RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";
import { selectTeacherCourseGrantsQuery } from "../../src/lib/academy/repo/library-repo.ts";
import { selectClassGroupTeachersQuery, selectTeacherClassGroupsQuery, selectTeacherUpcomingSessionsQuery } from "../../src/lib/academy/repo/participation-repo.ts";
import { selectProfilesFactsQuery } from "../../src/lib/academy/repo/profile-repo.ts";
import { createSqlRelationshipFacts } from "../../src/lib/academy/repo/relationship-facts.ts";
import { createDeliveryService } from "../../src/lib/academy/services/delivery-service.ts";
import { createParticipationService } from "../../src/lib/academy/services/participation-service.ts";
import { IDS, admin, admin2, assertWellFormed, classGroupRow, fakeExecutor, fixedClock, rejectsDomain, rejectsForbidden, sequentialIds, student, teacher, type FakeExecutor, type Rule } from "./support.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const OTHER_GROUP = "f0000000-0000-4000-8000-000000000002";

const R = {
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  profile: /^SELECT firebase_uid, role, status FROM profiles WHERE firebase_uid = \$1$/,
  profiles: /FROM profiles WHERE firebase_uid = ANY\(\$1::text\[\]\)/,
  assignments: /FROM academy_class_group_teachers\s+WHERE class_group_id/,
  assignment: /FROM academy_class_group_teachers WHERE id/,
  openEnrollments: /SELECT learner_uid, state FROM academy_enrollments/,
};

function rules(entries: Partial<Record<keyof typeof R, Rule["rows"]>>): Rule[] {
  return (Object.keys(entries) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: entries[key] as Rule["rows"] }));
}

const delivery = (executor: FakeExecutor, idPrefix = "a5a5a5a5") => createDeliveryService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds(idPrefix) });

const assignmentRow = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.assignment, class_group_id: IDS.classGroup, teacher_uid: "teacher-1", assigned_by: "admin-1", assigned_at: "2026-09-01T00:00:00Z",
  unassigned_by: null, unassigned_at: null, unassign_reason: null, ...overrides,
});

const ACTIVE_TEACHER = { firebase_uid: "teacher-1", role: "teacher", status: "active" };

// ---------------------------------------------------------------------------
// Administrator: assignments
// ---------------------------------------------------------------------------

describe("assigning and unassigning teachers", () => {
  test("assign → unassign → reassign: each is one guarded, audited transaction and a reassignment is a new assignment", async () => {
    const assign = fakeExecutor(rules({ classGroup: [classGroupRow()], profile: [ACTIVE_TEACHER], assignments: [] }));
    const first = await delivery(assign).assignTeacher(admin, IDS.classGroup, { teacherUid: "teacher-1" });
    assert.deepEqual(assign.queries.find((q) => R.assignments.test(q.text))?.values, [IDS.classGroup, true], "only open assignments count as duplicates");
    assert.match(assign.queries.find((q) => R.assignments.test(q.text))?.text ?? "", /\(NOT \$2::boolean OR unassigned_at IS NULL\)/);

    const unassign = fakeExecutor(rules({ classGroup: [classGroupRow()], assignment: [assignmentRow({ id: first.id })] }));
    const ended = await delivery(unassign).unassignTeacher(admin, IDS.classGroup, { assignmentId: first.id, reason: "Timetable change." });
    assert.equal(ended.unassignedBy, "admin-1");
    assert.equal(ended.unassignReason, "Timetable change.");
    const [write] = unassign.transactions[0];
    assert.match(write.text, /UPDATE academy_class_group_teachers SET[\s\S]*WHERE id = \$\d+::uuid AND unassigned_at IS NULL[\s\S]*academy_audit_events[\s\S]*academy_expect_rows/);
    assert.ok(write.values.includes("class_group.unassign_teacher"));

    // The ended assignment is not open, so the same teacher can be assigned again as a new row.
    const reassign = fakeExecutor(rules({ classGroup: [classGroupRow()], profile: [ACTIVE_TEACHER], assignments: [] }));
    const second = await delivery(reassign, "b6b6b6b6").assignTeacher(admin2, IDS.classGroup, { teacherUid: "teacher-1" });
    assert.match(reassign.transactions[0][1].text, /INSERT INTO academy_class_group_teachers/);
    assert.notEqual(second.id, first.id);
    assert.equal(second.unassignedAt, null);
  });

  test("an assignment that is missing, already ended, or belongs to another class group cannot be unassigned; a reason is required", async () => {
    const cases: [Rule["rows"], string][] = [
      [[], "NOT_FOUND"],
      [[assignmentRow({ unassigned_at: "2026-09-10T00:00:00Z", unassigned_by: "admin-2", unassign_reason: "Left." })], "NOT_FOUND"],
      [[assignmentRow({ class_group_id: OTHER_GROUP })], "NOT_FOUND"],
    ];
    for (const [assignment, code] of cases) {
      const executor = fakeExecutor(rules({ classGroup: [classGroupRow()], assignment }));
      await rejectsDomain(delivery(executor).unassignTeacher(admin, IDS.classGroup, { assignmentId: IDS.assignment, reason: "x" }), code);
      assert.equal(executor.transactions.length, 0);
    }
    const noReason = fakeExecutor(rules({ classGroup: [classGroupRow()], assignment: [assignmentRow()] }));
    await rejectsDomain(delivery(noReason).unassignTeacher(admin, IDS.classGroup, { assignmentId: IDS.assignment, reason: "  " }), "VALIDATION");
    assert.equal(noReason.transactions.length, 0);
  });

  test("a deactivated teacher can still be unassigned, without consulting the account, so the class group can be handed over", async () => {
    const executor = fakeExecutor(rules({ classGroup: [classGroupRow()], assignment: [assignmentRow({ teacher_uid: "former-1" })] }));
    await delivery(executor).unassignTeacher(admin, IDS.classGroup, { assignmentId: IDS.assignment, reason: "Deactivated." });
    assert.equal(executor.transactions.length, 1);
    assert.equal(executor.queries.some((q) => /FROM profiles/.test(q.text)), false);
  });

  test("two administrators ending the same assignment: the second update matches nothing and is a conflict", async () => {
    const executor = fakeExecutor(rules({ classGroup: [classGroupRow()], assignment: [assignmentRow()] }));
    executor.failTransactionWith = Object.assign(new Error("academy stale write: expected 1 row(s), matched 0"), { code: "RQ409" });
    await rejectsDomain(delivery(executor).unassignTeacher(admin2, IDS.classGroup, { assignmentId: IDS.assignment, reason: "Duplicate." }), "CONFLICT");
  });

  test("a finished, cancelled or deleted class group takes no new teacher", async () => {
    for (const [row, code] of [
      [classGroupRow({ status: "completed" }), "CONFLICT"],
      [classGroupRow({ status: "cancelled" }), "CONFLICT"],
      [classGroupRow({ deleted_at: "2026-09-10T00:00:00Z", deleted_by: "admin-1", deletion_reason: "Merged." }), "NOT_FOUND"],
    ] as const) {
      const executor = fakeExecutor(rules({ classGroup: [row], profile: [ACTIVE_TEACHER], assignments: [] }));
      await rejectsDomain(delivery(executor).assignTeacher(admin, IDS.classGroup, { teacherUid: "teacher-1" }), code);
      assert.equal(executor.transactions.length, 0, JSON.stringify(row.status));
    }
    // The database repeats the live-class-group condition inside the insert.
    const insert = fakeExecutor(rules({ classGroup: [classGroupRow()], profile: [ACTIVE_TEACHER], assignments: [] }));
    await delivery(insert).assignTeacher(admin, IDS.classGroup, { teacherUid: "teacher-1" });
    assert.match(insert.transactions[0][1].text, /cg\.deleted_at IS NULL AND cg\.status IN \('planned', 'active'\)/);
  });

  test("teachers and students cannot manage assignments", async () => {
    for (const user of [teacher, student, { ...teacher, uid: "applicant-1", role: sessionRoleFor("teacher", "pending") } as AuthUser]) {
      const executor = fakeExecutor(rules({ classGroup: [classGroupRow()], profile: [ACTIVE_TEACHER], assignments: [] }));
      await rejectsForbidden(delivery(executor).assignTeacher(user, IDS.classGroup, { teacherUid: user.uid }));
      await rejectsForbidden(delivery(executor).unassignTeacher(user, IDS.classGroup, { assignmentId: IDS.assignment, reason: "x" }));
      assert.equal(executor.queries.length + executor.transactions.length, 0);
    }
  });
});

describe("the administrator's view of a class group's teachers", () => {
  test("each open assignment carries the teacher's name and whether the account can teach; idle assignments are visible", async () => {
    const executor = fakeExecutor(
      rules({
        classGroup: [classGroupRow()],
        assignments: [assignmentRow(), assignmentRow({ id: "f3000000-0000-4000-8000-000000000002", teacher_uid: "former-1" }), assignmentRow({ id: "f3000000-0000-4000-8000-000000000003", teacher_uid: "ghost-1" })],
        profiles: [
          { firebase_uid: "teacher-1", role: "teacher", status: "active", full_name: "Maryam Yusuf" },
          { firebase_uid: "former-1", role: "teacher", status: "inactive", full_name: "Former Teacher" },
        ],
        openEnrollments: [],
      }),
    );
    const detail = await delivery(executor).getClassGroup(admin, IDS.classGroup);
    assert.deepEqual(
      detail.teachers.map((t) => [t.teacherUid, t.teacherName, t.teacherStatus, t.teacherActive]),
      [
        ["teacher-1", "Maryam Yusuf", "active", true],
        ["former-1", "Former Teacher", "inactive", false],
        ["ghost-1", null, null, false],
      ],
    );
    const lookup = executor.queries.find((q) => R.profiles.test(q.text));
    assert.deepEqual(lookup?.values, [["teacher-1", "former-1", "ghost-1"]]);
    assertWellFormed(selectProfilesFactsQuery(["a", "b"]));

    const empty = fakeExecutor(rules({ classGroup: [classGroupRow()], assignments: [], openEnrollments: [] }));
    assert.deepEqual((await delivery(empty).getClassGroup(admin, IDS.classGroup)).teachers, []);
    assert.equal(empty.queries.some((q) => R.profiles.test(q.text)), false, "no account lookup without assignments");
  });

  test("the class group screen shows the account status and warns about teachers who cannot teach", () => {
    const screen = readFileSync(join(ROOT, "src", "components", "academy", "workspace", "admin", "class-group.tsx"), "utf8");
    assert.match(screen, /data\.teachers\.some\(\(row\) => !row\.teacherActive\) && <Notice tone="warning">\{text\.classGroup\.inactiveTeacher\}<\/Notice>/);
    assert.match(screen, /<Badge tone=\{row\.teacherActive \? "strong" : "warning"\}>\{text\.teachers\.accountStatus\[teacherAccountStatusKey\(row\.teacherStatus\)\]\}<\/Badge>/);
    assert.match(screen, /<PersonSelect id="assign-teacher" role="teacher"/);
  });
});

// ---------------------------------------------------------------------------
// Teaching access
// ---------------------------------------------------------------------------

describe("teaching access follows the open assignment and the active account", () => {
  test("relationship facts require an open assignment, an active teacher account and a live class group, bound to the caller", async () => {
    const executor = fakeExecutor();
    const facts = createSqlRelationshipFacts(executor);
    await facts.isTeacherOfClassGroup("teacher-1", IDS.classGroup);
    await facts.hasActiveTeachingRelationship("teacher-1", "student-1");
    const [ofGroup, withLearner] = executor.queries;
    for (const query of [ofGroup, withLearner]) {
      assert.match(query.text, /t\.unassigned_at IS NULL/);
      assert.match(query.text, /JOIN profiles p ON p\.firebase_uid = t\.teacher_uid AND p\.role = 'teacher' AND p\.status = 'active'/);
      assert.match(query.text, /cg\.deleted_at IS NULL/);
    }
    assert.deepEqual(ofGroup.values, [IDS.classGroup, "teacher-1"]);
    assert.deepEqual(withLearner.values, ["teacher-1", "student-1"]);
    assert.match(withLearner.text, /e\.state = 'active'/);
    // Malformed identifiers answer false without a query.
    assert.equal(await facts.isTeacherOfClassGroup("teacher-1", "not-a-uuid"), false);
    assert.equal(executor.queries.length, 2);
  });

  test("facts are read on every check: nothing is cached between requests", async () => {
    const executor = fakeExecutor([{ match: /academy_class_group_teachers/, rows: () => (executor.queries.length <= 1 ? [{ "?column?": 1 }] : []) }]);
    const facts = createSqlRelationshipFacts(executor);
    assert.equal(await facts.isTeacherOfClassGroup("teacher-1", IDS.classGroup), true);
    // Unassigned (or deactivated) in between: the very next check sees it.
    assert.equal(await facts.isTeacherOfClassGroup("teacher-1", IDS.classGroup), false);
    assert.equal(executor.queries.length, 2);
    const source = readFileSync(join(ROOT, "src", "lib", "academy", "repo", "relationship-facts.ts"), "utf8");
    assert.doesNotMatch(source, /new Map|new WeakMap|cache|memo/i);
  });

  test("the teacher workspace lists only open assignments of the session's own account", async () => {
    for (const query of [selectTeacherClassGroupsQuery("teacher-1"), selectTeacherUpcomingSessionsQuery("teacher-1", "2026-09-17T00:00:00.000Z"), selectTeacherCourseGrantsQuery("teacher-1", "b0000000-0000-4000-8000-000000000001")]) {
      assert.match(query.text, /t\.teacher_uid = \$\d+ AND t\.unassigned_at IS NULL/);
      assert.ok(query.values.includes("teacher-1"));
    }
    // Learners see only active teachers of their class group.
    assert.match(selectClassGroupTeachersQuery(IDS.classGroup).text, /p\.role = 'teacher' AND p\.status = 'active'[\s\S]*t\.unassigned_at IS NULL/);

    const executor = fakeExecutor();
    const participation = createParticipationService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, facts: createSqlRelationshipFacts(executor) });
    await participation.myTeaching(teacher);
    assert.ok(executor.queries.every((q) => q.values.includes("teacher-1")));
    for (const status of ["pending", "changes_requested", "rejected", "inactive", null]) {
      const refused = fakeExecutor();
      const svc = createParticipationService({ executor: refused, flags: { coreSchemaReady: true }, clock: fixedClock, facts: createSqlRelationshipFacts(refused) });
      await rejectsForbidden(svc.myTeaching({ uid: "teacher-1", profileId: "p", role: sessionRoleFor("teacher", status), email: null, accountRole: "teacher", accountStatus: status }));
      assert.equal(refused.queries.length, 0, String(status));
    }
  });

  test("permission matrix: assigned teacher allowed; unrelated, unassigned and applicant teachers and students refused", async () => {
    // teacher-1 teaches IDS.classGroup only; teacher-2 teaches OTHER_GROUP only.
    const open = new Set([`teacher-1:${IDS.classGroup}`, `teacher-2:${OTHER_GROUP}`]);
    const facts: RelationshipFacts = {
      isTeacherOfClassGroup: async (uid, group) => open.has(`${uid}:${group}`),
      isActiveLearnerOfClassGroup: async () => false,
      classGroupBelongsToCourse: async (group, course) => course === IDS.course && (group === IDS.classGroup || group === OTHER_GROUP),
      hasCourseAccess: async () => false,
      hasActiveTeachingRelationship: async () => false,
    };
    const requests: AccessRequest[] = [
      { action: "class_group.view", courseId: IDS.course, classGroupId: IDS.classGroup },
      { action: "class_group.read_roster", classGroupId: IDS.classGroup },
      { action: "attendance.record", classGroupId: IDS.classGroup },
      { action: "submission.review", classGroupId: IDS.classGroup },
      { action: "assessment.grade", classGroupId: IDS.classGroup },
      { action: "feedback.write", classGroupId: IDS.classGroup },
      { action: "session.conduct", classGroupId: IDS.classGroup },
      { action: "session.prepare", classGroupId: IDS.classGroup },
      { action: "lesson_sheet.read", courseId: IDS.course, classGroupId: IDS.classGroup },
      { action: "recording.view", courseId: IDS.course, classGroupId: IDS.classGroup },
    ];
    const assigned: AuthUser = { uid: "teacher-1", profileId: "p1", role: "teacher", email: null };
    const unrelated: AuthUser = { uid: "teacher-2", profileId: "p2", role: "teacher", email: null };
    const unassigned: AuthUser = { uid: "teacher-3", profileId: "p3", role: "teacher", email: null };
    const deactivated: AuthUser = { uid: "teacher-1", profileId: "p1", role: sessionRoleFor("teacher", "inactive"), email: null, accountRole: "teacher", accountStatus: "inactive" };
    for (const request of requests) {
      assert.equal((await evaluateAccess(assigned, request, facts)).allowed, true, `assigned ${request.action}`);
      for (const [label, user] of [["unrelated", unrelated], ["unassigned", unassigned], ["deactivated", deactivated], ["student", student]] as const) {
        assert.equal((await evaluateAccess(user, request, facts)).allowed, false, `${label} ${request.action}`);
      }
    }
    // The unrelated teacher keeps access to their own class group.
    assert.equal((await evaluateAccess(unrelated, { action: "class_group.read_roster", classGroupId: OTHER_GROUP }, facts)).allowed, true);
    // A class group of another course never opens this course's content to its teacher.
    assert.equal((await evaluateAccess(unrelated, { action: "course.read_content", courseId: "c0000000-0000-4000-8000-000000000009", classGroupId: OTHER_GROUP }, facts)).allowed, false);
  });
});

// ---------------------------------------------------------------------------
// Legacy teacher routes
// ---------------------------------------------------------------------------

describe("legacy teacher routes", () => {
  test("every signed-in teacher route uses the central guard, which admits only active teacher accounts", () => {
    const api = join(ROOT, "src", "app", "api", "teacher");
    const routes = [
      "applications", "apply", "available-course", "course", "course/[courseId]/lessons", "dashboard", "earnings", "lessons",
      "live-course", "live-course/[courseId]", "live-course/[courseId]/activate-lesson", "live-course/[courseId]/model-lessons",
      "marketing", "sessions", "students", "students/[uid]",
    ];
    for (const route of routes) {
      const src = readFileSync(join(api, route, "route.ts"), "utf8").replace(/\/\/[^\n]*/g, "");
      assert.match(src, /import \{ requireTeacher \} from "@\/lib\/auth";|import \{ requireTeacher \} from '@\/lib\/auth';/, route);
      assert.match(src, /await requireTeacher\((req|request)\)/, route);
      assert.doesNotMatch(src, /verifyIdToken|getServerSession|role !== ["']teacher["']|export async function/, route);
    }
    // The two remaining public routes take no session and expose no private fields.
    const publicProfile = readFileSync(join(api, "public", "[uid]", "route.ts"), "utf8");
    assert.match(publicProfile, /status = 'active'/, "public teacher profiles are limited to active teachers");
  });
});
