/**
 * Academy core: centralised academic permissions.
 *
 * Required invariants covered here:
 *   - a student cannot reach teacher or admin actions;
 *   - a teacher cannot author or publish canonical content, change curriculum,
 *     grant entitlements or manage policy;
 *   - a teacher cannot read or change a student's private annotations;
 *   - a teacher outside the assigned class group is denied;
 *   - a class group must belong to the requested course;
 *   - a student cannot message an unrelated teacher;
 *   - an unenrolled learner is denied course content.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AuthError, type AuthUser } from "../../src/lib/auth/core.ts";
import {
  ADMIN_ONLY_ACTIONS,
  authorize,
  authorizeAdminAction,
  evaluateAccess,
  type AccessRequest,
  type RelationshipFacts,
} from "../../src/lib/academy/permissions/permissions.ts";

const COURSE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_COURSE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const GROUP = "11111111-1111-4111-8111-111111111111";
const FOREIGN_GROUP = "22222222-2222-4222-8222-222222222222";

const admin: AuthUser = { uid: "admin-1", profileId: "p1", role: "admin", email: "a@example.test" };
const teacher: AuthUser = { uid: "teacher-1", profileId: "p2", role: "teacher", email: "t@example.test" };
const otherTeacher: AuthUser = { uid: "teacher-2", profileId: "p3", role: "teacher", email: "t2@example.test" };
const learner: AuthUser = { uid: "student-1", profileId: "p4", role: "student", email: "s@example.test" };
const unenrolled: AuthUser = { uid: "student-2", profileId: "p5", role: "student", email: "s2@example.test" };

/**
 * The academic world for these tests:
 *   GROUP belongs to COURSE, taught by teacher-1, with student-1 active.
 *   FOREIGN_GROUP belongs to OTHER_COURSE, taught by teacher-2.
 *   student-1 has access to COURSE only. student-2 has access to nothing.
 */
function world(): RelationshipFacts & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async isTeacherOfClassGroup(teacherUid, classGroupId) {
      calls.push("isTeacherOfClassGroup");
      return (teacherUid === "teacher-1" && classGroupId === GROUP) || (teacherUid === "teacher-2" && classGroupId === FOREIGN_GROUP);
    },
    async isActiveLearnerOfClassGroup(learnerUid, classGroupId) {
      calls.push("isActiveLearnerOfClassGroup");
      return learnerUid === "student-1" && classGroupId === GROUP;
    },
    async classGroupBelongsToCourse(classGroupId, courseId) {
      calls.push("classGroupBelongsToCourse");
      return (classGroupId === GROUP && courseId === COURSE) || (classGroupId === FOREIGN_GROUP && courseId === OTHER_COURSE);
    },
    async hasCourseAccess(learnerUid, courseId) {
      calls.push("hasCourseAccess");
      return learnerUid === "student-1" && courseId === COURSE;
    },
    async hasActiveTeachingRelationship(teacherUid, learnerUid) {
      calls.push("hasActiveTeachingRelationship");
      return teacherUid === "teacher-1" && learnerUid === "student-1";
    },
  };
}

async function allowed(user: AuthUser, request: AccessRequest): Promise<boolean> {
  return (await evaluateAccess(user, request, world())).allowed;
}

describe("administrative actions", () => {
  test("every admin-only action is denied to teachers and students", async () => {
    for (const action of ADMIN_ONLY_ACTIONS) {
      assert.equal(await allowed(admin, { action }), true, `admin ${action}`);
      assert.equal(await allowed(teacher, { action }), false, `teacher ${action}`);
      assert.equal(await allowed(learner, { action }), false, `student ${action}`);
      assert.throws(() => authorizeAdminAction(teacher, action), AuthError);
      assert.throws(() => authorizeAdminAction(learner, action), AuthError);
      assert.doesNotThrow(() => authorizeAdminAction(admin, action));
    }
  });

  test("teachers cannot author or publish Lesson Sheets, modify curriculum, grant entitlements or manage policy", async () => {
    for (const action of ["lesson_sheet.author", "lesson_sheet.publish", "curriculum.modify", "entitlement.grant", "policy.manage"] as const) {
      assert.equal(await allowed(teacher, { action }), false, action);
    }
  });

  test("unknown actions are denied", async () => {
    assert.throws(() => authorizeAdminAction(admin, "system.shutdown" as never), AuthError);
    assert.equal(await allowed(admin, { action: "system.shutdown" } as unknown as AccessRequest), false);
  });
});

describe("course content access", () => {
  test("an active learner reads content of their course and class group", async () => {
    assert.equal(await allowed(learner, { action: "course.read_content", courseId: COURSE }), true);
    assert.equal(await allowed(learner, { action: "lesson_sheet.read", courseId: COURSE, classGroupId: GROUP }), true);
  });

  test("an unenrolled learner is denied", async () => {
    assert.equal(await allowed(unenrolled, { action: "course.read_content", courseId: COURSE }), false);
    assert.equal(await allowed(unenrolled, { action: "lesson_sheet.read", courseId: COURSE, classGroupId: GROUP }), false);
    assert.equal(await allowed(learner, { action: "course.read_content", courseId: OTHER_COURSE }), false);
  });

  test("a learner cannot borrow a class group from another course", async () => {
    assert.equal(await allowed(learner, { action: "lesson_sheet.read", courseId: COURSE, classGroupId: FOREIGN_GROUP }), false);
  });

  test("a teacher reads course content only through an assigned class group of that course", async () => {
    assert.equal(await allowed(teacher, { action: "lesson_sheet.read", courseId: COURSE, classGroupId: GROUP }), true);
    assert.equal(await allowed(teacher, { action: "lesson_sheet.read", courseId: COURSE }), false, "no class group");
    assert.equal(await allowed(otherTeacher, { action: "lesson_sheet.read", courseId: COURSE, classGroupId: GROUP }), false, "not assigned");
    assert.equal(
      await allowed(teacher, { action: "lesson_sheet.read", courseId: OTHER_COURSE, classGroupId: GROUP }),
      false,
      "class group does not belong to the course",
    );
    assert.equal(
      await allowed(otherTeacher, { action: "lesson_sheet.read", courseId: COURSE, classGroupId: FOREIGN_GROUP }),
      false,
      "own class group of a different course",
    );
  });

  test("administrators keep administrative visibility", async () => {
    assert.equal(await allowed(admin, { action: "lesson_sheet.read", courseId: COURSE }), true);
  });

  test("recordings always require a class group", async () => {
    assert.equal(await allowed(learner, { action: "recording.view", courseId: COURSE, classGroupId: GROUP }), true);
    assert.equal(await allowed(learner, { action: "recording.view", courseId: COURSE, classGroupId: "" }), false);
    assert.equal(await allowed(unenrolled, { action: "recording.view", courseId: COURSE, classGroupId: GROUP }), false);
  });

  test("empty identifiers are denied without consulting relationship facts", async () => {
    const facts = world();
    assert.equal((await evaluateAccess(learner, { action: "course.read_content", courseId: "" }, facts)).allowed, false);
    assert.deepEqual(facts.calls, []);
  });
});

describe("private annotations", () => {
  test("only the owner can read or modify, whatever the role", async () => {
    for (const action of ["annotation.read", "annotation.modify"] as const) {
      assert.equal(await allowed(learner, { action, ownerUid: "student-1" }), true);
      assert.equal(await allowed(teacher, { action, ownerUid: "student-1" }), false, `teacher ${action}`);
      assert.equal(await allowed(admin, { action, ownerUid: "student-1" }), false, `admin ${action}`);
      assert.equal(await allowed(unenrolled, { action, ownerUid: "student-1" }), false, `other student ${action}`);
    }
  });

  test("the denial reason is privacy", async () => {
    const decision = await evaluateAccess(teacher, { action: "annotation.read", ownerUid: "student-1" }, world());
    assert.deepEqual(decision, { allowed: false, reason: "privacy" });
  });
});

describe("class group teaching actions", () => {
  const actions = ["class_group.read_roster", "attendance.record", "submission.review", "assessment.grade", "feedback.write"] as const;

  test("assigned teachers and admins are allowed", async () => {
    for (const action of actions) {
      assert.equal(await allowed(teacher, { action, classGroupId: GROUP }), true, action);
      assert.equal(await allowed(admin, { action, classGroupId: GROUP }), true, action);
    }
  });

  test("a teacher outside the assigned class group is denied", async () => {
    for (const action of actions) {
      assert.equal(await allowed(otherTeacher, { action, classGroupId: GROUP }), false, action);
    }
  });

  test("students can never perform teaching actions, even in their own class group", async () => {
    for (const action of actions) {
      assert.equal(await allowed(learner, { action, classGroupId: GROUP }), false, action);
    }
  });
});

describe("messaging", () => {
  const to = (uid: string, role: AuthUser["role"]) => ({ action: "message.send" as const, recipient: { uid, role } });

  test("students message only teachers who currently teach them", async () => {
    assert.equal(await allowed(learner, to("teacher-1", "teacher")), true);
    assert.equal(await allowed(learner, to("teacher-2", "teacher")), false, "unrelated teacher");
    assert.equal(await allowed(unenrolled, to("teacher-1", "teacher")), false);
  });

  test("teachers message only their own learners", async () => {
    assert.equal(await allowed(teacher, to("student-1", "student")), true);
    assert.equal(await allowed(otherTeacher, to("student-1", "student")), false);
  });

  test("peer messaging is not part of the product; self-messaging is refused", async () => {
    assert.equal(await allowed(learner, to("student-2", "student")), false);
    assert.equal(await allowed(teacher, to("teacher-2", "teacher")), false);
    assert.equal(await allowed(learner, to("student-1", "student")), false);
  });

  test("academy administrators can be contacted and can contact anyone", async () => {
    assert.equal(await allowed(learner, to("admin-1", "admin")), true);
    assert.equal(await allowed(admin, to("student-2", "student")), true);
  });
});

describe("teacher applicants", () => {
  // teacher-1's uid, but the account is not an active teacher (pending, changes requested, rejected or deactivated).
  const applicant: AuthUser = { uid: "teacher-1", profileId: "p2", role: "applicant", email: null, accountRole: "teacher", accountStatus: "pending" };

  test("hold no academy permission, even for a class group the same uid is still assigned to, without consulting facts", async () => {
    const requests: AccessRequest[] = [
      { action: "course.read_content", courseId: COURSE, classGroupId: GROUP },
      { action: "class_group.view", courseId: COURSE, classGroupId: GROUP },
      { action: "lesson_sheet.read", courseId: COURSE, classGroupId: GROUP },
      { action: "annotation.create", courseId: COURSE, classGroupId: GROUP },
      { action: "annotation.read", ownerUid: "teacher-1" },
      { action: "annotation.modify", ownerUid: "teacher-1" },
      { action: "class_group.read_roster", classGroupId: GROUP },
      { action: "attendance.record", classGroupId: GROUP },
      { action: "submission.review", classGroupId: GROUP },
      { action: "assessment.grade", classGroupId: GROUP },
      { action: "feedback.write", classGroupId: GROUP },
      { action: "session.conduct", classGroupId: GROUP },
      { action: "session.prepare", classGroupId: GROUP },
      { action: "announcement.publish", classGroupId: GROUP },
      { action: "recording.view", courseId: COURSE, classGroupId: GROUP },
      { action: "message.send", recipient: { uid: "student-1", role: "student" } },
      { action: "message.send", recipient: { uid: "admin-1", role: "admin" } },
      ...ADMIN_ONLY_ACTIONS.map((action) => ({ action })),
    ];
    for (const request of requests) {
      const facts = world();
      const decision = await evaluateAccess(applicant, request, facts);
      assert.deepEqual(decision, { allowed: false, reason: "role" }, request.action);
      assert.deepEqual(facts.calls, [], `${request.action} consulted no relationship fact`);
    }
  });

  test("cannot be messaged, even by their would-be learners or by administrators", async () => {
    assert.equal(await allowed(learner, { action: "message.send", recipient: { uid: "teacher-1", role: "applicant" } }), false);
    assert.equal(await allowed(admin, { action: "message.send", recipient: { uid: "teacher-1", role: "applicant" } }), false);
  });
});

describe("authorize", () => {
  test("throws a generic 403 that does not disclose the reason", async () => {
    await assert.rejects(
      authorize(teacher, { action: "annotation.read", ownerUid: "student-1" }, world()),
      (error: unknown) => error instanceof AuthError && error.status === 403 && !/privacy|annotation/i.test(error.message),
    );
    await assert.doesNotReject(authorize(learner, { action: "course.read_content", courseId: COURSE }, world()));
  });
});
