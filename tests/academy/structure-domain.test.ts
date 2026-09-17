/**
 * Core academic structure: input parsers and pure planners.
 *
 * Required invariants covered here: Course is not Class Group, Lesson is not
 * Session, Curriculum is not Curriculum Version, published outlines are
 * immutable, class groups follow only published versions of their own
 * course, sessions use absolute instants and lessons of the pinned version,
 * and only learners are enrolled / only teachers assigned.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AuthError } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import {
  parseInstant,
  parseOptionalDate,
  parseOptionalHttpsUrl,
  parseSlug,
  parseTitle,
} from "../../src/lib/academy/domain/text.ts";
import { mapCourseRow, mapCurriculumRow, mapProgramRow } from "../../src/lib/academy/repo/catalog-repo.ts";
import { mapVersionRow } from "../../src/lib/academy/repo/curriculum-repo.ts";
import { mapClassGroupRow, mapEnrollmentRow, mapSessionRow } from "../../src/lib/academy/repo/delivery-repo.ts";
import {
  planCourseStatus,
  planCreateCourse,
  planCreateProgram,
  planMoveCourse,
  planProgramStatus,
  planUpdateCourse,
  type StructureContext,
} from "../../src/lib/academy/structure/catalog.ts";
import {
  assertOutlineReadyForReview,
  parseOutlineInput,
  planSaveOutline,
  type Outline,
} from "../../src/lib/academy/structure/curriculum.ts";
import {
  planAssignTeacher,
  planClassGroupStatus,
  planCreateClassGroup,
  planEnroll,
  planEnrollmentStatus,
  planRepinCurriculum,
  planRescheduleSession,
  planScheduleSession,
  planSessionStatus,
  planUnassignTeacher,
  planUpdateClassGroup,
} from "../../src/lib/academy/structure/delivery.ts";
import {
  IDS,
  classGroupRow,
  courseRow,
  curriculumRow,
  enrollmentRow,
  expectDomain,
  fixedClock,
  programRow,
  sequentialIds,
  sessionRow,
  versionRow,
} from "./support.ts";

function ctx(): StructureContext {
  return { actor: { uid: "admin-1", role: "admin" }, clock: fixedClock, newId: sequentialIds() };
}

const program = mapProgramRow(programRow());
const course = mapCourseRow(courseRow());
const curriculum = mapCurriculumRow(curriculumRow());
const published = mapVersionRow(versionRow());
const draft = mapVersionRow(versionRow({ id: IDS.version2, version_number: 2, state: "draft", revision: 1, published_at: null, published_by: null }));
const group = mapClassGroupRow(classGroupRow());

const EMPTY: Outline = { units: [] };

describe("input parsers", () => {
  test("titles are single-line and bounded; slugs are lowercase hyphenated", () => {
    assert.equal(parseTitle("  Nahw 1 ", "title"), "Nahw 1");
    expectDomain(() => parseTitle("a\nb", "title"), "VALIDATION");
    expectDomain(() => parseTitle("x".repeat(201), "title"), "VALIDATION");
    assert.equal(parseSlug("nahw-1"), "nahw-1");
    for (const bad of ["ab", "Nahw-1", "nahw--1", "-nahw", "nahw_1", "نحو"]) expectDomain(() => parseSlug(bad), "VALIDATION");
  });

  test("instants require an explicit offset and are normalised to UTC", () => {
    assert.equal(parseInstant("2026-10-05T19:00:00+03:00", "startsAt"), "2026-10-05T16:00:00.000Z");
    expectDomain(() => parseInstant("2026-10-05T19:00:00", "startsAt"), "VALIDATION");
    expectDomain(() => parseInstant("next tuesday", "startsAt"), "VALIDATION");
  });

  test("calendar dates must be real dates", () => {
    assert.equal(parseOptionalDate("2026-02-28", "d"), "2026-02-28");
    assert.equal(parseOptionalDate(null, "d"), null);
    expectDomain(() => parseOptionalDate("2026-02-30", "d"), "VALIDATION");
    expectDomain(() => parseOptionalDate("2026-2-3", "d"), "VALIDATION");
  });

  test("meeting links must be https without embedded credentials", () => {
    assert.equal(parseOptionalHttpsUrl("https://meet.example.test/room", "meetingUrl"), "https://meet.example.test/room");
    for (const bad of ["http://meet.example.test", "javascript:alert(1)", "https://user:pass@meet.example.test", "not a url"]) {
      expectDomain(() => parseOptionalHttpsUrl(bad, "meetingUrl"), "VALIDATION");
    }
  });
});

describe("programs and courses", () => {
  test("a new program starts as a draft at revision 1 with a valid audit", () => {
    const plan = planCreateProgram({ slug: "arabic-foundations", title: "Arabic Foundations" }, ctx());
    assert.equal(plan.record.status, "draft");
    assert.equal(plan.record.revision, 1);
    assert.doesNotThrow(() => buildAuditEvent(plan.audit));
  });

  test("a course is created with exactly one curriculum and a program link", () => {
    const plan = planCreateCourse({ programId: IDS.program, program, slug: "nahw-2", title: "Nahw 2" }, ctx());
    assert.equal(plan.curriculum.courseId, plan.record.id);
    assert.notEqual(plan.curriculum.id, plan.record.id);
    assert.equal(plan.audit.changedRelationships?.length, 1);
    assert.doesNotThrow(() => buildAuditEvent(plan.audit));
  });

  test("a course cannot join a missing, deleted or retired program", () => {
    expectDomain(() => planCreateCourse({ programId: IDS.program, program: null, slug: "nahw-2", title: "Nahw 2" }, ctx()), "NOT_FOUND");
    const retired = mapProgramRow(programRow({ status: "retired" }));
    expectDomain(() => planCreateCourse({ programId: IDS.program, program: retired, slug: "nahw-2", title: "Nahw 2" }, ctx()), "CONFLICT");
    const deleted = mapProgramRow(programRow({ deleted_at: "2026-09-02T00:00:00Z", deleted_by: "admin-1", deletion_reason: "dup" }));
    expectDomain(() => planCreateCourse({ programId: IDS.program, program: deleted, slug: "nahw-2", title: "Nahw 2" }, ctx()), "NOT_FOUND");
  });

  test("updates require the current revision and an actual change", () => {
    expectDomain(() => planUpdateCourse(course, { title: "Nahw One", expectedRevision: 2 }, ctx()), "CONFLICT");
    expectDomain(() => planUpdateCourse(course, { title: "Nahw 1", expectedRevision: 3 }, ctx()), "VALIDATION");
    const plan = planUpdateCourse(course, { title: "Nahw One", expectedRevision: 3 }, ctx());
    assert.equal(plan.record.revision, 4);
    assert.equal(plan.record.slug, course.slug, "slugs never change on update");
  });

  test("retiring needs a reason; lifecycle transitions are guarded", () => {
    expectDomain(() => planCourseStatus(course, { to: "retired", expectedRevision: 3 }, ctx()), "VALIDATION");
    assert.equal(planCourseStatus(course, { to: "retired", reason: "Replaced by Nahw 1b", expectedRevision: 3 }, ctx()).record.status, "retired");
    expectDomain(() => planCourseStatus(course, { to: "draft", expectedRevision: 3 }, ctx()), "INVALID_TRANSITION");
    expectDomain(() => planProgramStatus(program, { to: "published", expectedRevision: 1 }, ctx()), "VALIDATION");
  });

  test("moving a course between programs is high impact and reasoned", () => {
    expectDomain(() => planMoveCourse(course, { programId: null, program: null, reason: "", expectedRevision: 3 }, ctx()), "VALIDATION");
    const plan = planMoveCourse(course, { programId: null, program: null, reason: "Standalone offering", expectedRevision: 3 }, ctx());
    assert.equal(plan.record.programId, null);
    const event = buildAuditEvent(plan.audit);
    assert.equal(event.impact, "high");
    assert.equal(event.changedRelationships[0].change, "unlinked");
  });
});

describe("curriculum outlines", () => {
  const input = {
    units: [
      { title: "Sentence basics", lessons: [{ title: "The nominal sentence", plannedMinutes: 60 }, { title: "The verbal sentence" }] },
      { unitId: IDS.unit1, title: "Particles", lessons: [{ lessonId: IDS.lesson1, title: "Prepositions" }] },
    ],
  };

  test("outline input is validated strictly", () => {
    expectDomain(() => parseOutlineInput(null), "VALIDATION");
    expectDomain(() => parseOutlineInput({ units: [{ title: "U", lessons: "none" }] }), "VALIDATION");
    expectDomain(() => parseOutlineInput({ units: [{ title: "", lessons: [] }] }), "VALIDATION");
    expectDomain(() => parseOutlineInput({ units: [{ title: "U", lessons: [{ title: "L", plannedMinutes: 0 }] }] }), "VALIDATION");
    expectDomain(
      () => parseOutlineInput({ units: [{ title: "U", lessons: [{ lessonId: IDS.lesson1, title: "A" }, { lessonId: IDS.lesson1, title: "B" }] }] }),
      "VALIDATION",
    );
  });

  test("saving keeps existing identities, mints new ones and renumbers positions", () => {
    const plan = planSaveOutline(
      {
        version: draft,
        curriculumId: IDS.curriculum,
        units: parseOutlineInput(input),
        expectedRevision: 1,
        knownUnitIds: new Set([IDS.unit1]),
        knownLessonIds: new Set([IDS.lesson1]),
        currentOutline: EMPTY,
      },
      ctx(),
    );
    assert.equal(plan.newUnitIds.length, 1);
    assert.equal(plan.newLessonIds.length, 2);
    assert.equal(plan.outline.units[1].unitId, IDS.unit1);
    assert.equal(plan.outline.units[1].lessons[0].lessonId, IDS.lesson1);
    assert.deepEqual(plan.outline.units.map((u) => u.position), [1, 2]);
    assert.deepEqual(plan.outline.units[0].lessons.map((l) => l.position), [1, 2]);
    assert.equal(plan.version.revision, 2);
    assert.equal((plan.audit.metadata as Record<string, unknown>).addedLessons, 3);
    assert.doesNotThrow(() => buildAuditEvent(plan.audit));
  });

  test("a published outline can never be saved", () => {
    expectDomain(
      () =>
        planSaveOutline(
          { version: published, curriculumId: IDS.curriculum, units: [], expectedRevision: 4, knownUnitIds: new Set(), knownLessonIds: new Set(), currentOutline: EMPTY },
          ctx(),
        ),
      "IMMUTABLE",
    );
  });

  test("identities from another curriculum and stale revisions are refused", () => {
    const base = { version: draft, curriculumId: IDS.curriculum, units: parseOutlineInput(input), knownUnitIds: new Set<string>(), knownLessonIds: new Set([IDS.lesson1]), currentOutline: EMPTY };
    expectDomain(() => planSaveOutline({ ...base, expectedRevision: 1 }, ctx()), "VALIDATION");
    expectDomain(() => planSaveOutline({ ...base, knownUnitIds: new Set([IDS.unit1]), expectedRevision: 7 }, ctx()), "CONFLICT");
  });

  test("review needs at least one lesson and no empty units", () => {
    expectDomain(() => assertOutlineReadyForReview(EMPTY), "CONFLICT");
    expectDomain(
      () => assertOutlineReadyForReview({ units: [{ unitId: IDS.unit1, position: 1, title: "Empty", summary: null, lessons: [] }] }),
      "CONFLICT",
    );
  });
});

describe("class groups", () => {
  test("a class group follows a published version of its own course's curriculum", () => {
    const plan = planCreateClassGroup({ course, curriculum, version: published, name: "Autumn cohort", capacity: 20, startsOn: "2026-10-01" }, ctx());
    assert.equal(plan.record.courseId, course.id);
    assert.equal(plan.record.curriculumVersionId, published.id);
    assert.equal(plan.record.status, "planned");
    expectDomain(() => planCreateClassGroup({ course, curriculum, version: draft, name: "X" }, ctx()), "CONFLICT");
    const foreignCurriculum = mapCurriculumRow(curriculumRow({ course_id: "c0000000-0000-4000-8000-000000000099" }));
    expectDomain(() => planCreateClassGroup({ course, curriculum: foreignCurriculum, version: published, name: "X" }, ctx()), "VALIDATION");
    const draftCourse = mapCourseRow(courseRow({ status: "draft" }));
    expectDomain(() => planCreateClassGroup({ course: draftCourse, curriculum, version: published, name: "X" }, ctx()), "CONFLICT");
    expectDomain(
      () => planCreateClassGroup({ course, curriculum, version: published, name: "X", startsOn: "2026-10-10", endsOn: "2026-10-01" }, ctx()),
      "VALIDATION",
    );
  });

  test("capacity cannot drop below enrolled learners; finished groups are read-only", () => {
    expectDomain(() => planUpdateClassGroup(group, { capacity: 5, expectedRevision: 2, openEnrollments: 6 }, ctx()), "CONFLICT");
    assert.equal(planUpdateClassGroup(group, { capacity: 6, expectedRevision: 2, openEnrollments: 6 }, ctx()).record.capacity, 6);
    const done = mapClassGroupRow(classGroupRow({ status: "completed" }));
    expectDomain(() => planUpdateClassGroup(done, { name: "Renamed", expectedRevision: 2, openEnrollments: 0 }, ctx()), "CONFLICT");
  });

  test("cancelling requires a reason", () => {
    expectDomain(() => planClassGroupStatus(group, { to: "cancelled", expectedRevision: 2 }, ctx()), "VALIDATION");
    assert.equal(planClassGroupStatus(group, { to: "cancelled", reason: "Too few learners", expectedRevision: 2 }, ctx()).record.status, "cancelled");
  });

  test("re-pinning keeps upcoming sessions teachable", () => {
    const newer = mapVersionRow(versionRow({ id: IDS.version2, version_number: 2 }));
    const base = { course, curriculum, version: newer, reason: "Revised outline", expectedRevision: 2, lessonIdsInUse: new Set([IDS.lesson1]) };
    expectDomain(() => planRepinCurriculum(group, { ...base, lessonIdsInVersion: new Set([IDS.lesson2]) }, ctx()), "CONFLICT");
    const plan = planRepinCurriculum(group, { ...base, lessonIdsInVersion: new Set([IDS.lesson1, IDS.lesson2]) }, ctx());
    assert.equal(plan.record.curriculumVersionId, IDS.version2);
    assert.equal(plan.audit.previousVersionId, IDS.version1);
    expectDomain(() => planRepinCurriculum(group, { ...base, version: published, lessonIdsInVersion: new Set([IDS.lesson1]) }, ctx()), "VALIDATION");
  });

  test("only active teacher accounts are assigned, once; unassignment is reasoned", () => {
    const teacherFacts = { uid: "teacher-1", role: "teacher" as const, status: "active" };
    const plan = planAssignTeacher({ classGroup: group, teacher: teacherFacts, activeAssignments: [] }, ctx());
    assert.equal(plan.record.teacherUid, "teacher-1");
    expectDomain(() => planAssignTeacher({ classGroup: group, teacher: { ...teacherFacts, role: "student" }, activeAssignments: [] }, ctx()), "VALIDATION");
    expectDomain(() => planAssignTeacher({ classGroup: group, teacher: { ...teacherFacts, status: "suspended" }, activeAssignments: [] }, ctx()), "CONFLICT");
    expectDomain(() => planAssignTeacher({ classGroup: group, teacher: null, activeAssignments: [] }, ctx()), "NOT_FOUND");
    expectDomain(() => planAssignTeacher({ classGroup: group, teacher: teacherFacts, activeAssignments: [plan.record] }, ctx()), "CONFLICT");
    expectDomain(() => planUnassignTeacher({ classGroup: group, assignment: plan.record, reason: " " }, ctx()), "VALIDATION");
    const removed = planUnassignTeacher({ classGroup: group, assignment: plan.record, reason: "Schedule change" }, ctx());
    assert.notEqual(removed.record.unassignedAt, null);
    expectDomain(() => planUnassignTeacher({ classGroup: group, assignment: removed.record, reason: "again" }, ctx()), "NOT_FOUND");
  });
});

describe("sessions", () => {
  const lessons = new Set([IDS.lesson1]);

  test("a session teaches a lesson of the pinned version at absolute instants", () => {
    const plan = planScheduleSession(
      { classGroup: group, lessonId: IDS.lesson1, lessonIdsInPinnedVersion: lessons, startsAt: "2026-10-05T19:00:00+03:00", endsAt: "2026-10-05T20:30:00+03:00" },
      ctx(),
    );
    assert.equal(plan.record.startsAt, "2026-10-05T16:00:00.000Z");
    assert.equal(plan.record.curriculumVersionId, group.curriculumVersionId);
    assert.equal(plan.record.state, "scheduled");
    expectDomain(
      () => planScheduleSession({ classGroup: group, lessonId: IDS.lesson2, lessonIdsInPinnedVersion: lessons, startsAt: "2026-10-05T16:00:00Z", endsAt: "2026-10-05T17:00:00Z" }, ctx()),
      "VALIDATION",
    );
  });

  test("session windows must be positive and bounded", () => {
    const base = { classGroup: group, lessonId: IDS.lesson1, lessonIdsInPinnedVersion: lessons };
    expectDomain(() => planScheduleSession({ ...base, startsAt: "2026-10-05T17:00:00Z", endsAt: "2026-10-05T17:00:00Z" }, ctx()), "VALIDATION");
    expectDomain(() => planScheduleSession({ ...base, startsAt: "2026-10-05T17:00:00Z", endsAt: "2026-10-06T17:00:01Z" }, ctx()), "VALIDATION");
    const cancelled = mapClassGroupRow(classGroupRow({ status: "cancelled" }));
    expectDomain(() => planScheduleSession({ ...base, classGroup: cancelled, startsAt: "2026-10-05T16:00:00Z", endsAt: "2026-10-05T17:00:00Z" }, ctx()), "CONFLICT");
  });

  test("rescheduling is reasoned and only for scheduled sessions; cancelling is reasoned", () => {
    const session = mapSessionRow(sessionRow());
    const input = { startsAt: "2026-10-06T16:00:00Z", endsAt: "2026-10-06T17:00:00Z", reason: "Public holiday", expectedRevision: 1 };
    const plan = planRescheduleSession(session, input, ctx());
    assert.equal(plan.record.revision, 2);
    assert.equal((plan.audit.metadata as Record<string, unknown>).previousStartsAt, "2026-10-05T16:00:00.000Z");
    expectDomain(() => planRescheduleSession(session, { ...input, reason: "" }, ctx()), "VALIDATION");
    expectDomain(() => planRescheduleSession(mapSessionRow(sessionRow({ state: "completed" })), input, ctx()), "CONFLICT");
    expectDomain(() => planSessionStatus(session, { to: "cancelled", expectedRevision: 1 }, ctx()), "VALIDATION");
    expectDomain(() => planSessionStatus(session, { to: "completed", expectedRevision: 1 }, ctx()), "INVALID_TRANSITION");
  });
});

describe("enrollments", () => {
  const learner = { uid: "student-1", role: "student" as const, status: "active" };

  test("only active learner accounts are enrolled, once, within capacity", () => {
    const plan = planEnroll({ classGroup: group, learner, openEnrollmentsInGroup: [], activate: true, source: "admin" }, ctx());
    assert.equal(plan.record.state, "active");
    assert.equal(plan.record.courseId, group.courseId);
    assert.notEqual(plan.record.activatedAt, null);
    assert.equal(planEnroll({ classGroup: group, learner, openEnrollmentsInGroup: [], activate: false, source: "admin" }, ctx()).record.state, "pending");

    expectDomain(() => planEnroll({ classGroup: group, learner: { ...learner, role: "teacher" }, openEnrollmentsInGroup: [], activate: true, source: "admin" }, ctx()), "VALIDATION");
    expectDomain(
      () => planEnroll({ classGroup: group, learner, openEnrollmentsInGroup: [{ learnerUid: "student-1", state: "suspended" }], activate: true, source: "admin" }, ctx()),
      "CONFLICT",
    );
    const full = mapClassGroupRow(classGroupRow({ capacity: 1 }));
    expectDomain(
      () => planEnroll({ classGroup: full, learner, openEnrollmentsInGroup: [{ learnerUid: "student-9", state: "active" }], activate: true, source: "admin" }, ctx()),
      "CONFLICT",
    );
    assert.doesNotThrow(() =>
      planEnroll({ classGroup: full, learner, openEnrollmentsInGroup: [{ learnerUid: "student-9", state: "withdrawn" }], activate: true, source: "admin" }, ctx()),
    );
  });

  test("status changes are guarded, reasoned where they end or restrict access, and timestamped", () => {
    const enrollment = mapEnrollmentRow(enrollmentRow());
    expectDomain(() => planEnrollmentStatus(enrollment, { to: "suspended", expectedRevision: 1 }, ctx()), "VALIDATION");
    const withdrawn = planEnrollmentStatus(enrollment, { to: "withdrawn", reason: "Learner request", expectedRevision: 1 }, ctx());
    assert.notEqual(withdrawn.record.endedAt, null);
    expectDomain(() => planEnrollmentStatus(withdrawn.record, { to: "active", expectedRevision: 2 }, ctx()), "INVALID_TRANSITION");
    expectDomain(() => planEnrollmentStatus(enrollment, { to: "active", expectedRevision: 1 }, ctx()), "INVALID_TRANSITION");
  });
});

describe("planner audits", () => {
  test("every planner produces an audit event the registry accepts", () => {
    const teacherFacts = { uid: "teacher-1", role: "teacher" as const, status: "active" };
    const assignment = planAssignTeacher({ classGroup: group, teacher: teacherFacts, activeAssignments: [] }, ctx()).record;
    const audits = [
      planCreateClassGroup({ course, curriculum, version: published, name: "Cohort" }, ctx()).audit,
      planClassGroupStatus(group, { to: "completed", expectedRevision: 2 }, ctx()).audit,
      planUnassignTeacher({ classGroup: group, assignment, reason: "Leave" }, ctx()).audit,
      planScheduleSession({ classGroup: group, lessonId: IDS.lesson1, lessonIdsInPinnedVersion: new Set([IDS.lesson1]), startsAt: "2026-10-05T16:00:00Z", endsAt: "2026-10-05T17:00:00Z" }, ctx()).audit,
      planSessionStatus(mapSessionRow(sessionRow()), { to: "live", expectedRevision: 1 }, ctx()).audit,
      planEnroll({ classGroup: group, learner: { uid: "student-1", role: "student", status: "active" }, openEnrollmentsInGroup: [], activate: true, source: "admin" }, ctx()).audit,
    ];
    for (const audit of audits) assert.doesNotThrow(() => buildAuditEvent(audit), audit.action);
  });

  test("teacher assignment failures never surface as authentication errors", () => {
    assert.throws(
      () => planAssignTeacher({ classGroup: group, teacher: { uid: "x", role: "admin", status: "active" }, activeAssignments: [] }, ctx()),
      (error: unknown) => !(error instanceof AuthError),
    );
  });
});
