/**
 * Lesson script content, private annotations and teacher preparation (pure).
 *
 * Required invariants covered here: stable block ids, learners never receive
 * teacher notes or exercise answers, annotations are owner-only and follow
 * their block across versions, preparation notes stay private.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  anchorTextOf,
  blockIdsOf,
  hasTeachingContent,
  parseLessonContent,
  projectContent,
  readStoredContent,
} from "../../src/lib/academy/lessons/content.ts";
import {
  planCreateAnnotation,
  planDeleteAnnotation,
  planUpdateAnnotation,
  withAnchorStatus,
} from "../../src/lib/academy/lessons/annotations.ts";
import { emptyPreparation, planUpdatePreparation, toStatusView } from "../../src/lib/academy/lessons/preparation.ts";
import { expectDomain, fixedClock, sequentialIds } from "./support.ts";

const B = {
  heading: "b0000000-0000-4000-8000-000000000001",
  paragraph: "b0000000-0000-4000-8000-000000000002",
  exercise: "b0000000-0000-4000-8000-000000000003",
  note: "b0000000-0000-4000-8000-000000000004",
};
const SCRIPT = "5c000000-0000-4000-8000-000000000001";
const VERSION = "5d000000-0000-4000-8000-000000000001";
const GROUP = "f0000000-0000-4000-8000-000000000001";

const input = {
  blocks: [
    { id: B.heading, type: "heading", level: 1, text: "الجملة الاسمية" },
    { id: B.paragraph, type: "paragraph", text: "A nominal sentence starts with a noun." },
    {
      id: B.exercise,
      type: "exercise",
      prompt: "Choose the subject.",
      questions: [{ id: "q1", question: "الطالبُ مجتهدٌ", options: [{ id: "a", text: "الطالبُ" }, { id: "b", text: "مجتهدٌ" }], correctOptionId: "a", explanation: "The mubtada is first." }],
    },
    { id: B.note, type: "teacher_note", text: "Ask learners for their own examples." },
    { type: "divider" },
  ],
};

const content = parseLessonContent(input, sequentialIds("b1111111"));

describe("lesson content", () => {
  test("existing block ids are kept and missing ones are generated", () => {
    assert.deepEqual(content.blocks.slice(0, 4).map((b) => b.id), [B.heading, B.paragraph, B.exercise, B.note]);
    assert.match(content.blocks[4].id, /^b1111111-/);
    assert.equal(blockIdsOf(content).size, 5);
  });

  test("structure is strict: unknown types, unknown fields, duplicate ids and bad answers are refused", () => {
    expectDomain(() => parseLessonContent({ blocks: [{ type: "html", html: "<b>x</b>" }] }), "VALIDATION");
    expectDomain(() => parseLessonContent({ blocks: [{ type: "paragraph", text: "x", onclick: "alert(1)" }] }), "VALIDATION");
    expectDomain(() => parseLessonContent({ blocks: [{ id: B.heading, type: "divider" }, { id: B.heading, type: "divider" }] }), "VALIDATION");
    expectDomain(
      () => parseLessonContent({ blocks: [{ type: "exercise", prompt: "p", questions: [{ question: "q", options: [{ text: "a" }, { text: "b" }], correctOptionId: "zzz" }] }] }),
      "VALIDATION",
    );
    expectDomain(() => parseLessonContent({ blocks: [{ type: "audio", title: "t", url: "http://insecure.example.test/a.mp3" }] }), "VALIDATION");
    expectDomain(() => parseLessonContent({ blocks: new Array(501).fill({ type: "divider" }) }), "VALIDATION");
    expectDomain(() => parseLessonContent(null), "VALIDATION");
  });

  test("markup is stored as inert text, never interpreted", () => {
    const parsed = parseLessonContent({ blocks: [{ type: "paragraph", text: "<script>alert(1)</script>" }] });
    assert.equal((parsed.blocks[0] as { text: string }).text, "<script>alert(1)</script>");
  });

  test("learners never receive teacher notes, answer keys or explanations", () => {
    const learner = projectContent(content, "learner");
    assert.equal(learner.blocks.some((b) => b.type === "teacher_note"), false);
    const json = JSON.stringify(learner);
    assert.equal(json.includes("Ask learners for their own examples"), false);
    assert.equal(json.includes("The mubtada is first"), false);
    const exercise = learner.blocks.find((b) => b.type === "exercise");
    assert.ok(exercise && exercise.type === "exercise");
    assert.equal(exercise.questions[0].correctOptionId, null);
    assert.equal(exercise.questions[0].explanation, null);
    // Canonical content is not mutated by projection.
    const original = content.blocks.find((b) => b.type === "exercise");
    assert.ok(original && original.type === "exercise" && original.questions[0].correctOptionId === "a");
  });

  test("teachers and administrators receive the full script", () => {
    assert.deepEqual(projectContent(content, "teacher"), content);
    assert.deepEqual(projectContent(content, "admin"), content);
  });

  test("stored content is re-validated and must already carry ids", () => {
    assert.deepEqual(readStoredContent(JSON.stringify(content)), content);
    assert.throws(() => readStoredContent({ blocks: [{ type: "divider" }] }));
  });

  test("a version needs teaching content before review", () => {
    assert.equal(hasTeachingContent({ blocks: [] }), false);
    assert.equal(hasTeachingContent(parseLessonContent({ blocks: [{ type: "teacher_note", text: "x" }, { type: "divider" }] })), false);
    assert.equal(hasTeachingContent(content), true);
  });
});

describe("private annotations", () => {
  const learnerView = projectContent(content, "learner");
  const base = { lessonScriptId: SCRIPT, scriptVersionId: VERSION, classGroupId: GROUP, visibleContent: learnerView, existingCount: 0 };
  const ctx = { ownerUid: "student-1", clock: fixedClock, newId: sequentialIds("a0a0a0a0") };

  test("a highlight anchors to a visible block and captures the quoted range", () => {
    const text = anchorTextOf(content.blocks[1]) as string;
    const record = planCreateAnnotation({ ...base, blockId: B.paragraph, range: { start: 2, end: 9 }, kind: "highlight" }, ctx);
    assert.equal(record.ownerUid, "student-1");
    assert.equal(record.quote, text.slice(2, 9));
    assert.equal(record.color, "yellow");
    assert.equal(record.body, null);
  });

  test("learners cannot annotate blocks hidden from them; ranges must fit the text", () => {
    expectDomain(() => planCreateAnnotation({ ...base, blockId: B.note, kind: "highlight" }, ctx), "VALIDATION");
    expectDomain(() => planCreateAnnotation({ ...base, blockId: B.paragraph, range: { start: 5, end: 5 }, kind: "highlight" }, ctx), "VALIDATION");
    expectDomain(() => planCreateAnnotation({ ...base, blockId: B.paragraph, range: { start: 0, end: 10_000 }, kind: "highlight" }, ctx), "VALIDATION");
    expectDomain(() => planCreateAnnotation({ ...base, blockId: B.exercise, range: { start: 0, end: 1 }, kind: "highlight" }, ctx), "VALIDATION");
    expectDomain(() => planCreateAnnotation({ ...base, blockId: B.paragraph, kind: "note" }, ctx), "VALIDATION");
    expectDomain(() => planCreateAnnotation({ ...base, blockId: B.paragraph, kind: "note", body: "x".repeat(5001) }, ctx), "VALIDATION");
    expectDomain(() => planCreateAnnotation({ ...base, existingCount: 1000, blockId: B.paragraph, kind: "highlight" }, ctx), "CONFLICT");
  });

  test("only the owner may change or delete an annotation; others see not found", () => {
    const record = planCreateAnnotation({ ...base, blockId: B.paragraph, kind: "note", body: "Remember this" }, ctx);
    expectDomain(() => planUpdateAnnotation(record, { body: "hijack", expectedRevision: 1 }, { ownerUid: "teacher-1" }), "NOT_FOUND");
    expectDomain(() => planDeleteAnnotation(record, { expectedRevision: 1 }, { ownerUid: "admin-1" }), "NOT_FOUND");
    const updated = planUpdateAnnotation(record, { body: "Remember this well", color: "green", expectedRevision: 1 }, ctx);
    assert.equal(updated.revision, 2);
    assert.equal(updated.color, "green");
    expectDomain(() => planUpdateAnnotation(updated, { body: "stale", expectedRevision: 1 }, ctx), "CONFLICT");
    expectDomain(() => planUpdateAnnotation(updated, { kind: "note", body: " ", expectedRevision: 2 }, ctx), "VALIDATION");
    const deleted = planDeleteAnnotation(updated, { expectedRevision: 2 }, ctx);
    assert.notEqual(deleted.deletedAt, null);
    expectDomain(() => planUpdateAnnotation(deleted, { body: "again", expectedRevision: 3 }, ctx), "NOT_FOUND");
  });

  test("annotations follow their block into new versions and are flagged when the block is removed", () => {
    const kept = planCreateAnnotation({ ...base, blockId: B.paragraph, kind: "highlight" }, ctx);
    const removed = planCreateAnnotation({ ...base, blockId: B.heading, kind: "highlight" }, ctx);
    const nextVersion = parseLessonContent({ blocks: [{ id: B.paragraph, type: "paragraph", text: "Revised wording." }] });
    const views = withAnchorStatus([kept, removed, planDeleteAnnotation(kept, { expectedRevision: 1 }, ctx)], nextVersion);
    assert.deepEqual(views.map((v) => [v.blockId, v.orphaned]), [[B.paragraph, false], [B.heading, true]]);
  });
});

describe("teacher preparation", () => {
  const SESSION = "f1000000-0000-4000-8000-000000000001";
  const start = emptyPreparation(SESSION, "teacher-1", "2026-09-17T12:00:00.000Z");

  test("teachers move their own preparation forward and back; notes stay private", () => {
    const inProgress = planUpdatePreparation(start, { status: "in_progress", privateNotes: "Bring flashcards", expectedRevision: 0 }, { teacherUid: "teacher-1", clock: fixedClock });
    assert.equal(inProgress.revision, 1);
    const ready = planUpdatePreparation(inProgress, { status: "ready", expectedRevision: 1 }, { teacherUid: "teacher-1", clock: fixedClock });
    assert.notEqual(ready.readyAt, null);
    const back = planUpdatePreparation(ready, { status: "in_progress", expectedRevision: 2 }, { teacherUid: "teacher-1", clock: fixedClock });
    assert.equal(back.readyAt, null);
    assert.equal(JSON.stringify(toStatusView(ready)).includes("flashcards"), false);
    assert.deepEqual(Object.keys(toStatusView(ready)).sort(), ["readyAt", "sessionId", "status", "teacherUid", "updatedAt"]);
  });

  test("another teacher's preparation, stale revisions, bad states and no-op changes are refused", () => {
    expectDomain(() => planUpdatePreparation(start, { status: "ready", expectedRevision: 0 }, { teacherUid: "teacher-2" }), "NOT_FOUND");
    expectDomain(() => planUpdatePreparation(start, { status: "ready", expectedRevision: 1 }, { teacherUid: "teacher-1" }), "CONFLICT");
    expectDomain(() => planUpdatePreparation(start, { status: "done", expectedRevision: 0 }, { teacherUid: "teacher-1" }), "VALIDATION");
    expectDomain(() => planUpdatePreparation(start, { status: "not_started", expectedRevision: 0 }, { teacherUid: "teacher-1" }), "VALIDATION");
    const ready = planUpdatePreparation(start, { status: "ready", expectedRevision: 0 }, { teacherUid: "teacher-1" });
    expectDomain(() => planUpdatePreparation(ready, { status: "not_started", expectedRevision: 1 }, { teacherUid: "teacher-1" }), "INVALID_TRANSITION");
  });
});
