/**
 * Lesson Sheet, annotation, preparation and lesson script services against a
 * scripted fake database.
 *
 * Required invariants covered here:
 *   - learners and teachers cannot read a Lesson Sheet before its release
 *     (locked rule, academy time zone), administrators can;
 *   - unrelated learners and teachers are refused before release is computed;
 *   - an unconfigured academy time zone fails closed;
 *   - learners never receive teacher notes or answers;
 *   - annotations are looked up by owner only;
 *   - preparation is teacher-only, opens at release, and admins see status only;
 *   - teachers cannot author or publish canonical content.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import type { SqlRow } from "../../src/lib/academy/infra/sql.ts";
import type { RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";
import { createLessonScriptService } from "../../src/lib/academy/services/lesson-script-service.ts";
import { createLessonSheetService } from "../../src/lib/academy/services/lesson-sheet-service.ts";
import {
  IDS,
  admin,
  admin2,
  classGroupRow,
  fakeExecutor,
  rejectsDomain,
  rejectsForbidden,
  sequentialIds,
  sessionRow,
  student,
  teacher,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const outsider: AuthUser = { uid: "student-2", profileId: "p-student-2", role: "student", email: "student2@example.test" };
const otherTeacher: AuthUser = { uid: "teacher-2", profileId: "p-teacher-2", role: "teacher", email: "teacher2@example.test" };

const SCRIPT = "5c000000-0000-4000-8000-000000000001";
const SCRIPT_V1 = "5d000000-0000-4000-8000-000000000001";
const SCRIPT_V2 = "5d000000-0000-4000-8000-000000000002";
const BLOCK_P = "b0000000-0000-4000-8000-000000000002";
const BLOCK_NOTE = "b0000000-0000-4000-8000-000000000004";

// Session: Tuesday 27 Oct 2026 19:00 London -> sheet released Tuesday 20 Oct 19:00 BST (18:00Z).
const SESSION_START = "2026-10-27T19:00:00.000Z";
const BEFORE_RELEASE = () => new Date("2026-10-20T17:59:00.000Z");
const AFTER_RELEASE = () => new Date("2026-10-20T18:00:00.000Z");

const CONTENT = {
  blocks: [
    { id: BLOCK_P, type: "paragraph", text: "A nominal sentence starts with a noun." },
    { id: BLOCK_NOTE, type: "teacher_note", text: "Private guidance for the teacher." },
  ],
};

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

const R = {
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  lesson: /FROM academy_lessons l JOIN academy_curricula/,
  lessonSessions: /^SELECT id, starts_at, state FROM academy_sessions/,
  policy: /FROM academy_policy_values/,
  scriptByLesson: /FROM academy_lesson_scripts WHERE lesson_id/,
  publishedVersion: /FROM academy_lesson_script_versions WHERE lesson_script_id = \$1::uuid AND state = 'published'/,
  scriptVersion: /FROM academy_lesson_script_versions WHERE id = \$1::uuid$/,
  scriptVersions: /FROM academy_lesson_script_versions WHERE lesson_script_id = \$1::uuid ORDER BY/,
  lessonTitle: /SELECT vl\.title, vl\.summary/,
  ownAnnotations: /FROM academy_lesson_annotations\s+WHERE owner_uid/,
  ownAnnotation: /FROM academy_lesson_annotations WHERE id/,
  session: /FROM academy_sessions WHERE id = \$1::uuid$/,
  ownPreparation: /FROM academy_session_preparations WHERE session_id = \$1::uuid AND teacher_uid/,
  preparationStatuses: /SELECT session_id, teacher_uid, status, updated_at, ready_at/,
  assignments: /FROM academy_class_group_teachers\s+WHERE class_group_id/,
  sheetSessions: /FROM academy_sessions s\s+JOIN/,
  gate: /academy_approval_gate_definitions/,
};

function scriptVersionRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: SCRIPT_V1, lesson_script_id: SCRIPT, version_number: 1, based_on_version_id: null, state: "published", revision: 3,
    created_by: "admin-1", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z", submitted_at: "2026-09-01T12:00:00Z",
    reviewed_by: "admin-2", reviewed_at: "2026-09-02T00:00:00Z", published_by: "admin-2", published_at: "2026-09-02T00:00:00Z",
    superseded_at: null, archived_at: null, content: CONTENT, ...overrides,
  };
}

const TIMEZONE_ROW = {
  id: "77777777-7777-4777-8777-777777777777", policy_key: "institution.timezone", scope: "academy", program_id: null, course_id: null,
  // Policy values are selected as JSON text (value::text).
  value: JSON.stringify("Europe/London"), revision: 1, set_by: "admin-1", set_at: "2026-09-01T00:00:00Z", reason: "Academy location",
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    classGroup: [classGroupRow()],
    lesson: [{ lesson_id: IDS.lesson1, curriculum_id: IDS.curriculum, course_id: IDS.course }],
    lessonSessions: [{ id: IDS.session, starts_at: SESSION_START, state: "scheduled" }],
    policy: [TIMEZONE_ROW],
    scriptByLesson: [{ id: SCRIPT, lesson_id: IDS.lesson1, curriculum_id: IDS.curriculum, created_by: "admin-1", created_at: "2026-09-01T00:00:00Z" }],
    publishedVersion: [scriptVersionRow()],
    lessonTitle: [{ title: "The nominal sentence", summary: null }],
    ownAnnotations: [],
    ownAnnotation: [],
    session: [sessionRow({ starts_at: SESSION_START })],
    ownPreparation: [],
    preparationStatuses: [],
    assignments: [],
    sheetSessions: [{ id: IDS.session, lesson_id: IDS.lesson1, starts_at: SESSION_START, state: "scheduled", lesson_title: "The nominal sentence" }],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).filter((key) => key in rows).map((key) => ({ match: R[key], rows: rows[key] }));
}

function sheets(executor: FakeExecutor, clock = AFTER_RELEASE, ready = true) {
  return createLessonSheetService({ executor, flags: { coreSchemaReady: ready }, clock, newId: sequentialIds("a0a0a0a0"), facts });
}

function queried(executor: FakeExecutor, pattern: RegExp): boolean {
  return executor.queries.some((q) => pattern.test(q.text));
}

describe("lesson sheet reading", () => {
  test("learners and teachers cannot read before release; content is never loaded", async () => {
    for (const user of [student, teacher]) {
      const executor = fakeExecutor(world());
      await rejectsDomain(sheets(executor, BEFORE_RELEASE).getSheet(user, IDS.classGroup, IDS.lesson1), "NOT_YET_AVAILABLE");
      assert.equal(queried(executor, R.publishedVersion), false, `${user.role} content was loaded before release`);
    }
  });

  test("from the release instant, the learner receives the projected sheet and only their own annotations", async () => {
    const executor = fakeExecutor(world());
    const sheet = await sheets(executor).getSheet(student, IDS.classGroup, IDS.lesson1);
    assert.equal(sheet.availability?.status, "released");
    assert.equal(sheet.availability?.releaseAt, "2026-10-20T18:00:00.000Z");
    assert.equal(sheet.content.blocks.some((b) => b.type === "teacher_note"), false);
    assert.equal(JSON.stringify(sheet).includes("Private guidance"), false);
    const annotationQuery = executor.queries.find((q) => R.ownAnnotations.test(q.text));
    assert.equal(annotationQuery?.values[0], "student-1");
  });

  test("the assigned teacher receives the full sheet after release", async () => {
    const sheet = await sheets(fakeExecutor(world())).getSheet(teacher, IDS.classGroup, IDS.lesson1);
    assert.equal(sheet.content.blocks.some((b) => b.type === "teacher_note"), true);
  });

  test("administrators read before release and without any session", async () => {
    const executor = fakeExecutor(world({ lessonSessions: [] }));
    const sheet = await sheets(executor, BEFORE_RELEASE).getSheet(admin, IDS.classGroup, IDS.lesson1);
    assert.deepEqual(sheet.availability, { status: "no_session" });
    assert.equal(sheet.content.blocks.length, 2);
  });

  test("unrelated learners and teachers are refused before any release computation", async () => {
    for (const user of [outsider, otherTeacher]) {
      const executor = fakeExecutor(world());
      await rejectsForbidden(sheets(executor).getSheet(user, IDS.classGroup, IDS.lesson1));
      assert.equal(queried(executor, R.lessonSessions) || queried(executor, R.policy), false);
    }
  });

  test("an unconfigured academy time zone fails closed for learners but not for administrators", async () => {
    await rejectsDomain(sheets(fakeExecutor(world({ policy: [] }))).getSheet(student, IDS.classGroup, IDS.lesson1), "POLICY_UNCONFIGURED");
    const adminSheet = await sheets(fakeExecutor(world({ policy: [] }))).getSheet(admin, IDS.classGroup, IDS.lesson1);
    assert.equal(adminSheet.availability, null);
  });

  test("a lesson with no remaining session is not available to learners", async () => {
    const executor = fakeExecutor(world({ lessonSessions: [{ id: IDS.session, starts_at: SESSION_START, state: "cancelled" }] }));
    await rejectsDomain(sheets(executor).getSheet(student, IDS.classGroup, IDS.lesson1), "NOT_YET_AVAILABLE");
  });

  test("unknown class groups look forbidden to participants and missing to administrators", async () => {
    await rejectsForbidden(sheets(fakeExecutor(world({ classGroup: [] }))).getSheet(student, IDS.classGroup, IDS.lesson1));
    await rejectsDomain(sheets(fakeExecutor(world({ classGroup: [] }))).getSheet(admin, IDS.classGroup, IDS.lesson1), "NOT_FOUND");
  });

  test("lessons of another curriculum and unpublished sheets are not found", async () => {
    const foreign = world({ lesson: [{ lesson_id: IDS.lesson1, curriculum_id: "c1000000-0000-4000-8000-000000000099", course_id: IDS.course }] });
    await rejectsDomain(sheets(fakeExecutor(foreign)).getSheet(student, IDS.classGroup, IDS.lesson1), "NOT_FOUND");
    await rejectsDomain(sheets(fakeExecutor(world({ publishedVersion: [] }))).getSheet(student, IDS.classGroup, IDS.lesson1), "NOT_FOUND");
  });

  test("the capability flag is checked first", async () => {
    const executor = fakeExecutor(world());
    await rejectsDomain(sheets(executor, AFTER_RELEASE, false).getSheet(student, IDS.classGroup, IDS.lesson1), "FEATURE_UNAVAILABLE");
    assert.equal(executor.queries.length, 0);
  });

  test("availability lists release times per lesson without content", async () => {
    const list = await sheets(fakeExecutor(world()), BEFORE_RELEASE).listAvailability(student, IDS.classGroup);
    assert.deepEqual(list, [
      { lessonId: IDS.lesson1, lessonTitle: "The nominal sentence", firstSessionStartsAt: SESSION_START, availability: { status: "scheduled", releaseAt: "2026-10-20T18:00:00.000Z" } },
    ]);
    await rejectsForbidden(sheets(fakeExecutor(world())).listAvailability(outsider, IDS.classGroup));
  });
});

describe("annotations", () => {
  test("learners annotate visible blocks of released sheets as themselves", async () => {
    const executor = fakeExecutor(world());
    await rejectsDomain(sheets(executor).createAnnotation(student, IDS.classGroup, IDS.lesson1, { blockId: BLOCK_NOTE, kind: "highlight" }), "VALIDATION");
    const created = await sheets(executor).createAnnotation(student, IDS.classGroup, IDS.lesson1, { blockId: BLOCK_P, kind: "note", body: "Mubtada first" });
    assert.equal(created.ownerUid, "student-1");
    const [insert] = executor.transactions[0];
    assert.match(insert.text, /INSERT INTO academy_lesson_annotations/);
    assert.ok(insert.values.includes("student-1"));
    await rejectsDomain(sheets(fakeExecutor(world()), BEFORE_RELEASE).createAnnotation(student, IDS.classGroup, IDS.lesson1, { blockId: BLOCK_P, kind: "highlight" }), "NOT_YET_AVAILABLE");
  });

  test("annotations are fetched by owner: someone else's annotation is simply not found", async () => {
    const executor = fakeExecutor(world({ ownAnnotation: [] }));
    await rejectsDomain(sheets(executor).updateAnnotation(teacher, "a0a0a0a0-0000-4000-8000-000000000001", { body: "x", expectedRevision: 1 }), "NOT_FOUND");
    const lookup = executor.queries.find((q) => R.ownAnnotation.test(q.text));
    assert.match(lookup?.text ?? "", /owner_uid = \$2/);
    assert.equal(lookup?.values[1], "teacher-1");
  });
});

describe("teacher preparation", () => {
  test("only assigned teachers prepare, and only after release", async () => {
    await rejectsForbidden(sheets(fakeExecutor(world())).getPreparation(student, IDS.session));
    await rejectsForbidden(sheets(fakeExecutor(world())).getPreparation(admin, IDS.session));
    await rejectsForbidden(sheets(fakeExecutor(world())).getPreparation(otherTeacher, IDS.session));
    await rejectsDomain(sheets(fakeExecutor(world()), BEFORE_RELEASE).getPreparation(teacher, IDS.session), "NOT_YET_AVAILABLE");
    const preparation = await sheets(fakeExecutor(world())).getPreparation(teacher, IDS.session);
    assert.equal(preparation.status, "not_started");
    assert.equal(preparation.revision, 0);
  });

  test("the first save inserts; later saves update against the revision", async () => {
    const first = fakeExecutor(world());
    await sheets(first).updatePreparation(teacher, IDS.session, { status: "in_progress", privateNotes: "Bring flashcards", expectedRevision: 0 });
    assert.match(first.transactions[0][0].text, /INSERT INTO academy_session_preparations/);

    const existing = {
      session_id: IDS.session, teacher_uid: "teacher-1", status: "in_progress", private_notes: "Bring flashcards", revision: 1,
      created_at: "2026-10-20T18:05:00Z", updated_at: "2026-10-20T18:05:00Z", ready_at: null,
    };
    const later = fakeExecutor(world({ ownPreparation: [existing] }));
    const ready = await sheets(later).updatePreparation(teacher, IDS.session, { status: "ready", expectedRevision: 1 });
    assert.equal(ready.status, "ready");
    assert.match(later.transactions[0][0].text, /UPDATE academy_session_preparations[\s\S]*revision = \$\d+/);
  });

  test("administrators see each assigned teacher's status, never private notes", async () => {
    await rejectsForbidden(sheets(fakeExecutor(world())).listPreparationStatuses(teacher, IDS.session));
    const executor = fakeExecutor(
      world({
        assignments: [
          { id: IDS.assignment, class_group_id: IDS.classGroup, teacher_uid: "teacher-1", assigned_by: "admin-1", assigned_at: "2026-09-01T00:00:00Z", unassigned_by: null, unassigned_at: null, unassign_reason: null },
          { id: "f3000000-0000-4000-8000-000000000002", class_group_id: IDS.classGroup, teacher_uid: "teacher-3", assigned_by: "admin-1", assigned_at: "2026-09-01T00:00:00Z", unassigned_by: null, unassigned_at: null, unassign_reason: null },
        ],
        preparationStatuses: [{ session_id: IDS.session, teacher_uid: "teacher-1", status: "ready", updated_at: "2026-10-21T00:00:00Z", ready_at: "2026-10-21T00:00:00Z" }],
      }),
    );
    const statuses = await sheets(executor).listPreparationStatuses(admin, IDS.session);
    assert.deepEqual(statuses.map((s) => [s.teacherUid, s.status]), [["teacher-1", "ready"], ["teacher-3", "not_started"]]);
    assert.equal(executor.queries.some((q) => /private_notes/.test(q.text)), false);
    assert.equal(JSON.stringify(statuses).includes("private"), false);
  });
});

describe("lesson script authoring", () => {
  function scripts(executor: FakeExecutor) {
    return createLessonScriptService({ executor, flags: { coreSchemaReady: true }, clock: AFTER_RELEASE, newId: sequentialIds("5e5e5e5e") });
  }

  test("teachers and learners can never author, review or publish canonical content", async () => {
    for (const user of [teacher, student]) {
      const executor = fakeExecutor(world());
      const svc = scripts(executor);
      await rejectsForbidden(svc.getScript(user, IDS.lesson1));
      await rejectsForbidden(svc.getVersion(user, SCRIPT_V1));
      await rejectsForbidden(svc.createDraft(user, IDS.lesson1));
      await rejectsForbidden(svc.saveContent(user, SCRIPT_V1, { content: CONTENT, expectedRevision: 1 }));
      await rejectsForbidden(svc.review(user, SCRIPT_V1, { action: "approve", expectedRevision: 1 }));
      await rejectsForbidden(svc.publish(user, SCRIPT_V1, { expectedRevision: 1 }));
      assert.equal(executor.queries.length + executor.transactions.length, 0);
    }
  });

  test("the first draft creates the lesson's script and version together, with audits", async () => {
    const executor = fakeExecutor(world({ scriptByLesson: [] }));
    const { script, version } = await scripts(executor).createDraft(admin, IDS.lesson1);
    assert.equal(version.parentId, script.id);
    const [scriptWrite, versionWrite] = executor.transactions[0];
    assert.match(scriptWrite.text, /INSERT INTO academy_lesson_scripts/);
    assert.ok(scriptWrite.values.includes("lesson_script.create"));
    assert.match(versionWrite.text, /INSERT INTO academy_lesson_script_versions/);
    assert.ok(versionWrite.values.includes("version.create_draft"));
  });

  test("published content is immutable; drafts save content without copying it into the audit", async () => {
    const svcPublished = scripts(fakeExecutor([{ match: R.scriptVersion, rows: [scriptVersionRow()] }]));
    await rejectsDomain(svcPublished.saveContent(admin, SCRIPT_V1, { content: CONTENT, expectedRevision: 3 }), "IMMUTABLE");

    const draftRow = scriptVersionRow({ id: SCRIPT_V2, version_number: 2, state: "draft", revision: 1, published_at: null, published_by: null, content: { blocks: [] } });
    const executor = fakeExecutor([{ match: R.scriptVersion, rows: [draftRow] }]);
    const saved = await scripts(executor).saveContent(admin, SCRIPT_V2, { content: CONTENT, expectedRevision: 1 });
    assert.equal(saved.version.revision, 2);
    const [write] = executor.transactions[0];
    assert.match(write.text, /state IN \('draft', 'changes_requested'\)/);
    const carryingText = write.values.filter((v) => typeof v === "string" && v.includes("Private guidance"));
    assert.equal(carryingText.length, 1, "only the content column carries the lesson text, not the audit metadata");
  });

  test("submitting requires teaching content; publishing supersedes the current version first", async () => {
    const empty = scriptVersionRow({ id: SCRIPT_V2, version_number: 2, state: "draft", revision: 1, published_at: null, published_by: null, content: { blocks: [] } });
    await rejectsDomain(scripts(fakeExecutor([{ match: R.scriptVersion, rows: [empty] }])).review(admin, SCRIPT_V2, { action: "submit", expectedRevision: 1 }), "CONFLICT");

    const approved = scriptVersionRow({ id: SCRIPT_V2, version_number: 2, state: "approved", revision: 4, published_at: null, published_by: null, created_by: "admin-1", reviewed_by: "admin-2" });
    const current = scriptVersionRow();
    const executor = fakeExecutor([
      { match: R.scriptVersion, rows: [approved] },
      { match: R.scriptVersions, rows: [approved, current] },
    ]);
    const result = await scripts(executor).publish(admin2, SCRIPT_V2, { expectedRevision: 4 });
    assert.equal(result.published.state, "published");
    const [first, second] = executor.transactions[0];
    assert.ok(first.values.includes(SCRIPT_V1) && first.values.includes("superseded"));
    assert.ok(second.values.includes(SCRIPT_V2) && second.values.includes("published"));
  });
});
