/**
 * Core academic structure services against a scripted fake database.
 *
 * Covered: administrator-only access (checked before any query), readiness
 * flag, one guarded transaction per change with its audit event, stale and
 * duplicate writes mapped to safe conflicts, outline replacement order,
 * supersede-before-publish, self-approval rules, and delivery guards.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import { createCatalogService } from "../../src/lib/academy/services/catalog-service.ts";
import { createCurriculumService } from "../../src/lib/academy/services/curriculum-service.ts";
import { createDeliveryService } from "../../src/lib/academy/services/delivery-service.ts";
import { STALE_MESSAGE } from "../../src/lib/academy/services/support.ts";
import {
  IDS,
  admin,
  admin2,
  classGroupRow,
  courseRow,
  curriculumRow,
  fakeExecutor,
  fixedClock,
  programRow,
  rejectsDomain,
  rejectsForbidden,
  sequentialIds,
  student,
  teacher,
  versionRow,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const READY = { coreSchemaReady: true };

function services(executor: FakeExecutor, flags = READY) {
  const deps = { executor, flags, clock: fixedClock, newId: sequentialIds() };
  return { catalog: createCatalogService(deps), curriculum: createCurriculumService(deps), delivery: createDeliveryService(deps) };
}

const R = {
  program: /FROM academy_programs WHERE id/,
  course: /FROM academy_courses WHERE id/,
  curriculumByCourse: /FROM academy_curricula WHERE course_id/,
  curriculumById: /FROM academy_curricula WHERE id/,
  version: /FROM academy_curriculum_versions WHERE id/,
  versions: /FROM academy_curriculum_versions WHERE curriculum_id/,
  identities: /UNION ALL/,
  outlineUnits: /FROM academy_curriculum_version_units/,
  lessonIdsInVersion: /^SELECT lesson_id FROM academy_curriculum_version_lessons/,
  outlineLessons: /FROM academy_curriculum_version_lessons/,
  gate: /academy_approval_gate_definitions/,
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  openEnrollments: /SELECT learner_uid, state FROM academy_enrollments/,
  profile: /FROM profiles/,
  programCourses: /count\(\*\) AS n FROM academy_courses/,
  openClassGroups: /count\(\*\) AS n FROM academy_class_groups/,
  assignments: /FROM academy_class_group_teachers\s+WHERE class_group_id/,
  assignment: /FROM academy_class_group_teachers WHERE id/,
  upcoming: /SELECT DISTINCT lesson_id FROM academy_sessions/,
};

function rules(...entries: [RegExp, Rule["rows"]][]): Rule[] {
  return entries.map(([match, rows]) => ({ match, rows }));
}

type Svc = ReturnType<typeof services>;
const EVERY_CALL: [string, (s: Svc, u: AuthUser) => Promise<unknown>][] = [
  ["listPrograms", (s, u) => s.catalog.listPrograms(u)],
  ["getProgram", (s, u) => s.catalog.getProgram(u, IDS.program)],
  ["createProgram", (s, u) => s.catalog.createProgram(u, { slug: "abc-def", title: "T" })],
  ["updateProgram", (s, u) => s.catalog.updateProgram(u, IDS.program, { title: "T", expectedRevision: 1 })],
  ["changeProgramStatus", (s, u) => s.catalog.changeProgramStatus(u, IDS.program, { to: "active", expectedRevision: 1 })],
  ["deleteProgram", (s, u) => s.catalog.deleteProgram(u, IDS.program, { reason: "x", expectedRevision: 1 })],
  ["restoreProgram", (s, u) => s.catalog.restoreProgram(u, IDS.program, { reason: "x", expectedRevision: 1 })],
  ["listCourses", (s, u) => s.catalog.listCourses(u)],
  ["getCourse", (s, u) => s.catalog.getCourse(u, IDS.course)],
  ["createCourse", (s, u) => s.catalog.createCourse(u, { slug: "abc-def", title: "T" })],
  ["updateCourse", (s, u) => s.catalog.updateCourse(u, IDS.course, { title: "T", expectedRevision: 1 })],
  ["changeCourseStatus", (s, u) => s.catalog.changeCourseStatus(u, IDS.course, { to: "active", expectedRevision: 1 })],
  ["moveCourse", (s, u) => s.catalog.moveCourse(u, IDS.course, { programId: null, reason: "x", expectedRevision: 1 })],
  ["deleteCourse", (s, u) => s.catalog.deleteCourse(u, IDS.course, { reason: "x", expectedRevision: 1 })],
  ["restoreCourse", (s, u) => s.catalog.restoreCourse(u, IDS.course, { reason: "x", expectedRevision: 1 })],
  ["getCurriculum", (s, u) => s.curriculum.getCurriculum(u, IDS.course)],
  ["getVersion", (s, u) => s.curriculum.getVersion(u, IDS.version1)],
  ["createDraft", (s, u) => s.curriculum.createDraft(u, IDS.course)],
  ["saveOutline", (s, u) => s.curriculum.saveOutline(u, IDS.version1, { outline: { units: [] }, expectedRevision: 1 })],
  ["review", (s, u) => s.curriculum.review(u, IDS.version1, { action: "approve", expectedRevision: 1 })],
  ["publish", (s, u) => s.curriculum.publish(u, IDS.version1, { expectedRevision: 1 })],
  ["listClassGroups", (s, u) => s.delivery.listClassGroups(u)],
  ["getClassGroup", (s, u) => s.delivery.getClassGroup(u, IDS.classGroup)],
  ["createClassGroup", (s, u) => s.delivery.createClassGroup(u, { courseId: IDS.course, name: "G" })],
  ["updateClassGroup", (s, u) => s.delivery.updateClassGroup(u, IDS.classGroup, { name: "G", expectedRevision: 1 })],
  ["changeClassGroupStatus", (s, u) => s.delivery.changeClassGroupStatus(u, IDS.classGroup, { to: "active", expectedRevision: 1 })],
  ["repinCurriculum", (s, u) => s.delivery.repinCurriculum(u, IDS.classGroup, { curriculumVersionId: IDS.version2, reason: "x", expectedRevision: 1 })],
  ["deleteClassGroup", (s, u) => s.delivery.deleteClassGroup(u, IDS.classGroup, { reason: "x", expectedRevision: 1 })],
  ["restoreClassGroup", (s, u) => s.delivery.restoreClassGroup(u, IDS.classGroup, { reason: "x", expectedRevision: 1 })],
  ["assignTeacher", (s, u) => s.delivery.assignTeacher(u, IDS.classGroup, { teacherUid: "teacher-1" })],
  ["unassignTeacher", (s, u) => s.delivery.unassignTeacher(u, IDS.classGroup, { assignmentId: IDS.assignment, reason: "x" })],
  ["listSessions", (s, u) => s.delivery.listSessions(u, IDS.classGroup)],
  ["scheduleSession", (s, u) => s.delivery.scheduleSession(u, IDS.classGroup, { lessonId: IDS.lesson1, startsAt: "2026-10-05T16:00:00Z", endsAt: "2026-10-05T17:00:00Z" })],
  ["rescheduleSession", (s, u) => s.delivery.rescheduleSession(u, IDS.session, { startsAt: "2026-10-05T16:00:00Z", endsAt: "2026-10-05T17:00:00Z", reason: "x", expectedRevision: 1 })],
  ["changeSessionStatus", (s, u) => s.delivery.changeSessionStatus(u, IDS.session, { to: "live", expectedRevision: 1 })],
  ["listEnrollments", (s, u) => s.delivery.listEnrollments(u, IDS.classGroup)],
  ["enroll", (s, u) => s.delivery.enroll(u, IDS.classGroup, { learnerUid: "student-1" })],
  ["changeEnrollmentStatus", (s, u) => s.delivery.changeEnrollmentStatus(u, IDS.enrollment, { to: "withdrawn", reason: "x", expectedRevision: 1 })],
];

describe("structure services: access", () => {
  test("teachers and students are refused every structure operation before any database access", async () => {
    for (const user of [teacher, student]) {
      for (const [name, call] of EVERY_CALL) {
        const executor = fakeExecutor();
        await rejectsForbidden(call(services(executor), user));
        assert.equal(executor.queries.length + executor.transactions.length, 0, `${user.role} ${name} touched the database`);
      }
    }
  });

  test("every operation reports 'not available yet' until the schema is ready, without database access", async () => {
    for (const [name, call] of EVERY_CALL) {
      const executor = fakeExecutor();
      await rejectsDomain(call(services(executor, { coreSchemaReady: false }), admin), "FEATURE_UNAVAILABLE");
      assert.equal(executor.queries.length + executor.transactions.length, 0, name);
    }
  });
});

describe("catalog service", () => {
  test("a course and its curriculum are written in one transaction with the audit event", async () => {
    const executor = fakeExecutor();
    const { course, curriculum } = await services(executor).catalog.createCourse(admin, { slug: "nahw-2", title: "Nahw 2" });
    assert.equal(executor.transactions.length, 1);
    const [courseWrite, curriculumWrite] = executor.transactions[0];
    assert.match(courseWrite.text, /^WITH mutated AS \(INSERT INTO academy_courses/);
    assert.ok(courseWrite.values.includes("course.create"));
    assert.match(curriculumWrite.text, /^WITH mutated AS \(INSERT INTO academy_curricula[\s\S]*academy_expect_rows/);
    assert.equal(curriculum.courseId, course.id);
  });

  test("duplicate slugs and stale edits become safe conflicts", async () => {
    const duplicate = fakeExecutor();
    duplicate.failTransactionWith = Object.assign(new Error("duplicate key value violates unique constraint academy_programs_slug_uq"), { code: "23505" });
    await assert.rejects(services(duplicate).catalog.createProgram(admin, { slug: "arabic", title: "Arabic" }), (error: Error) => {
      assert.equal(error.message, "A program with this slug already exists.");
      return true;
    });

    const stale = fakeExecutor(rules([R.program, [programRow()]]));
    stale.failTransactionWith = Object.assign(new Error("academy stale write"), { code: "RQ409" });
    await assert.rejects(services(stale).catalog.updateProgram(admin, IDS.program, { title: "New", expectedRevision: 1 }), (error: Error) => {
      assert.equal(error.message, STALE_MESSAGE);
      return true;
    });
  });

  test("a course with running class groups cannot be deleted; otherwise it is soft-deleted with a reason", async () => {
    const busy = fakeExecutor(rules([R.course, [courseRow()]], [R.openClassGroups, [{ n: "1" }]]));
    await rejectsDomain(services(busy).catalog.deleteCourse(admin, IDS.course, { reason: "Duplicate", expectedRevision: 3 }), "CONFLICT");
    assert.equal(busy.transactions.length, 0);

    const idle = fakeExecutor(rules([R.course, [courseRow()]], [R.openClassGroups, [{ n: "0" }]]));
    const deleted = await services(idle).catalog.deleteCourse(admin, IDS.course, { reason: "Duplicate", expectedRevision: 3 });
    assert.equal(deleted.deletionReason, "Duplicate");
    assert.equal(deleted.revision, 4);
    const [lock, check, write] = idle.transactions[0];
    assert.equal(lock.text, "SELECT id FROM academy_courses WHERE id = $1::uuid FOR UPDATE");
    assert.match(check.text, /FROM academy_class_groups\s+WHERE course_id = \$1::uuid AND deleted_at IS NULL AND status IN \('planned', 'active'\)\), 0\)/);
    assert.deepEqual(check.values, [IDS.course]);
    assert.ok(write.values.includes("entity.soft_delete"));
    await rejectsDomain(services(idle).catalog.deleteCourse(admin, IDS.course, { reason: "Duplicate", expectedRevision: 2 }), "CONFLICT");

    // A class group opened between the read and the write: the database check aborts the deletion.
    const raced = fakeExecutor(rules([R.course, [courseRow()]], [R.openClassGroups, [{ n: "0" }]]));
    raced.failTransactionWith = Object.assign(new Error("expected 0 row(s), matched 1"), { code: "RQ409" });
    await rejectsDomain(services(raced).catalog.deleteCourse(admin, IDS.course, { reason: "Duplicate", expectedRevision: 3 }), "CONFLICT");
  });

  test("a program with courses cannot be deleted, including courses added while deleting", async () => {
    const executor = fakeExecutor(rules([R.program, [programRow()]], [R.programCourses, [{ n: "2" }]]));
    await rejectsDomain(services(executor).catalog.deleteProgram(admin, IDS.program, { reason: "Merge", expectedRevision: 1 }), "CONFLICT");
    assert.equal(executor.transactions.length, 0);

    const empty = fakeExecutor(rules([R.program, [programRow()]], [R.programCourses, [{ n: "0" }]]));
    await services(empty).catalog.deleteProgram(admin, IDS.program, { reason: "Merge", expectedRevision: 1 });
    const [lock, check, write] = empty.transactions[0];
    assert.equal(lock.text, "SELECT id FROM academy_programs WHERE id = $1::uuid FOR UPDATE");
    assert.match(check.text, /\(SELECT count\(\*\) FROM academy_courses WHERE program_id = \$1::uuid AND deleted_at IS NULL\), 0\)/);
    assert.deepEqual(check.values, [IDS.program]);
    assert.ok(write.values.includes("entity.soft_delete"));

    const raced = fakeExecutor(rules([R.program, [programRow()]], [R.programCourses, [{ n: "0" }]]));
    raced.failTransactionWith = Object.assign(new Error("expected 0 row(s), matched 1"), { code: "RQ409" });
    await rejectsDomain(services(raced).catalog.deleteProgram(admin, IDS.program, { reason: "Merge", expectedRevision: 1 }), "CONFLICT");
  });

  test("adding or moving a course into a program holds the program until the course is written", async () => {
    const programLock = "SELECT id FROM academy_programs WHERE id = $1::uuid FOR SHARE";
    const created = fakeExecutor(rules([R.program, [programRow()]]));
    await services(created).catalog.createCourse(admin, { programId: IDS.program, slug: "nahw-2", title: "Nahw 2" });
    const [lock, check, courseWrite, curriculumWrite] = created.transactions[0];
    assert.equal(lock.text, programLock);
    assert.deepEqual(lock.values, [IDS.program]);
    assert.match(check.text, /\(SELECT count\(\*\) FROM academy_programs WHERE id = \$1::uuid AND deleted_at IS NULL\), 1\)/);
    assert.match(courseWrite.text, /^WITH mutated AS \(INSERT INTO academy_courses/);
    assert.match(curriculumWrite.text, /INSERT INTO academy_curricula/);

    const moved = fakeExecutor(rules([R.course, [courseRow({ program_id: null })]], [R.program, [programRow()]]));
    await services(moved).catalog.moveCourse(admin, IDS.course, { programId: IDS.program, reason: "Belongs here", expectedRevision: 3 });
    assert.equal(moved.transactions[0][0].text, programLock);
    assert.match(moved.transactions[0][2].text, /UPDATE academy_courses/);

    const leaving = fakeExecutor(rules([R.course, [courseRow()]]));
    await services(leaving).catalog.moveCourse(admin, IDS.course, { programId: null, reason: "Standalone", expectedRevision: 3 });
    assert.equal(leaving.transactions[0].length, 1, "leaving a program needs no program lock");

    const raced = fakeExecutor(rules([R.program, [programRow()]]));
    raced.failTransactionWith = Object.assign(new Error("expected 1 row(s), matched 0"), { code: "RQ409" });
    await rejectsDomain(services(raced).catalog.createCourse(admin, { programId: IDS.program, slug: "nahw-2", title: "Nahw 2" }), "CONFLICT");
  });
});

describe("curriculum service", () => {
  const draftRow = versionRow({ id: IDS.version2, version_number: 2, state: "draft", revision: 1, published_at: null, published_by: null, reviewed_by: null });

  test("saving an outline replaces it atomically in dependency order", async () => {
    const executor = fakeExecutor(
      rules(
        [R.version, [draftRow]],
        [R.curriculumById, [curriculumRow()]],
        [R.identities, [{ kind: "unit", id: IDS.unit1 }, { kind: "lesson", id: IDS.lesson1 }]],
        [R.outlineUnits, []],
        [R.outlineLessons, []],
      ),
    );
    const result = await services(executor).curriculum.saveOutline(admin, IDS.version2, {
      expectedRevision: 1,
      outline: {
        units: [
          { unitId: IDS.unit1, title: "Particles", lessons: [{ lessonId: IDS.lesson1, title: "Prepositions" }, { title: "Conjunctions" }] },
          { title: "Verbs", lessons: [{ title: "Past tense" }] },
        ],
      },
    });
    assert.equal(result.version.revision, 2);
    const statements = executor.transactions[0].map((q) => q.text);
    const order = [
      /^WITH mutated AS \(UPDATE academy_curriculum_versions[\s\S]*academy_audit_events/,
      /INSERT INTO academy_units/,
      /INSERT INTO academy_lessons/,
      /^DELETE FROM academy_curriculum_version_lessons/,
      /^DELETE FROM academy_curriculum_version_units/,
      /^INSERT INTO academy_curriculum_version_units/,
      /^INSERT INTO academy_curriculum_version_lessons/,
    ];
    assert.equal(statements.length, order.length);
    order.forEach((pattern, index) => assert.match(statements[index], pattern, `statement ${index}`));
    assert.match(statements[0], /AND state = \$\d+/);
  });

  test("published outlines are immutable at the service level too", async () => {
    const executor = fakeExecutor(
      rules([R.version, [versionRow()]], [R.curriculumById, [curriculumRow()]], [R.identities, []], [R.outlineUnits, []], [R.outlineLessons, []]),
    );
    await rejectsDomain(services(executor).curriculum.saveOutline(admin, IDS.version1, { outline: { units: [] }, expectedRevision: 4 }), "IMMUTABLE");
    assert.equal(executor.transactions.length, 0);
  });

  test("an author approves their own version only when the academy's publication gate allows it", async () => {
    const inReview = versionRow({ id: IDS.version2, version_number: 2, state: "in_review", revision: 2, created_by: "admin-1", published_at: null, published_by: null });

    const noGate = fakeExecutor(rules([R.version, [inReview]], [R.gate, []]));
    await rejectsForbidden(services(noGate).curriculum.review(admin, IDS.version2, { action: "approve", expectedRevision: 2 }));
    assert.equal(noGate.transactions.length, 0);

    const otherReviewer = fakeExecutor(rules([R.version, [inReview]], [R.gate, []]));
    const approved = await services(otherReviewer).curriculum.review(admin2, IDS.version2, { action: "approve", expectedRevision: 2 });
    assert.equal(approved.state, "approved");
    assert.equal(approved.reviewedBy, "admin-2");

    const selfAllowed = fakeExecutor(rules([R.version, [inReview]], [R.gate, [{ allow_self_approval: true }]]));
    assert.equal((await services(selfAllowed).curriculum.review(admin, IDS.version2, { action: "approve", expectedRevision: 2 })).state, "approved");
  });

  test("submitting requires lessons; unknown actions and stale revisions are refused", async () => {
    const empty = fakeExecutor(rules([R.version, [draftRow]], [R.outlineUnits, []], [R.outlineLessons, []]));
    await rejectsDomain(services(empty).curriculum.review(admin, IDS.version2, { action: "submit", expectedRevision: 1 }), "CONFLICT");
    await rejectsDomain(services(empty).curriculum.review(admin, IDS.version2, { action: "publish_now", expectedRevision: 1 }), "VALIDATION");
    await rejectsDomain(services(empty).curriculum.review(admin, IDS.version2, { action: "withdraw", expectedRevision: 9 }), "CONFLICT");
    await rejectsDomain(services(empty).curriculum.review(admin, IDS.version2, { action: "request_changes", expectedRevision: 1 }), "INVALID_TRANSITION");
    assert.equal(empty.transactions.length, 0);

    const ready = fakeExecutor(
      rules(
        [R.version, [draftRow]],
        [R.outlineUnits, [{ unit_id: IDS.unit1, position: 1, title: "U", summary: null }]],
        [R.outlineLessons, [{ lesson_id: IDS.lesson1, unit_id: IDS.unit1, position: 1, title: "L", summary: null, planned_minutes: null }]],
      ),
    );
    assert.equal((await services(ready).curriculum.review(admin, IDS.version2, { action: "submit", expectedRevision: 1 })).state, "in_review");
  });

  test("publishing supersedes the current version first, in the same transaction", async () => {
    const approved = versionRow({ id: IDS.version2, version_number: 2, state: "approved", revision: 5, published_at: null, published_by: null });
    const current = versionRow();
    const executor = fakeExecutor(rules([R.version, [approved]], [R.versions, [approved, current]]));
    const result = await services(executor).curriculum.publish(admin, IDS.version2, { expectedRevision: 5 });
    assert.equal(result.published.state, "published");
    assert.equal(result.superseded?.state, "superseded");
    const [first, second] = executor.transactions[0];
    assert.ok(first.values.includes(IDS.version1) && first.values.includes("superseded"));
    assert.ok(second.values.includes(IDS.version2) && second.values.includes("published"));

    const race = fakeExecutor(rules([R.version, [approved]], [R.versions, [approved]]));
    race.failTransactionWith = Object.assign(new Error("duplicate"), { code: "23505" });
    await assert.rejects(services(race).curriculum.publish(admin, IDS.version2, { expectedRevision: 5 }), /Another version was published/);
  });
});

describe("delivery service", () => {
  test("a class group follows the published version by default and cannot open without one", async () => {
    const executor = fakeExecutor(rules([R.course, [courseRow()]], [R.curriculumByCourse, [curriculumRow()]], [R.versions, [versionRow()]]));
    const group = await services(executor).delivery.createClassGroup(admin, { courseId: IDS.course, name: "Autumn cohort", capacity: 12 });
    assert.equal(group.curriculumVersionId, IDS.version1);
    const [lock, check, insert] = executor.transactions[0];
    assert.equal(lock.text, "SELECT id FROM academy_courses WHERE id = $1::uuid FOR SHARE", "a concurrent course deletion waits for this class group");
    assert.deepEqual(lock.values, [IDS.course]);
    assert.match(check.text, /academy_expect_rows\(\s*\(SELECT count\(\*\) FROM academy_courses WHERE id = \$1::uuid AND deleted_at IS NULL\), 1\)/);
    assert.deepEqual(check.values, [IDS.course]);
    assert.match(insert.text, /INSERT INTO academy_class_groups[\s\S]*v\.state = 'published'/);

    const raced = fakeExecutor(rules([R.course, [courseRow()]], [R.curriculumByCourse, [curriculumRow()]], [R.versions, [versionRow()]]));
    raced.failTransactionWith = Object.assign(new Error("expected 1 row(s), matched 0"), { code: "RQ409" });
    await rejectsDomain(services(raced).delivery.createClassGroup(admin, { courseId: IDS.course, name: "Autumn cohort" }), "CONFLICT");

    const unpublished = fakeExecutor(
      rules([R.course, [courseRow()]], [R.curriculumByCourse, [curriculumRow()]], [R.versions, [versionRow({ state: "draft", published_at: null, published_by: null })]]),
    );
    await rejectsDomain(services(unpublished).delivery.createClassGroup(admin, { courseId: IDS.course, name: "X" }), "CONFLICT");
  });

  test("sessions are scheduled only for lessons in the pinned version", async () => {
    const executor = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.lessonIdsInVersion, [{ lesson_id: IDS.lesson1 }]]));
    const svc = services(executor).delivery;
    await rejectsDomain(
      svc.scheduleSession(admin, IDS.classGroup, { lessonId: IDS.lesson2, startsAt: "2026-10-05T16:00:00Z", endsAt: "2026-10-05T17:00:00Z" }),
      "VALIDATION",
    );
    assert.equal(executor.transactions.length, 0);
    const session = await svc.scheduleSession(admin, IDS.classGroup, { lessonId: IDS.lesson1, startsAt: "2026-10-05T19:00:00+03:00", endsAt: "2026-10-05T20:00:00+03:00" });
    assert.equal(session.startsAt, "2026-10-05T16:00:00.000Z");
    const [lock, insert] = executor.transactions[0];
    assert.match(lock.text, /FROM academy_class_groups WHERE id = \$1::uuid FOR UPDATE$/, "waits for a concurrent re-pin");
    assert.deepEqual(lock.values, [IDS.classGroup]);
    assert.match(insert.text, /INSERT INTO academy_sessions[\s\S]*cg\.curriculum_version_id = \$\d+::uuid/);
  });

  test("deleting a class group re-checks open enrollments under the enrollment lock", async () => {
    const withLearners = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.openEnrollments, [{ learner_uid: "student-1", state: "active" }]]));
    await rejectsDomain(services(withLearners).delivery.deleteClassGroup(admin, IDS.classGroup, { reason: "Merged", expectedRevision: 2 }), "CONFLICT");
    assert.equal(withLearners.transactions.length, 0);

    const executor = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.openEnrollments, []]));
    const deleted = await services(executor).delivery.deleteClassGroup(admin, IDS.classGroup, { reason: "Merged", expectedRevision: 2 });
    assert.notEqual(deleted.deletedAt, null);
    const [lock, check, update] = executor.transactions[0];
    assert.match(lock.text, /FOR UPDATE$/);
    assert.match(check.text, /academy_expect_rows\(\s*\(SELECT count\(\*\) FROM academy_enrollments\s+WHERE class_group_id = \$1::uuid AND state IN \('pending', 'active', 'suspended'\)\),\s*0\)/);
    assert.deepEqual(check.values, [IDS.classGroup]);
    assert.match(update.text, /UPDATE academy_class_groups[\s\S]*academy_audit_events/);

    // A learner enrolled between the read and the write: the database check aborts the deletion.
    const raced = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.openEnrollments, []]));
    raced.failTransactionWith = Object.assign(new Error("expected 0 rows, got 1"), { code: "RQ409" });
    await rejectsDomain(services(raced).delivery.deleteClassGroup(admin, IDS.classGroup, { reason: "Merged", expectedRevision: 2 }), "CONFLICT");
  });

  test("a new capacity is re-checked against open enrollments under the lock; other edits take no lock", async () => {
    const executor = fakeExecutor(rules([R.classGroup, [classGroupRow({ capacity: 20 })]], [R.openEnrollments, [{ learner_uid: "student-1", state: "active" }]]));
    await services(executor).delivery.updateClassGroup(admin, IDS.classGroup, { capacity: 12, expectedRevision: 2 });
    const [lock, check, update] = executor.transactions[0];
    assert.match(lock.text, /FOR UPDATE$/);
    assert.match(check.text, /SELECT count\(\*\) FROM academy_enrollments e[\s\S]*\) > \$2::bigint\),\s*0\)/);
    assert.deepEqual(check.values, [IDS.classGroup, 12]);
    assert.match(update.text, /UPDATE academy_class_groups/);

    const tooLow = fakeExecutor(rules([R.classGroup, [classGroupRow({ capacity: 20 })]], [R.openEnrollments, [{ learner_uid: "student-1", state: "active" }, { learner_uid: "student-2", state: "pending" }]]));
    await rejectsDomain(services(tooLow).delivery.updateClassGroup(admin, IDS.classGroup, { capacity: 1, expectedRevision: 2 }), "CONFLICT");
    assert.equal(tooLow.transactions.length, 0);

    const rename = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.openEnrollments, []]));
    await services(rename).delivery.updateClassGroup(admin, IDS.classGroup, { name: "Winter cohort", expectedRevision: 2 });
    assert.equal(rename.transactions[0].length, 1, "no capacity, nothing to re-check");

    const raced = fakeExecutor(rules([R.classGroup, [classGroupRow({ capacity: 20 })]], [R.openEnrollments, []]));
    raced.failTransactionWith = Object.assign(new Error("expected 0 rows, got 1"), { code: "RQ409" });
    await rejectsDomain(services(raced).delivery.updateClassGroup(admin, IDS.classGroup, { capacity: 1, expectedRevision: 2 }), "CONFLICT");
  });

  test("enrollment locks the class group, then inserts under capacity with its audit", async () => {
    const executor = fakeExecutor(
      rules([R.classGroup, [classGroupRow({ capacity: 10 })]], [R.profile, [{ firebase_uid: "student-1", role: "student", status: "active" }]], [R.openEnrollments, []]),
    );
    const enrollment = await services(executor).delivery.enroll(admin, IDS.classGroup, { learnerUid: "student-1", activate: true });
    assert.equal(enrollment.state, "active");
    const [lock, insert] = executor.transactions[0];
    assert.match(lock.text, /FOR UPDATE$/);
    assert.match(insert.text, /INSERT INTO academy_enrollments[\s\S]*academy_audit_events/);
  });

  test("enrollment refuses non-learners, invalid flags and duplicates", async () => {
    const teacherProfile = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.profile, [{ firebase_uid: "teacher-1", role: "teacher", status: "active" }]], [R.openEnrollments, []]));
    await rejectsDomain(services(teacherProfile).delivery.enroll(admin, IDS.classGroup, { learnerUid: "teacher-1" }), "VALIDATION");
    await rejectsDomain(services(teacherProfile).delivery.enroll(admin, IDS.classGroup, { learnerUid: "has space" }), "VALIDATION");
    assert.equal(teacherProfile.transactions.length, 0);

    const learner = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.profile, [{ firebase_uid: "student-1", role: "student", status: "active" }]], [R.openEnrollments, []]));
    await rejectsDomain(services(learner).delivery.enroll(admin, IDS.classGroup, { learnerUid: "student-1", activate: "yes" }), "VALIDATION");
    learner.failTransactionWith = Object.assign(new Error("dup"), { code: "23505" });
    await assert.rejects(services(learner).delivery.enroll(admin, IDS.classGroup, { learnerUid: "student-1" }), /already enrolled/);
  });

  test("re-pinning refuses a version that drops lessons of upcoming sessions", async () => {
    const executor = fakeExecutor(
      rules(
        [R.classGroup, [classGroupRow()]],
        [R.course, [courseRow()]],
        [R.curriculumByCourse, [curriculumRow()]],
        [R.version, [versionRow({ id: IDS.version2, version_number: 2 })]],
        [R.upcoming, [{ lesson_id: IDS.lesson1 }]],
        [R.lessonIdsInVersion, [{ lesson_id: IDS.lesson2 }]],
      ),
    );
    await rejectsDomain(
      services(executor).delivery.repinCurriculum(admin, IDS.classGroup, { curriculumVersionId: IDS.version2, reason: "Revised", expectedRevision: 2 }),
      "CONFLICT",
    );
    assert.equal(executor.transactions.length, 0);
  });

  test("re-pinning re-checks upcoming sessions against the new version under the lock sessions are scheduled with", async () => {
    const world = () =>
      rules(
        [R.classGroup, [classGroupRow()]],
        [R.course, [courseRow()]],
        [R.curriculumByCourse, [curriculumRow()]],
        [R.version, [versionRow({ id: IDS.version2, version_number: 2 })]],
        [R.upcoming, [{ lesson_id: IDS.lesson1 }]],
        [R.lessonIdsInVersion, [{ lesson_id: IDS.lesson1 }, { lesson_id: IDS.lesson2 }]],
      );
    const executor = fakeExecutor(world());
    const repinned = await services(executor).delivery.repinCurriculum(admin, IDS.classGroup, { curriculumVersionId: IDS.version2, reason: "Revised", expectedRevision: 2 });
    assert.equal(repinned.curriculumVersionId, IDS.version2);
    const [lock, check, update] = executor.transactions[0];
    assert.match(lock.text, /FOR UPDATE$/);
    assert.match(check.text, /FROM academy_sessions s[\s\S]*s\.state IN \('scheduled', 'live'\)[\s\S]*NOT EXISTS[\s\S]*l\.curriculum_version_id = \$2::uuid AND l\.lesson_id = s\.lesson_id/);
    assert.deepEqual(check.values, [IDS.classGroup, IDS.version2]);
    assert.match(update.text, /UPDATE academy_class_groups[\s\S]*academy_audit_events/);

    // A session for a lesson missing from the new version was scheduled meanwhile.
    const raced = fakeExecutor(world());
    raced.failTransactionWith = Object.assign(new Error("expected 0 rows, got 1"), { code: "RQ409" });
    await rejectsDomain(
      services(raced).delivery.repinCurriculum(admin, IDS.classGroup, { curriculumVersionId: IDS.version2, reason: "Revised", expectedRevision: 2 }),
      "CONFLICT",
    );
  });

  test("teacher assignment validates the account and couples the audit", async () => {
    const executor = fakeExecutor(
      rules([R.classGroup, [classGroupRow()]], [R.profile, [{ firebase_uid: "teacher-1", role: "teacher", status: "active" }]], [R.assignments, []]),
    );
    const assignment = await services(executor).delivery.assignTeacher(admin, IDS.classGroup, { teacherUid: "teacher-1" });
    assert.equal(assignment.teacherUid, "teacher-1");
    const [lock, insert] = executor.transactions[0];
    assert.equal(lock.text, "SELECT firebase_uid FROM profiles WHERE firebase_uid = $1 FOR SHARE", "a concurrent deactivation waits for the assignment");
    assert.deepEqual(lock.values, ["teacher-1"]);
    assert.match(insert.text, /INSERT INTO academy_class_group_teachers[\s\S]*p\.role = 'teacher' AND p\.status = 'active'[\s\S]*academy_audit_events/);

    const missing = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.profile, []], [R.assignments, []]));
    await rejectsDomain(services(missing).delivery.assignTeacher(admin, IDS.classGroup, { teacherUid: "ghost-1" }), "NOT_FOUND");
  });

  test("only an approved, active teacher account can be assigned; students, applicants and duplicates are refused before writing", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ firebase_uid: "student-1", role: "student", status: "active" }, "VALIDATION"],
      [{ firebase_uid: "admin-9", role: "admin", status: "active" }, "VALIDATION"],
      [{ firebase_uid: "applicant-1", role: "teacher", status: "pending" }, "CONFLICT"],
      [{ firebase_uid: "applicant-2", role: "teacher", status: "changes_requested" }, "CONFLICT"],
      [{ firebase_uid: "applicant-3", role: "teacher", status: "rejected" }, "CONFLICT"],
      [{ firebase_uid: "former-1", role: "teacher", status: "inactive" }, "CONFLICT"],
      [{ firebase_uid: "legacy-1", role: "teacher", status: null }, "CONFLICT"],
    ];
    for (const [profile, code] of cases) {
      const executor = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.profile, [profile]], [R.assignments, []]));
      await rejectsDomain(services(executor).delivery.assignTeacher(admin, IDS.classGroup, { teacherUid: profile.firebase_uid }), code);
      assert.equal(executor.transactions.length, 0, String(profile.firebase_uid));
    }
    const assigned = { id: IDS.assignment, class_group_id: IDS.classGroup, teacher_uid: "teacher-1", assigned_by: "admin-1", assigned_at: "2026-09-01T00:00:00Z", unassigned_by: null, unassigned_at: null, unassign_reason: null };
    const duplicate = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.profile, [{ firebase_uid: "teacher-1", role: "teacher", status: "active" }]], [R.assignments, [assigned]]));
    await rejectsDomain(services(duplicate).delivery.assignTeacher(admin, IDS.classGroup, { teacherUid: "teacher-1" }), "CONFLICT");
    assert.equal(duplicate.transactions.length, 0);
    // Deactivated between the read and the write: the database re-check aborts the assignment.
    const raced = fakeExecutor(rules([R.classGroup, [classGroupRow()]], [R.profile, [{ firebase_uid: "teacher-1", role: "teacher", status: "active" }]], [R.assignments, []]));
    raced.failTransactionWith = Object.assign(new Error("expected 1 row(s), matched 0"), { code: "RQ409" });
    await rejectsDomain(services(raced).delivery.assignTeacher(admin, IDS.classGroup, { teacherUid: "teacher-1" }), "CONFLICT");
  });
});
