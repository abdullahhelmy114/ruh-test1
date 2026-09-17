/**
 * Core academic structure: query builders, row mappers and SQL relationship facts.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import { isStaleWrite, sqlQuery, type SqlQuery } from "../../src/lib/academy/infra/sql.ts";
import { expectRows, withAuditExpectOne } from "../../src/lib/academy/repo/audit-repo.ts";
import * as catalogRepo from "../../src/lib/academy/repo/catalog-repo.ts";
import * as curriculumRepo from "../../src/lib/academy/repo/curriculum-repo.ts";
import * as deliveryRepo from "../../src/lib/academy/repo/delivery-repo.ts";
import { mapProfileFacts, selectProfileFactsQuery } from "../../src/lib/academy/repo/profile-repo.ts";
import { createSqlRelationshipFacts } from "../../src/lib/academy/repo/relationship-facts.ts";
import {
  IDS,
  assertWellFormed,
  classGroupRow,
  courseRow,
  curriculumRow,
  enrollmentRow,
  fakeExecutor,
  programRow,
  sessionRow,
  versionRow,
} from "./support.ts";

const program = catalogRepo.mapProgramRow(programRow());
const course = catalogRepo.mapCourseRow(courseRow());
const curriculum = catalogRepo.mapCurriculumRow(curriculumRow());
const version = curriculumRepo.mapVersionRow(versionRow());
const group = deliveryRepo.mapClassGroupRow(classGroupRow({ capacity: 25 }));
const session = deliveryRepo.mapSessionRow(sessionRow({ meeting_url: "https://meet.example.test/x" }));
const enrollment = deliveryRepo.mapEnrollmentRow(enrollmentRow());
const assignment = deliveryRepo.mapAssignmentRow({
  id: IDS.assignment, class_group_id: IDS.classGroup, teacher_uid: "teacher-1", assigned_by: "admin-1",
  assigned_at: "2026-09-01T00:00:00Z", unassigned_by: null, unassigned_at: null, unassign_reason: null,
});
const outline = curriculumRepo.mapOutline(
  [{ unit_id: IDS.unit1, position: 1, title: "Particles", summary: null }],
  [
    { lesson_id: IDS.lesson2, unit_id: IDS.unit1, position: 2, title: "Conjunctions", summary: null, planned_minutes: "45" },
    { lesson_id: IDS.lesson1, unit_id: IDS.unit1, position: 1, title: "Prepositions", summary: "Intro", planned_minutes: null },
  ],
);

const event = buildAuditEvent(
  { actor: { uid: "admin-1", role: "admin" }, action: "course.update", object: { kind: "course", id: IDS.course } },
  { clock: () => new Date("2026-09-17T12:00:00Z"), newId: () => "99999999-9999-4999-8999-999999999999" },
);

const ALL_QUERIES: Record<string, SqlQuery> = {
  selectProgram: catalogRepo.selectProgramQuery(IDS.program),
  listPrograms: catalogRepo.listProgramsQuery({ includeDeleted: true }),
  insertProgram: catalogRepo.insertProgramQuery(program),
  updateProgram: catalogRepo.updateProgramQuery(program, 1),
  countProgramCourses: catalogRepo.countProgramCoursesQuery(IDS.program),
  selectCourse: catalogRepo.selectCourseQuery(IDS.course),
  listCourses: catalogRepo.listCoursesQuery({ programId: IDS.program }),
  insertCourse: catalogRepo.insertCourseQuery(course),
  updateCourse: catalogRepo.updateCourseQuery(course, 3),
  countOpenClassGroups: catalogRepo.countOpenClassGroupsQuery(IDS.course),
  lockProgramExclusive: catalogRepo.lockProgramQuery(IDS.program, "exclusive"),
  lockCourseShared: catalogRepo.lockCourseQuery(IDS.course, "shared"),
  expectProgramHasNoCourses: catalogRepo.expectProgramHasNoCoursesQuery(IDS.program),
  expectProgramNotDeleted: catalogRepo.expectProgramNotDeletedQuery(IDS.program),
  expectCourseHasNoOpenClassGroups: catalogRepo.expectCourseHasNoOpenClassGroupsQuery(IDS.course),
  expectCourseNotDeleted: catalogRepo.expectCourseNotDeletedQuery(IDS.course),
  insertCurriculum: catalogRepo.insertCurriculumQuery(curriculum),
  selectCurriculumByCourse: catalogRepo.selectCurriculumByCourseQuery(IDS.course),
  selectVersion: curriculumRepo.selectVersionQuery(IDS.version1),
  listVersions: curriculumRepo.listVersionsQuery(IDS.curriculum),
  insertVersion: curriculumRepo.insertVersionQuery(version),
  updateVersion: curriculumRepo.updateVersionQuery(version, { revision: 3, state: "approved" }),
  selectIdentities: curriculumRepo.selectIdentitiesQuery(IDS.curriculum),
  insertUnits: curriculumRepo.insertIdentitiesQuery("academy_units", IDS.curriculum, [IDS.unit1], "admin-1", "2026-09-17T12:00:00Z"),
  outlineUnits: curriculumRepo.selectOutlineUnitsQuery(IDS.version1),
  outlineLessons: curriculumRepo.selectOutlineLessonsQuery(IDS.version1),
  deleteOutlineLessons: curriculumRepo.deleteOutlineLessonsQuery(IDS.version2),
  deleteOutlineUnits: curriculumRepo.deleteOutlineUnitsQuery(IDS.version2),
  insertOutlineUnits: curriculumRepo.insertOutlineUnitsQuery(IDS.version2, IDS.curriculum, outline),
  insertOutlineLessons: curriculumRepo.insertOutlineLessonsQuery(IDS.version2, IDS.curriculum, outline),
  copyOutlineUnits: curriculumRepo.copyOutlineUnitsQuery(IDS.version2, IDS.version1),
  copyOutlineLessons: curriculumRepo.copyOutlineLessonsQuery(IDS.version2, IDS.version1),
  lessonIdsInVersion: curriculumRepo.selectLessonIdsInVersionQuery(IDS.version1),
  publicationGate: curriculumRepo.selectPublicationGateDefinitionQuery(),
  selectClassGroup: deliveryRepo.selectClassGroupQuery(IDS.classGroup),
  listClassGroups: deliveryRepo.listClassGroupsQuery({ courseId: null }),
  insertClassGroup: deliveryRepo.insertClassGroupQuery(group),
  updateClassGroup: deliveryRepo.updateClassGroupQuery(group, 2),
  lockClassGroup: deliveryRepo.lockClassGroupQuery(IDS.classGroup),
  expectNoOpenEnrollments: deliveryRepo.expectNoOpenEnrollmentsQuery(IDS.classGroup),
  expectOpenEnrollmentsWithin: deliveryRepo.expectOpenEnrollmentsWithinQuery(IDS.classGroup, 12),
  expectUpcomingLessonsInVersion: deliveryRepo.expectUpcomingLessonsInVersionQuery(IDS.classGroup, IDS.version2),
  listAssignments: deliveryRepo.listAssignmentsQuery(IDS.classGroup, true),
  selectAssignment: deliveryRepo.selectAssignmentQuery(IDS.assignment),
  insertAssignment: deliveryRepo.insertAssignmentQuery(assignment),
  unassign: deliveryRepo.unassignQuery(assignment),
  selectSession: deliveryRepo.selectSessionQuery(IDS.session),
  listSessions: deliveryRepo.listSessionsQuery(IDS.classGroup),
  upcomingLessons: deliveryRepo.selectUpcomingLessonIdsQuery(IDS.classGroup),
  insertSession: deliveryRepo.insertSessionQuery(session),
  updateSession: deliveryRepo.updateSessionQuery(session, { revision: 1, state: "scheduled" }),
  selectEnrollment: deliveryRepo.selectEnrollmentQuery(IDS.enrollment),
  listEnrollments: deliveryRepo.listEnrollmentsQuery(IDS.classGroup),
  openEnrollments: deliveryRepo.selectOpenEnrollmentsQuery(IDS.classGroup),
  insertEnrollment: deliveryRepo.insertEnrollmentQuery(enrollment),
  updateEnrollment: deliveryRepo.updateEnrollmentQuery(enrollment, { revision: 1, state: "active" }),
  selectProfile: selectProfileFactsQuery("student-1"),
};

describe("structure query builders", () => {
  test("every query uses each placeholder and supplies exactly one value per placeholder", () => {
    for (const [name, query] of Object.entries(ALL_QUERIES)) {
      assert.doesNotThrow(() => assertWellFormed(query), name);
    }
  });

  test("identifiers and user text never appear in SQL text", () => {
    for (const [name, query] of Object.entries(ALL_QUERIES)) {
      for (const secret of [IDS.course, IDS.classGroup, "Nahw 1", "student-1", "https://meet.example.test/x"]) {
        assert.equal(query.text.includes(secret), false, `${name} inlines ${secret}`);
      }
    }
  });

  test("INSERT ... SELECT statements cast every parameter explicitly", () => {
    for (const name of ["insertClassGroup", "insertAssignment", "insertSession", "insertEnrollment", "insertUnits", "insertOutlineUnits", "insertOutlineLessons", "copyOutlineUnits", "copyOutlineLessons"]) {
      const text = ALL_QUERIES[name].text;
      for (const match of text.matchAll(/\$(\d+)(::)?/g)) {
        assert.equal(match[2], "::", `${name}: $${match[1]} has no cast`);
      }
    }
  });

  test("writes are conditional on revision and state, and delivery inserts re-check the class group", () => {
    assert.match(ALL_QUERIES.updateCourse.text, /WHERE id = \$\d+::uuid AND revision = \$\d+/);
    assert.match(ALL_QUERIES.updateVersion.text, /AND revision = \$\d+ AND state = \$\d+/);
    assert.match(ALL_QUERIES.updateSession.text, /AND revision = \$\d+ AND state = \$\d+/);
    assert.match(ALL_QUERIES.insertClassGroup.text, /v\.state = 'published'/);
    assert.match(ALL_QUERIES.insertSession.text, /cg\.status IN \('planned', 'active'\)[\s\S]*cg\.curriculum_version_id = \$\d+::uuid/);
    assert.match(ALL_QUERIES.insertEnrollment.text, /count\(\*\)[\s\S]*< cg\.capacity/);
    assert.match(ALL_QUERIES.insertAssignment.text, /cg\.deleted_at IS NULL/);
    assert.match(ALL_QUERIES.unassign.text, /AND unassigned_at IS NULL/);
    assert.match(ALL_QUERIES.lockClassGroup.text, /FOR UPDATE$/);
  });

  test("the identity table name is never taken from input", () => {
    const query = curriculumRepo.insertIdentitiesQuery("academy_lessons; DROP TABLE profiles" as "academy_units", IDS.curriculum, [IDS.lesson1], "a", "2026-09-17T12:00:00Z");
    assert.equal(query.text.includes("DROP"), false);
  });

  test("guarded writes raise inside the database when nothing matched", () => {
    const coupled = withAuditExpectOne(catalogRepo.updateCourseQuery(course, 3), event);
    assert.match(coupled.text, /^WITH mutated AS \(UPDATE academy_courses/);
    assert.match(coupled.text, /audited AS \(INSERT INTO academy_audit_events/);
    assert.match(coupled.text, /SELECT academy_expect_rows\(\(SELECT count\(\*\) FROM audited\), 1\) AS ok$/);
    assertWellFormed(coupled);
    const plain = expectRows(catalogRepo.insertCurriculumQuery(curriculum), 1);
    assert.match(plain.text, /academy_expect_rows\(\(SELECT count\(\*\) FROM mutated\), \$\d+::bigint\)/);
    assertWellFormed(plain);
    assert.throws(() => withAuditExpectOne(sqlQuery`DELETE FROM academy_sessions WHERE id = ${IDS.session}`, event));
    assert.throws(() => expectRows(sqlQuery`DELETE FROM academy_sessions WHERE id = ${IDS.session}`, 1));
    assert.equal(isStaleWrite({ code: "RQ409" }), true);
    assert.equal(isStaleWrite({ code: "23505" }), false);
  });
});

describe("structure row mappers", () => {
  test("timestamps from Date objects or strings become ISO strings; dates stay calendar dates", () => {
    assert.equal(program.createdAt, "2026-09-01T08:00:00.000Z");
    assert.equal(course.createdAt, "2026-09-01T08:00:00.000Z");
    assert.equal(group.startsOn, "2026-10-01");
    assert.equal(session.startsAt, "2026-10-05T16:00:00.000Z");
    assert.equal(version.versionKind, "curriculum_version");
    assert.equal(version.parentId, IDS.curriculum);
  });

  test("outlines are ordered by position regardless of row order", () => {
    assert.deepEqual(outline.units[0].lessons.map((l) => l.lessonId), [IDS.lesson1, IDS.lesson2]);
    assert.equal(outline.units[0].lessons[1].plannedMinutes, 45);
  });

  test("profiles with unknown roles cannot be assigned or enrolled", () => {
    assert.deepEqual(mapProfileFacts({ firebase_uid: "student-1", role: "student", status: "active" }), { uid: "student-1", role: "student", status: "active" });
    assert.equal(mapProfileFacts({ firebase_uid: "x-1", role: "superadmin", status: "active" }), null);
    assert.equal(mapProfileFacts(undefined), null);
  });

  test("corrupt database values fail loudly instead of becoming defaults", () => {
    assert.throws(() => catalogRepo.mapCourseRow(courseRow({ created_at: "not a date" })));
    assert.throws(() => catalogRepo.mapCourseRow(courseRow({ revision: "many" })));
  });
});

describe("SQL relationship facts", () => {
  test("malformed identifiers answer false without querying", async () => {
    const executor = fakeExecutor([{ match: /./, rows: [{ "?column?": 1 }] }]);
    const facts = createSqlRelationshipFacts(executor);
    assert.equal(await facts.isTeacherOfClassGroup("teacher-1", "not-a-uuid"), false);
    assert.equal(await facts.isActiveLearnerOfClassGroup("has space", IDS.classGroup), false);
    assert.equal(await facts.classGroupBelongsToCourse(IDS.classGroup, "x"), false);
    assert.equal(await facts.hasCourseAccess("", IDS.course), false);
    assert.equal(await facts.hasActiveTeachingRelationship("teacher-1", ""), false);
    assert.equal(executor.queries.length, 0);
  });

  test("facts are true only when a row exists, with fail-closed filters in every query", async () => {
    const executor = fakeExecutor([{ match: /./, rows: [{ "?column?": 1 }] }]);
    const facts = createSqlRelationshipFacts(executor);
    assert.equal(await facts.isTeacherOfClassGroup("teacher-1", IDS.classGroup), true);
    assert.equal(await facts.isActiveLearnerOfClassGroup("student-1", IDS.classGroup), true);
    assert.equal(await facts.classGroupBelongsToCourse(IDS.classGroup, IDS.course), true);
    assert.equal(await facts.hasCourseAccess("student-1", IDS.course), true);
    assert.equal(await facts.hasActiveTeachingRelationship("teacher-1", "student-1"), true);

    const [teacherQ, learnerQ, belongsQ, accessQ, relationQ] = executor.queries;
    // A teacher counts only while the account is an active teacher: applicants and deactivated teachers lose access at once.
    for (const query of [teacherQ, relationQ]) {
      assert.match(query.text, /JOIN profiles p ON p\.firebase_uid = t\.teacher_uid AND p\.role = 'teacher' AND p\.status = 'active'/);
    }
    assert.match(teacherQ.text, /t\.unassigned_at IS NULL/);
    assert.match(teacherQ.text, /cg\.deleted_at IS NULL/);
    assert.match(learnerQ.text, /e\.state = 'active'/);
    assert.match(learnerQ.text, /cg\.status IN \('planned', 'active'\)/);
    assert.match(belongsQ.text, /c\.deleted_at IS NULL/);
    assert.match(accessQ.text, /e\.state = 'active'[\s\S]*c\.deleted_at IS NULL/);
    assert.match(relationQ.text, /t\.unassigned_at IS NULL[\s\S]*e\.state = 'active'/);
    for (const query of executor.queries) assertWellFormed(query);

    const none = createSqlRelationshipFacts(fakeExecutor());
    assert.equal(await none.hasCourseAccess("student-1", IDS.course), false);
  });
});
