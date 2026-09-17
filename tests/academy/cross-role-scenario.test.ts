/**
 * The six accounts the signed-in end-to-end run will use, as one scenario:
 *
 *   Admin
 *   Teacher A  (active)  teaches class group A (course 1)
 *   Teacher B  (active)  teaches class group B (course 1)
 *   Student A            active learner in class group A
 *   Student B            active learner in class group B
 *   Pending Teacher      teacher account whose application is under review
 *
 * Every cross-role decision the browser run will observe is pinned here with
 * the real permission evaluator and a relationship model that mirrors the SQL
 * facts (open assignment + active teacher account + active enrollment). The
 * matrix doubles as the expected outcomes for tests/e2e.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sessionRoleFor, type AuthUser, type Role } from "../../src/lib/auth/core.ts";
import { TEACHER_APPLICATION_HOME, TEACHER_WORKSPACE_HOME, accountHome } from "../../src/lib/auth/home.ts";
import { evaluateAccess, type AccessRequest, type RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";

const COURSE = "c0000000-0000-4000-8000-000000000001";
const OTHER_COURSE = "c0000000-0000-4000-8000-000000000002";
const GROUP_A = "f0000000-0000-4000-8000-00000000000a";
const GROUP_B = "f0000000-0000-4000-8000-00000000000b";

interface Account {
  readonly uid: string;
  readonly role: Role;
  readonly status: string | null;
}

const ACCOUNTS = {
  admin: { uid: "admin-1", role: "admin", status: null },
  teacherA: { uid: "teacher-a", role: "teacher", status: "active" },
  teacherB: { uid: "teacher-b", role: "teacher", status: "active" },
  studentA: { uid: "student-a", role: "student", status: "active" },
  studentB: { uid: "student-b", role: "student", status: "active" },
  pendingTeacher: { uid: "teacher-p", role: "teacher", status: "pending" },
} as const satisfies Record<string, Account>;

type Name = keyof typeof ACCOUNTS;

/** The session a request carries: the stored role and status decide the session role, as in getSession. */
function session(name: Name, statusOverride?: string | null): AuthUser {
  const account = ACCOUNTS[name];
  const status = statusOverride === undefined ? account.status : statusOverride;
  return { uid: account.uid, profileId: `p-${account.uid}`, role: sessionRoleFor(account.role, status), email: null, accountRole: account.role, accountStatus: status };
}

/** Mirrors the SQL relationship facts over an in-memory world. */
function world(options: { readonly unassigned?: readonly string[]; readonly inactiveTeachers?: readonly string[]; readonly withdrawn?: readonly string[] } = {}): RelationshipFacts {
  const assignments = [
    { teacher: ACCOUNTS.teacherA.uid, group: GROUP_A },
    { teacher: ACCOUNTS.teacherB.uid, group: GROUP_B },
    // The pending teacher was (wrongly) left on class group A: status alone must keep them out.
    { teacher: ACCOUNTS.pendingTeacher.uid, group: GROUP_A },
  ];
  const enrollments = [
    { learner: ACCOUNTS.studentA.uid, group: GROUP_A },
    { learner: ACCOUNTS.studentB.uid, group: GROUP_B },
  ];
  const activeTeacher = (uid: string) =>
    Object.values(ACCOUNTS).some((a) => a.uid === uid && a.role === "teacher" && a.status === "active") && !(options.inactiveTeachers ?? []).includes(uid);
  const teaches = (uid: string, group: string) => assignments.some((a) => a.teacher === uid && a.group === group && !(options.unassigned ?? []).includes(uid)) && activeTeacher(uid);
  const learns = (uid: string, group: string) => enrollments.some((e) => e.learner === uid && e.group === group && !(options.withdrawn ?? []).includes(uid));
  return {
    isTeacherOfClassGroup: async (uid, group) => teaches(uid, group),
    isActiveLearnerOfClassGroup: async (uid, group) => learns(uid, group),
    classGroupBelongsToCourse: async (group, course) => course === COURSE && (group === GROUP_A || group === GROUP_B),
    hasCourseAccess: async (uid, course) => course === COURSE && enrollments.some((e) => learns(uid, e.group) && e.learner === uid),
    hasActiveTeachingRelationship: async (teacher, learner) => [GROUP_A, GROUP_B].some((group) => teaches(teacher, group) && learns(learner, group)),
  };
}

const allowed = async (user: AuthUser, request: AccessRequest, facts = world()) => (await evaluateAccess(user, request, facts)).allowed;

const TEACHING_ACTIONS = ["class_group.read_roster", "attendance.record", "submission.review", "assessment.grade", "feedback.write", "session.conduct", "session.prepare"] as const;

describe("six-account scenario", () => {
  test("each account lands on its own home", () => {
    assert.equal(accountHome("admin", null), "/dashboard/admin");
    assert.equal(accountHome("teacher", "active"), TEACHER_WORKSPACE_HOME);
    assert.equal(accountHome("student", "active"), "/dashboard/student");
    assert.equal(accountHome("teacher", "pending"), TEACHER_APPLICATION_HOME);
    assert.equal(session("pendingTeacher").role, "applicant");
  });

  test("teaching actions: a teacher acts only in the class group they teach; administrators everywhere; nobody else", async () => {
    for (const action of TEACHING_ACTIONS) {
      const onA = { action, classGroupId: GROUP_A } as AccessRequest;
      const onB = { action, classGroupId: GROUP_B } as AccessRequest;
      assert.equal(await allowed(session("teacherA"), onA), true, `Teacher A ${action} A`);
      assert.equal(await allowed(session("teacherA"), onB), false, `Teacher A ${action} B`);
      assert.equal(await allowed(session("teacherB"), onB), true, `Teacher B ${action} B`);
      assert.equal(await allowed(session("teacherB"), onA), false, `Teacher B ${action} A`);
      assert.equal(await allowed(session("pendingTeacher"), onA), false, `Pending ${action} A`);
      for (const learner of ["studentA", "studentB"] as const) {
        assert.equal(await allowed(session(learner), onA), false, `${learner} ${action}`);
      }
      // Preparation is the teacher's own work: administrators see status elsewhere, never act as the teacher.
      assert.equal(await allowed(session("admin"), onA), action !== "session.prepare", `Admin ${action}`);
    }
  });

  test("class content: learners and teachers of a class group only, through a class group of that course", async () => {
    for (const action of ["class_group.view", "lesson_sheet.read", "recording.view", "course.read_content"] as const) {
      const on = (group: string, course = COURSE) => ({ action, courseId: course, classGroupId: group }) as AccessRequest;
      assert.equal(await allowed(session("studentA"), on(GROUP_A)), true, `Student A ${action} A`);
      assert.equal(await allowed(session("teacherA"), on(GROUP_A)), true, `Teacher A ${action} A`);
      assert.equal(await allowed(session("teacherB"), on(GROUP_A)), false, `Teacher B ${action} A`);
      assert.equal(await allowed(session("pendingTeacher"), on(GROUP_A)), false, `Pending ${action} A`);
      assert.equal(await allowed(session("teacherA"), on(GROUP_A, OTHER_COURSE)), false, `Teacher A ${action} through another course`);
      assert.equal(await allowed(session("admin"), on(GROUP_B)), true, `Admin ${action}`);
    }
    assert.equal(await allowed(session("studentB"), { action: "class_group.view", courseId: COURSE, classGroupId: GROUP_A }), false, "Student B cannot open class group A");
  });

  test("private notes belong to their author alone, whatever the role or relationship", async () => {
    for (const action of ["annotation.read", "annotation.modify"] as const) {
      assert.equal(await allowed(session("studentA"), { action, ownerUid: ACCOUNTS.studentA.uid }), true);
      for (const other of ["teacherA", "admin", "studentB", "teacherB", "pendingTeacher"] as const) {
        assert.equal(await allowed(session(other), { action, ownerUid: ACCOUNTS.studentA.uid }), false, `${other} ${action} Student A's note`);
      }
    }
  });

  test("messaging needs a current teaching relationship, in both directions, rechecked on each message", async () => {
    const message = (to: Name, status?: string | null) => ({ action: "message.send", recipient: { uid: ACCOUNTS[to].uid, role: sessionRoleFor(ACCOUNTS[to].role, status === undefined ? ACCOUNTS[to].status : status) } }) as AccessRequest;
    assert.equal(await allowed(session("studentA"), message("teacherA")), true);
    assert.equal(await allowed(session("teacherA"), message("studentA")), true);
    assert.equal(await allowed(session("studentA"), message("teacherB")), false, "no relationship");
    assert.equal(await allowed(session("teacherB"), message("studentA")), false, "no relationship");
    assert.equal(await allowed(session("studentA"), message("studentB")), false, "learner to learner");
    assert.equal(await allowed(session("teacherA"), message("teacherB")), false, "teacher to teacher");
    assert.equal(await allowed(session("studentA"), message("admin")), true);
    assert.equal(await allowed(session("admin"), message("studentB")), true);
    assert.equal(await allowed(session("pendingTeacher"), message("admin")), false, "applicants take part in no conversation");
    assert.equal(await allowed(session("admin"), message("pendingTeacher")), false);
    assert.equal(await allowed(session("studentA"), message("pendingTeacher")), false);

    // The relationship ends: the next message is refused.
    for (const facts of [world({ unassigned: [ACCOUNTS.teacherA.uid] }), world({ inactiveTeachers: [ACCOUNTS.teacherA.uid] }), world({ withdrawn: [ACCOUNTS.studentA.uid] })]) {
      assert.equal(await allowed(session("studentA"), message("teacherA"), facts), false);
      assert.equal(await allowed(session("teacherA"), message("studentA"), facts), false);
    }
    // A deactivated teacher's own session is an applicant session: no sending either.
    assert.equal(await allowed(session("teacherA", "inactive"), message("studentA")), false);
  });

  test("Teacher A loses class group A the moment the assignment ends or the account is deactivated", async () => {
    const roster = { action: "class_group.read_roster", classGroupId: GROUP_A } as AccessRequest;
    assert.equal(await allowed(session("teacherA"), roster, world({ unassigned: [ACCOUNTS.teacherA.uid] })), false);
    assert.equal(await allowed(session("teacherA", "inactive"), roster), false);
    assert.equal(await allowed(session("teacherA"), roster, world({ inactiveTeachers: [ACCOUNTS.teacherA.uid] })), false);
    assert.equal(await allowed(session("teacherA"), roster), true, "and has it again once reactivated with the assignment kept");
  });
});
