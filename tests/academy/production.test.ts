/**
 * 2C production infrastructure.
 *
 * Required invariants covered here: strict content per kind (adventure graphs
 * reachable, games with compatible objective items, image alt text),
 * provenance with rights and human review for assisted content, human-gated
 * publication (rights cleared + approved publication gate for the exact
 * version), guarded production runs, library scope for links, explicit
 * remediation rules, answer-free learner projections, server-graded practice,
 * and administrator-only production management.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import type { AttemptRecord } from "../../src/lib/academy/assessment/delivery.ts";
import type { ApprovalGate } from "../../src/lib/academy/governance/approval-gates.ts";
import type { RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";
import {
  parseProductionContent,
  parseProvenance,
  projectProductionContent,
  type ActivityContent,
  type ContentKind,
} from "../../src/lib/academy/production/content.ts";
import {
  matchingRules,
  planAssignRemediation,
  planCreateRemediationRule,
  planPracticeResult,
  planResolveRemediation,
  type RemediationRuleRecord,
} from "../../src/lib/academy/production/practice.ts";
import {
  assertPublishable,
  libraryServesCourse,
  planAddLink,
  planCreateItem,
  planCreateLibrary,
  planCreateRun,
  planRegisterFactory,
  planRunStatus,
  type ContentItemVersionRecord,
} from "../../src/lib/academy/production/production.ts";
import * as repo from "../../src/lib/academy/repo/production-repo.ts";
import { createPracticeService } from "../../src/lib/academy/services/practice-service.ts";
import { createProductionService } from "../../src/lib/academy/services/production-service.ts";
import {
  IDS,
  admin,
  assertWellFormed,
  classGroupRow,
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

const outsider: AuthUser = { uid: "student-2", profileId: "p-s2", role: "student", email: "s2@example.test" };
const ctx = () => ({ actor: { uid: "admin-1", role: "admin" as const }, clock: fixedClock, newId: sequentialIds("abababab") });

const ITEM = "ac000000-0000-4000-8000-000000000001";
const VERSION = "ad000000-0000-4000-8000-000000000001";
const LIBRARY = "ae000000-0000-4000-8000-000000000001";

const ACTIVITY = {
  instructions: "Choose the right word.",
  items: [
    { id: "q1", type: "choice", prompt: "Book?", options: ["قلم", "كتاب"], correctIndex: 1 },
    { id: "q2", type: "true_false", prompt: "كتاب is a noun.", correct: true },
  ],
};

const PROVENANCE = { origin: "original", contributors: [{ name: "Ustadha Maryam", role: "author" }], rightsStatus: "cleared" };

describe("production content", () => {
  test("activities only allow automatically graded items", () => {
    assert.equal((parseProductionContent("activity", ACTIVITY) as ActivityContent).items.length, 2);
    expectDomain(() => parseProductionContent("activity", { items: [] }), "VALIDATION");
    expectDomain(() => parseProductionContent("activity", { items: [{ id: "e", type: "essay", prompt: "Write", maxWords: 10 }] }), "VALIDATION");
    expectDomain(() => parseProductionContent("activity", { ...ACTIVITY, answers: [1] }), "VALIDATION");
  });

  test("adventures must be navigable graphs with an ending", () => {
    const good = {
      startSceneId: "start",
      scenes: [
        { id: "start", text: "You enter the souq.", ending: false, choices: [{ id: "a", label: "Buy bread", targetSceneId: "end" }] },
        { id: "end", text: "You bought خبز.", ending: true },
      ],
    };
    assert.doesNotThrow(() => parseProductionContent("adventure", good));
    expectDomain(() => parseProductionContent("adventure", { ...good, startSceneId: "nowhere" }), "VALIDATION");
    expectDomain(() => parseProductionContent("adventure", { ...good, scenes: [good.scenes[0], { id: "end", text: "x", ending: false }] }), "VALIDATION");
    expectDomain(
      () => parseProductionContent("adventure", { ...good, scenes: [...good.scenes, { id: "island", text: "Unreachable", ending: true }] }),
      "VALIDATION",
    );
    expectDomain(
      () => parseProductionContent("adventure", { startSceneId: "start", scenes: [{ id: "start", text: "a", ending: false, choices: [{ id: "c", label: "go", targetSceneId: "ghost" }] }, { id: "end", text: "b", ending: true }] }),
      "VALIDATION",
    );
  });

  test("games accept only item types that suit the game", () => {
    const pairs = { id: "m1", type: "matching", prompt: "Match", pairs: [{ left: "كتاب", right: "book" }, { left: "قلم", right: "pen" }] };
    assert.doesNotThrow(() => parseProductionContent("game", { gameType: "memory", timeLimitSeconds: 60, items: [pairs] }));
    expectDomain(() => parseProductionContent("game", { gameType: "memory", items: ACTIVITY.items }), "VALIDATION");
    expectDomain(() => parseProductionContent("game", { gameType: "chess", items: [pairs] }), "VALIDATION");
    expectDomain(() => parseProductionContent("game", { gameType: "memory", timeLimitSeconds: 5, items: [pairs] }), "VALIDATION");
  });

  test("media needs https, alt text for images, and duration only for audio or video", () => {
    assert.doesNotThrow(() => parseProductionContent("media", { mediaType: "audio", url: "https://cdn.example.test/a.mp3", transcript: "مرحبا", durationSeconds: 30 }));
    expectDomain(() => parseProductionContent("media", { mediaType: "image", url: "https://cdn.example.test/i.png" }), "VALIDATION");
    expectDomain(() => parseProductionContent("media", { mediaType: "image", url: "http://cdn.example.test/i.png", altText: "x" }), "VALIDATION");
    expectDomain(() => parseProductionContent("media", { mediaType: "image", url: "https://cdn.example.test/i.png", altText: "x", durationSeconds: 3 }), "VALIDATION");
  });

  test("stories validate pages", () => {
    assert.doesNotThrow(() => parseProductionContent("story", { pages: [{ id: "p1", text: "كان يا ما كان", translation: "Once upon a time" }] }));
    expectDomain(() => parseProductionContent("story", { pages: [{ id: "p1", text: "a" }, { id: "p1", text: "b" }] }), "VALIDATION");
  });

  test("learners never receive answer keys", () => {
    const activity = parseProductionContent("activity", ACTIVITY);
    const json = JSON.stringify(projectProductionContent("activity", activity));
    assert.equal(json.includes("correctIndex"), false);
    assert.equal(json.includes('"correct"'), false);
    const story = parseProductionContent("story", { pages: [{ id: "p1", text: "text" }] });
    assert.deepEqual(projectProductionContent("story", story), story);
  });
});

describe("provenance", () => {
  test("records origin, contributors and rights", () => {
    assert.equal(parseProvenance(PROVENANCE).rightsStatus, "cleared");
    expectDomain(() => parseProvenance({ ...PROVENANCE, contributors: [] }), "VALIDATION");
    expectDomain(() => parseProvenance({ ...PROVENANCE, origin: "adapted" }), "VALIDATION");
    assert.doesNotThrow(() => parseProvenance({ ...PROVENANCE, origin: "adapted", sources: [{ title: "Al-Kitab al-Asasi", license: "Permission on file" }] }));
    expectDomain(() => parseProvenance({ ...PROVENANCE, rightsStatus: "probably_fine" }), "VALIDATION");
  });

  test("assisted content names its tool and has a human editor or reviewer", () => {
    expectDomain(() => parseProvenance({ ...PROVENANCE, origin: "assisted_generation" }), "VALIDATION");
    expectDomain(() => parseProvenance({ ...PROVENANCE, origin: "assisted_generation", assistedToolLabel: "Drafting assistant" }), "VALIDATION");
    assert.doesNotThrow(() =>
      parseProvenance({ ...PROVENANCE, origin: "assisted_generation", assistedToolLabel: "Drafting assistant", contributors: [{ name: "Editor", role: "editor" }] }),
    );
    expectDomain(() => parseProvenance({ ...PROVENANCE, assistedToolLabel: "Tool" }), "VALIDATION");
  });
});

describe("libraries, factories, runs and items", () => {
  const library = planCreateLibrary({ slug: "arabic-practice", title: "Arabic practice", scope: "program", programId: IDS.program }, ctx()).record;

  test("library scope shapes and which courses a library serves", () => {
    expectDomain(() => planCreateLibrary({ slug: "x-lib", title: "X", scope: "program" }, ctx()), "VALIDATION");
    expectDomain(() => planCreateLibrary({ slug: "x-lib", title: "X", scope: "academy", courseId: IDS.course }, ctx()), "VALIDATION");
    assert.equal(libraryServesCourse(library, { id: IDS.course, programId: IDS.program }), true);
    assert.equal(libraryServesCourse(library, { id: IDS.course, programId: null }), false);
  });

  test("runs move through a guarded lifecycle and only complete when every item is resolved", () => {
    const factory = planRegisterFactory({ key: "vocab-games", title: "Vocabulary games", outputKind: "game" }, ctx()).record;
    const run = planCreateRun({ factory, library, title: "Unit 1 games" }, ctx()).record;
    const producing = planRunStatus(run, { to: "in_production", expectedRevision: 1 }, { items: 0, unresolvedItems: 0 }, ctx()).record;
    expectDomain(() => planRunStatus(producing, { to: "awaiting_review", expectedRevision: 2 }, { items: 0, unresolvedItems: 0 }, ctx()), "CONFLICT");
    const review = planRunStatus(producing, { to: "awaiting_review", expectedRevision: 2 }, { items: 3, unresolvedItems: 3 }, ctx()).record;
    expectDomain(() => planRunStatus(review, { to: "completed", expectedRevision: 3 }, { items: 3, unresolvedItems: 1 }, ctx()), "CONFLICT");
    expectDomain(() => planRunStatus(run, { to: "completed", expectedRevision: 1 }, { items: 0, unresolvedItems: 0 }, ctx()), "INVALID_TRANSITION");
    expectDomain(() => planRunStatus(review, { to: "cancelled", expectedRevision: 3 }, { items: 3, unresolvedItems: 0 }, ctx()), "VALIDATION");
    assert.equal(planRunStatus(review, { to: "completed", expectedRevision: 3 }, { items: 3, unresolvedItems: 0 }, ctx()).record.state, "completed");

    expectDomain(() => planCreateItem({ library, run: producing, runFactory: factory, kind: "story", title: "Wrong kind" }, ctx()), "VALIDATION");
    const item = planCreateItem({ library, run: producing, runFactory: factory, kind: "game", title: "Memory pairs" }, ctx());
    assert.equal(item.record.productionRunId, run.id);
    assert.doesNotThrow(() => buildAuditEvent(item.audit));
    expectDomain(() => planCreateItem({ library: { ...library, state: "archived" }, run: null, runFactory: null, kind: "game", title: "x" }, ctx()), "CONFLICT");
  });
});

describe("human publication gate", () => {
  const item = { id: ITEM, libraryId: LIBRARY, kind: "activity" as ContentKind, title: "Nouns", productionRunId: null, createdBy: "admin-1", createdAt: "2026-09-01T00:00:00Z" };
  const version = { id: VERSION, parentId: ITEM, state: "approved" } as ContentItemVersionRecord;
  const approvedGate: ApprovalGate = {
    id: "af000000-0000-4000-8000-000000000001", type: "publication", subject: { kind: "content_item", id: ITEM }, subjectVersionId: VERSION, state: "approved",
    requestedBy: "admin-1", requestedAt: "2026-09-01T00:00:00Z", resolvedAt: "2026-09-02T00:00:00Z", requiredApprovals: 1, eligibleRoles: ["admin"], allowSelfApproval: false,
  };
  const provenance = parseProvenance(PROVENANCE);

  test("needs content, cleared rights and an approved gate for this exact version", () => {
    assert.doesNotThrow(() => assertPublishable(item, version, { content: ACTIVITY, provenance }, [approvedGate]));
    expectDomain(() => assertPublishable(item, version, { content: null, provenance }, [approvedGate]), "CONFLICT");
    expectDomain(() => assertPublishable(item, version, { content: ACTIVITY, provenance: null }, [approvedGate]), "CONFLICT");
    expectDomain(() => assertPublishable(item, version, { content: ACTIVITY, provenance: { ...provenance, rightsStatus: "pending" } }, [approvedGate]), "CONFLICT");
    expectDomain(() => assertPublishable(item, version, { content: ACTIVITY, provenance }, []), "APPROVAL_REQUIRED");
    expectDomain(() => assertPublishable(item, version, { content: ACTIVITY, provenance }, [{ ...approvedGate, state: "open" }]), "APPROVAL_REQUIRED");
    expectDomain(() => assertPublishable(item, version, { content: ACTIVITY, provenance }, [{ ...approvedGate, subjectVersionId: "af000000-0000-4000-8000-000000000009" }]), "APPROVAL_REQUIRED");
    expectDomain(() => assertPublishable(item, version, { content: ACTIVITY, provenance }, [{ ...approvedGate, type: "rights_clearance" }]), "APPROVAL_REQUIRED");
  });
});

describe("links", () => {
  const library = planCreateLibrary({ slug: "course-lib", title: "Course library", scope: "course", courseId: IDS.course }, ctx()).record;
  const item = planCreateItem({ library, run: null, runFactory: null, kind: "activity", title: "Nouns" }, ctx()).record;
  const course = { id: IDS.course, programId: IDS.program, deletedAt: null };
  const base = { item, library, hasPublishedVersion: true, course, targetCourseId: IDS.course, existing: [], targetKind: "assessment", targetId: IDS.lesson1, purpose: "remediation" };

  test("only published content, into courses the library serves, once per target and purpose", () => {
    const plan = planAddLink(base, ctx());
    assert.equal(plan.record.courseId, IDS.course);
    expectDomain(() => planAddLink({ ...base, hasPublishedVersion: false }, ctx()), "CONFLICT");
    expectDomain(() => planAddLink({ ...base, targetCourseId: null }, ctx()), "NOT_FOUND");
    expectDomain(() => planAddLink({ ...base, course: { ...course, id: "c0000000-0000-4000-8000-000000000099" }, targetCourseId: "c0000000-0000-4000-8000-000000000099" }, ctx()), "VALIDATION");
    expectDomain(() => planAddLink({ ...base, existing: [plan.record] }, ctx()), "CONFLICT");
    expectDomain(() => planAddLink({ ...base, purpose: "decoration" }, ctx()), "VALIDATION");
  });
});

describe("remediation and practice", () => {
  const rule = (overrides: Partial<RemediationRuleRecord> = {}): RemediationRuleRecord => ({
    id: "b0b00000-0000-4000-8000-000000000001", courseId: IDS.course, assessmentId: "a5000000-0000-4000-8000-000000000001", belowScorePercent: 60, itemId: ITEM,
    state: "active", reason: "Board decision", retireReason: null, revision: 1, createdBy: "admin-1", createdAt: "2026-09-01T00:00:00Z", updatedBy: "admin-1", updatedAt: "2026-09-01T00:00:00Z", ...overrides,
  });

  test("rules are explicit: assessment of the course, item linked for remediation, threshold and reason required", () => {
    const assessment = { id: "a5000000-0000-4000-8000-000000000001", courseId: IDS.course };
    const base = { courseId: IDS.course, assessment, itemLinkedForRemediation: true, itemId: ITEM, belowScorePercent: 60, reason: "Board decision" };
    assert.doesNotThrow(() => buildAuditEvent(planCreateRemediationRule(base, ctx()).audit));
    expectDomain(() => planCreateRemediationRule({ ...base, belowScorePercent: undefined }, ctx()), "VALIDATION");
    expectDomain(() => planCreateRemediationRule({ ...base, reason: "" }, ctx()), "VALIDATION");
    expectDomain(() => planCreateRemediationRule({ ...base, itemLinkedForRemediation: false }, ctx()), "CONFLICT");
    expectDomain(() => planCreateRemediationRule({ ...base, assessment: { ...assessment, courseId: "c0000000-0000-4000-8000-000000000099" } }, ctx()), "NOT_FOUND");
  });

  test("rules match only released scores strictly below the threshold", () => {
    const released = { scorePercent: 59, releasedAt: "2026-10-01T00:00:00Z" } as AttemptRecord;
    assert.equal(matchingRules([rule()], rule().assessmentId, released).length, 1);
    assert.equal(matchingRules([rule()], rule().assessmentId, { ...released, scorePercent: 60 }).length, 0);
    assert.equal(matchingRules([rule()], rule().assessmentId, { ...released, releasedAt: null }).length, 0);
    assert.equal(matchingRules([rule({ state: "retired", retireReason: "x" })], rule().assessmentId, released).length, 0);
  });

  test("assignments are unique while open; learners only complete, teachers dismiss with a reason", () => {
    const plan = planAssignRemediation({ classGroupId: IDS.classGroup, learnerUid: "student-1", itemId: ITEM, ruleId: null, sourceAttemptId: null, openForLearner: [] }, ctx());
    expectDomain(() => planAssignRemediation({ classGroupId: IDS.classGroup, learnerUid: "student-1", itemId: ITEM, ruleId: null, sourceAttemptId: null, openForLearner: [plan.record] }, ctx()), "CONFLICT");
    expectDomain(() => planResolveRemediation(plan.record, { to: "dismissed", reason: "x", expectedRevision: 1 }, { actingAsLearner: true }, ctx()), "VALIDATION");
    expectDomain(() => planResolveRemediation(plan.record, { to: "dismissed", expectedRevision: 1 }, { actingAsLearner: false }, ctx()), "VALIDATION");
    const done = planResolveRemediation(plan.record, { to: "completed", expectedRevision: 1 }, { actingAsLearner: true }, ctx()).record;
    expectDomain(() => planResolveRemediation(done, { to: "completed", expectedRevision: 2 }, { actingAsLearner: true }, ctx()), "CONFLICT");
  });

  test("practice is graded on the server", () => {
    const activity = parseProductionContent("activity", ACTIVITY) as { instructions: string | null; items: never[] };
    const result = planPracticeResult(
      { itemId: ITEM, itemVersionId: VERSION, classGroupId: IDS.classGroup, learnerUid: "student-1", scored: activity, responses: [{ itemId: "q1", optionIndex: 1 }, { itemId: "q2", value: false }] },
      ctx(),
    );
    assert.equal(result.scorePercent, 50);
    expectDomain(() => planPracticeResult({ itemId: ITEM, itemVersionId: VERSION, classGroupId: IDS.classGroup, learnerUid: "student-1", scored: activity, responses: [{ itemId: "zz", value: true }] }, ctx()), "VALIDATION");
  });

  test("queries are well formed", () => {
    for (const query of [
      repo.listItemsQuery({ libraryId: null, runId: null }),
      repo.selectRunItemCountsQuery(ITEM),
      repo.listCourseContentQuery(IDS.course),
      repo.countActiveCourseLinksQuery(ITEM, IDS.course, "remediation"),
      repo.selectClassGroupReportQuery(IDS.classGroup),
      repo.listLearnerPracticeResultsQuery(IDS.classGroup, "student-1"),
      repo.selectProductionReportQuery(),
    ]) {
      assertWellFormed(query);
    }
    assert.match(repo.listCourseContentQuery(IDS.course).text, /v\.state = 'published'[\s\S]*l\.removed_at IS NULL/);
  });
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

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

function versionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION, item_id: ITEM, version_number: 1, based_on_version_id: null, state: "published", revision: 4, created_by: "admin-1",
    created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z", submitted_at: null, reviewed_by: "admin-2", reviewed_at: null,
    published_by: "admin-2", published_at: "2026-09-02T00:00:00Z", superseded_at: null, archived_at: null,
    content: JSON.stringify(ACTIVITY), provenance: JSON.stringify(PROVENANCE), ...overrides,
  };
}

const R = {
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  linkCount: /count\(\*\) AS n FROM academy_content_links/,
  item: /FROM academy_content_items WHERE id = \$1::uuid$/,
  published: /FROM academy_content_item_versions\s+WHERE item_id = \$1::uuid AND state = 'published'/,
  version: /FROM academy_content_item_versions WHERE id = \$1::uuid$/,
  versions: /FROM academy_content_item_versions WHERE item_id = \$1::uuid ORDER BY/,
  gates: /FROM academy_approval_gates WHERE subject_kind/,
  courseContent: /FROM academy_content_links l/,
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    classGroup: [classGroupRow()],
    linkCount: [{ n: "1" }],
    item: [{ id: ITEM, library_id: LIBRARY, kind: "activity", title: "Nouns", production_run_id: null, created_by: "admin-1", created_at: "2026-09-01T00:00:00Z" }],
    published: [versionRow()],
    version: [versionRow()],
    versions: [versionRow()],
    gates: [],
    courseContent: [],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

const practice = (executor: FakeExecutor) => createPracticeService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("b1b1b1b1"), facts });
const production = (executor: FakeExecutor) => createProductionService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("b2b2b2b2") });

describe("production services", () => {
  test("teachers and learners cannot manage production", async () => {
    for (const user of [teacher, student]) {
      const executor = fakeExecutor(world());
      await rejectsForbidden(production(executor).listLibraries(user));
      await rejectsForbidden(production(executor).createItem(user, { libraryId: LIBRARY, kind: "activity", title: "x" }));
      await rejectsForbidden(production(executor).publish(user, VERSION, { expectedRevision: 1 }));
      await rejectsForbidden(production(executor).createRemediationRule(user, IDS.course, { assessmentId: ITEM, itemId: ITEM, belowScorePercent: 50, reason: "x" }));
      assert.equal(executor.queries.length + executor.transactions.length, 0);
    }
  });

  test("publication without an approved gate is refused before writing", async () => {
    const approved = versionRow({ state: "approved", revision: 3, published_at: null, published_by: null });
    const executor = fakeExecutor(world({ version: [approved], versions: [approved] }));
    await rejectsDomain(production(executor).publish(admin, VERSION, { expectedRevision: 3 }), "APPROVAL_REQUIRED");
    assert.equal(executor.transactions.length, 0);
    const gate = { id: "af000000-0000-4000-8000-000000000001", gate_type: "publication", subject_kind: "content_item", subject_id: ITEM, subject_version_id: VERSION, state: "approved", requested_by: "admin-1", requested_at: "2026-09-01T00:00:00Z", resolved_at: "2026-09-02T00:00:00Z", required_approvals: 1, eligible_roles: ["admin"], allow_self_approval: false };
    const ok = fakeExecutor(world({ version: [approved], versions: [approved], gates: [gate] }));
    const result = await production(ok).publish(admin, VERSION, { expectedRevision: 3 });
    assert.equal(result.published.state, "published");
  });

  test("published content cannot be edited", async () => {
    await rejectsDomain(production(fakeExecutor(world())).saveVersion(admin, VERSION, { content: ACTIVITY, expectedRevision: 4 }), "IMMUTABLE");
  });

  test("learners open linked content without answers; outsiders and unlinked content get nothing", async () => {
    const learner = await practice(fakeExecutor(world())).openContent(student, IDS.classGroup, ITEM);
    assert.equal(JSON.stringify(learner).includes("correctIndex"), false);
    const staff = await practice(fakeExecutor(world())).openContent(teacher, IDS.classGroup, ITEM);
    assert.equal(JSON.stringify(staff).includes("correctIndex"), true);
    await rejectsForbidden(practice(fakeExecutor(world())).openContent(outsider, IDS.classGroup, ITEM));
    await rejectsDomain(practice(fakeExecutor(world({ linkCount: [{ n: "0" }] }))).openContent(student, IDS.classGroup, ITEM), "NOT_FOUND");
  });

  test("only learners submit practice, graded on the server and stored for the caller", async () => {
    await rejectsForbidden(practice(fakeExecutor(world())).submitPractice(teacher, IDS.classGroup, ITEM, { responses: [] }));
    const executor = fakeExecutor(world());
    const result = await practice(executor).submitPractice(student, IDS.classGroup, ITEM, { responses: [{ itemId: "q1", optionIndex: 1 }, { itemId: "q2", value: true }] });
    assert.equal(result.scorePercent, 100);
    const [insert] = executor.transactions[0];
    assert.match(insert.text, /INSERT INTO academy_practice_results/);
    assert.ok(insert.values.includes("student-1"));
  });

  test("results, remediation and reports are the learner's own or staff-only", async () => {
    const own = fakeExecutor(world());
    await practice(own).practiceResults(student, IDS.classGroup, { learnerUid: "student-9" });
    assert.equal(own.queries.find((q) => /academy_practice_results/.test(q.text))?.values[1], "student-1");
    await rejectsForbidden(practice(fakeExecutor(world())).classGroupReport(student, IDS.classGroup));
    await rejectsForbidden(practice(fakeExecutor(world())).assignRemediation(student, IDS.classGroup, { learnerUid: "student-1", itemId: ITEM }));
    await rejectsDomain(practice(fakeExecutor(world())).assignRemediation(teacher, IDS.classGroup, { learnerUid: "student-2", itemId: ITEM }), "VALIDATION");
    const assign = fakeExecutor(world());
    const assignment = await practice(assign).assignRemediation(teacher, IDS.classGroup, { learnerUid: "student-1", itemId: ITEM, note: "Review nouns" });
    assert.equal(assignment.state, "assigned");
    assert.match(assign.transactions[0][0].text, /INSERT INTO academy_remediation_assignments[\s\S]*academy_audit_events/);
  });
});
