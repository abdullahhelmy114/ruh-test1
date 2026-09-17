/**
 * Assessment engine, attempts, progress and completion.
 *
 * Required invariants covered here: learners never receive answer keys or
 * rubrics, results stay hidden until released, grading reuses the platform's
 * answer comparison, no pass mark is hard-coded, attempt limits / late work /
 * result release / revision follow resolved policies and fail closed, only
 * graders grade, only administrators author, assign and record completion,
 * and completion without meeting criteria needs an audited override.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import { maxPoints, parseAssessmentContent, projectForLearner } from "../../src/lib/academy/assessment/content.ts";
import {
  lateness,
  learnerAttemptView,
  planCreateAssignment,
  planGradeAttempt,
  planReleaseAttempt,
  planReturnAttempt,
  planStartAttempt,
  planSubmitAttempt,
  type AssessmentVersionRecord,
  type AssignmentRecord,
  type AttemptRecord,
} from "../../src/lib/academy/assessment/delivery.ts";
import { applyReview, autoGrade, parseResponses, scoreOf } from "../../src/lib/academy/assessment/grading.ts";
import { evaluateCompletion, planRecordCompletion, planRevokeCompletion, type ProgressSnapshot } from "../../src/lib/academy/learning/progress.ts";
import type { RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";
import * as assessmentRepo from "../../src/lib/academy/repo/assessment-repo.ts";
import { mapClassGroupRow, mapEnrollmentRow } from "../../src/lib/academy/repo/delivery-repo.ts";
import { createAssessmentAuthoringService } from "../../src/lib/academy/services/assessment-authoring-service.ts";
import { createAssessmentService } from "../../src/lib/academy/services/assessment-service.ts";
import { createProgressService } from "../../src/lib/academy/services/progress-service.ts";
import {
  IDS,
  admin,
  assertWellFormed,
  classGroupRow,
  courseRow,
  enrollmentRow,
  expectDomain,
  fakeExecutor,
  rejectsDomain,
  rejectsForbidden,
  sequentialIds,
  student,
  teacher,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const outsider: AuthUser = { uid: "student-2", profileId: "p-s2", role: "student", email: "s2@example.test" };
const otherTeacher: AuthUser = { uid: "teacher-2", profileId: "p-t2", role: "teacher", email: "t2@example.test" };

const ASSESSMENT = "a5000000-0000-4000-8000-000000000001";
const A_VERSION = "a5100000-0000-4000-8000-000000000001";
const ASSIGNMENT = "a5200000-0000-4000-8000-000000000001";
const ATTEMPT = "a5300000-0000-4000-8000-000000000001";

const CONTENT_INPUT = {
  instructions: "Answer every question.",
  items: [
    { id: "q1", type: "choice", prompt: "Which word means book?", options: ["قلم", "كتاب", "باب"], correctIndex: 1 },
    { id: "q2", type: "true_false", prompt: "الكتاب is masculine.", correct: true },
    { id: "q3", type: "fill_blank", prompt: "Transliterate كتاب", acceptedAnswers: ["kitaab", "kitab"] },
    { id: "q4", type: "word_order", prompt: "Order the sentence", correctOrder: ["ذهب", "الولد", "إلى", "المدرسة"] },
    { id: "q5", type: "matching", prompt: "Match", pairs: [{ left: "كتاب", right: "book" }, { left: "قلم", right: "pen" }] },
    { id: "q6", type: "essay", prompt: "Describe your school.", maxWords: 200, rubric: "SECRET RUBRIC: grammar and vocabulary", points: 10 },
  ],
};
const content = parseAssessmentContent(CONTENT_INPUT);

const ALL_CORRECT = [
  { itemId: "q1", optionIndex: 1 },
  { itemId: "q2", value: true },
  { itemId: "q3", text: "  KITAAB " },
  { itemId: "q4", tokens: ["ذهب", "الولد", "إلى", "المدرسة"] },
  { itemId: "q5", pairs: [{ left: "قلم", right: "pen" }, { left: "كتاب", right: "book" }] },
];

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

const T0 = "2026-10-01T08:00:00.000Z";
const DUE = "2026-10-08T20:00:00.000Z";
const at = (iso: string) => () => new Date(iso);
const ctxAt = (iso: string, uid = "student-1", role: AuthUser["role"] = "student") => ({ actor: { uid, role }, clock: at(iso), newId: sequentialIds("a9a9a9a9") });

const group = mapClassGroupRow(classGroupRow());
const assignment: AssignmentRecord = {
  id: ASSIGNMENT, classGroupId: IDS.classGroup, courseId: IDS.course, assessmentId: ASSESSMENT, assessmentVersionId: A_VERSION,
  mode: "quiz", title: "Nouns quiz", opensAt: T0, dueAt: DUE, state: "active", cancelReason: null, revision: 1,
  createdBy: "admin-1", createdAt: T0, updatedBy: "admin-1", updatedAt: T0,
};
const NO_LATE = { acceptLateSubmissions: false, latestHoursAfterDue: null, markAsLate: false };
const LATE_24H = { acceptLateSubmissions: true, latestHoursAfterDue: 24, markAsLate: true };
const TWO_ATTEMPTS = { maxAttempts: 2 };
const ONE_REVISION = { revisionAllowed: true, maxRevisions: 1 };
const NO_REVISION = { revisionAllowed: false, maxRevisions: null };

function started(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    ...planStartAttempt(
      { assignment, content, learnerUid: "student-1", existing: [], attemptLimit: TWO_ATTEMPTS, revisionPolicy: ONE_REVISION, lateWork: NO_LATE },
      ctxAt("2026-10-02T10:00:00.000Z"),
    ),
    id: ATTEMPT,
    ...overrides,
  };
}

describe("assessment content", () => {
  test("every item type parses; points default to one", () => {
    assert.equal(content.items.length, 6);
    assert.equal(maxPoints(content), 15);
  });

  test("content is validated strictly", () => {
    const base = CONTENT_INPUT.items[0];
    expectDomain(() => parseAssessmentContent({ items: [base, base] }), "VALIDATION");
    expectDomain(() => parseAssessmentContent({ items: [{ ...base, correctIndex: 3 }] }), "VALIDATION");
    expectDomain(() => parseAssessmentContent({ items: [{ ...base, options: ["a", " A "] }] }), "VALIDATION");
    expectDomain(() => parseAssessmentContent({ items: [{ ...base, hint: "the second one" }] }), "VALIDATION");
    expectDomain(() => parseAssessmentContent({ items: [{ id: "x", type: "listening", prompt: "p", audioUrl: "http://a.example.test/x.mp3", options: ["a", "b"], correctIndex: 0 }] }), "VALIDATION");
    expectDomain(() => parseAssessmentContent({ items: [{ id: "x", type: "code_eval", prompt: "p" }] }), "VALIDATION");
  });

  test("learners never receive answer keys, rubrics or answer-revealing order", () => {
    const learner = projectForLearner(content);
    const json = JSON.stringify(learner);
    for (const secret of ["correctIndex", "correct\"", "acceptedAnswers", "correctOrder", "pairs", "rubric", "SECRET RUBRIC", "kitaab"]) {
      assert.equal(json.includes(secret), false, `learner view leaks ${secret}`);
    }
    const order = learner.items.find((i) => i.type === "word_order");
    assert.ok(order && order.type === "word_order");
    assert.notDeepEqual([...order.tokens], CONTENT_INPUT.items[3].correctOrder);
    const matching = learner.items.find((i) => i.type === "matching");
    assert.ok(matching && matching.type === "matching");
    assert.deepEqual([...matching.rights], ["book", "pen"].sort());
  });
});

describe("grading", () => {
  test("objective items are graded with the platform's comparison rules; open items wait for a person", () => {
    const grade = autoGrade(content, parseResponses(content, [...ALL_CORRECT, { itemId: "q6", text: "My school is big." }]));
    assert.deepEqual(grade.items.slice(0, 5).map((i) => i.earnedPoints), [1, 1, 1, 1, 1]);
    assert.equal(grade.items[5].earnedPoints, null);
    assert.equal(grade.pendingReview, true);
  });

  test("wrong answers earn nothing, and an unanswered open item needs no review", () => {
    const grade = autoGrade(
      content,
      parseResponses(content, [
        { itemId: "q1", optionIndex: 0 },
        { itemId: "q2", value: false },
        { itemId: "q3", text: "qalam" },
        { itemId: "q4", tokens: ["الولد", "ذهب", "إلى", "المدرسة"] },
        { itemId: "q5", pairs: [{ left: "كتاب", right: "pen" }, { left: "قلم", right: "book" }] },
      ]),
    );
    assert.deepEqual(grade.items.map((i) => i.earnedPoints), [0, 0, 0, 0, 0, 0]);
    assert.equal(grade.pendingReview, false);
    assert.deepEqual(scoreOf(grade.items), { earnedPoints: 0, maxPoints: 15, scorePercent: 0 });
  });

  test("responses are validated against the assessment", () => {
    expectDomain(() => parseResponses(content, [{ itemId: "q99", optionIndex: 0 }]), "VALIDATION");
    expectDomain(() => parseResponses(content, [{ itemId: "q1", optionIndex: 0 }, { itemId: "q1", optionIndex: 1 }]), "VALIDATION");
    expectDomain(() => parseResponses(content, [{ itemId: "q1", optionIndex: 7 }]), "VALIDATION");
    expectDomain(() => parseResponses(content, [{ itemId: "q4", tokens: ["ذهب", "ذهب", "إلى", "المدرسة"] }]), "VALIDATION");
    expectDomain(() => parseResponses(content, [{ itemId: "q5", pairs: [{ left: "كتاب", right: "book" }] }]), "VALIDATION");
    expectDomain(() => parseResponses(content, [{ itemId: "q6", text: "word ".repeat(201) }]), "VALIDATION");
  });

  test("review scores only pending items, in half-point steps, and the score formula is round(earned / max * 100)", () => {
    const grade = autoGrade(content, parseResponses(content, [...ALL_CORRECT, { itemId: "q6", text: "My school is big." }]));
    expectDomain(() => applyReview(grade.items, {}), "VALIDATION");
    expectDomain(() => applyReview(grade.items, { q6: 11 }), "VALIDATION");
    expectDomain(() => applyReview(grade.items, { q6: 3.3 }), "VALIDATION");
    expectDomain(() => applyReview(grade.items, { q1: 0, q6: 5 }), "VALIDATION");
    const reviewed = applyReview(grade.items, { q6: 5.5 });
    assert.deepEqual(scoreOf(reviewed), { earnedPoints: 10.5, maxPoints: 15, scorePercent: 70 });
    expectDomain(() => scoreOf(grade.items), "CONFLICT");
  });

  test("the academy engine carries no pass mark", () => {
    for (const file of ["grading.ts", "delivery.ts", "content.ts"]) {
      const source = readFileSync(join(import.meta.dirname, "..", "..", "src", "lib", "academy", "assessment", file), "utf8");
      assert.doesNotMatch(source, /PASS_THRESHOLD|passed\s*[:=]|>=\s*50\b/, file);
    }
  });
});

describe("assignments and attempts", () => {
  const published: AssessmentVersionRecord = {
    id: A_VERSION, versionKind: "assessment_version", parentKind: "assessment", parentId: ASSESSMENT, versionNumber: 1, basedOnVersionId: null,
    state: "published", revision: 3, createdBy: "admin-1", createdAt: T0, updatedAt: T0, submittedAt: T0, reviewedBy: "admin-2", reviewedAt: T0,
    publishedBy: "admin-2", publishedAt: T0, supersededAt: null, archivedAt: null,
  };
  const assessment = { id: ASSESSMENT, courseId: IDS.course, mode: "quiz" as const, title: "Nouns quiz", createdBy: "admin-1", createdAt: T0 };

  test("only published versions of the class group's course are assigned, with a sensible window", () => {
    const plan = planCreateAssignment({ classGroup: group, assessment, version: published, opensAt: T0, dueAt: DUE }, ctxAt(T0, "admin-1", "admin"));
    assert.equal(plan.record.assessmentVersionId, A_VERSION);
    assert.doesNotThrow(() => buildAuditEvent(plan.audit));
    expectDomain(() => planCreateAssignment({ classGroup: group, assessment, version: { ...published, state: "approved" }, opensAt: T0 }, ctxAt(T0, "admin-1", "admin")), "CONFLICT");
    expectDomain(() => planCreateAssignment({ classGroup: group, assessment: { ...assessment, courseId: "c0000000-0000-4000-8000-000000000099" }, version: published, opensAt: T0 }, ctxAt(T0, "admin-1", "admin")), "VALIDATION");
    expectDomain(() => planCreateAssignment({ classGroup: group, assessment, version: published, opensAt: DUE, dueAt: T0 }, ctxAt(T0, "admin-1", "admin")), "VALIDATION");
  });

  test("late work follows the policy", () => {
    assert.deepEqual(lateness({ ...assignment, dueAt: null }, NO_LATE, new Date("2030-01-01")), { open: true, late: false });
    assert.deepEqual(lateness(assignment, NO_LATE, new Date(DUE)), { open: true, late: false });
    assert.deepEqual(lateness(assignment, NO_LATE, new Date("2026-10-08T20:00:01Z")), { open: false, late: true });
    assert.deepEqual(lateness(assignment, LATE_24H, new Date("2026-10-09T19:59:00Z")), { open: true, late: true });
    assert.deepEqual(lateness(assignment, LATE_24H, new Date("2026-10-09T20:00:01Z")), { open: false, late: true });
  });

  test("starting respects opening time, cancellation, deadline, one open attempt and the attempt limit", () => {
    const base = { assignment, content, learnerUid: "student-1", existing: [] as AttemptRecord[], attemptLimit: TWO_ATTEMPTS, revisionPolicy: ONE_REVISION, lateWork: NO_LATE };
    expectDomain(() => planStartAttempt(base, ctxAt("2026-09-30T00:00:00Z")), "NOT_YET_AVAILABLE");
    expectDomain(() => planStartAttempt({ ...base, assignment: { ...assignment, state: "cancelled", cancelReason: "x" } }, ctxAt("2026-10-02T00:00:00Z")), "CONFLICT");
    expectDomain(() => planStartAttempt(base, ctxAt("2026-10-09T00:00:00Z")), "CONFLICT");
    const first = started();
    expectDomain(() => planStartAttempt({ ...base, existing: [first] }, ctxAt("2026-10-02T11:00:00Z")), "CONFLICT");
    const done = [{ ...first, state: "graded" as const }, { ...first, id: "a5300000-0000-4000-8000-000000000002", attemptNumber: 2, state: "graded" as const }];
    expectDomain(() => planStartAttempt({ ...base, existing: done }, ctxAt("2026-10-02T11:00:00Z")), "CONFLICT");
    assert.equal(planStartAttempt({ ...base, existing: done, attemptLimit: { maxAttempts: null } }, ctxAt("2026-10-02T11:00:00Z")).attemptNumber, 3);
  });

  test("returned work opens a revision within the revision policy", () => {
    const returned = { ...started(), state: "returned" as const };
    const base = { assignment, content, learnerUid: "student-1", existing: [returned], attemptLimit: { maxAttempts: 1 }, revisionPolicy: ONE_REVISION, lateWork: NO_LATE };
    const revision = planStartAttempt(base, ctxAt("2026-10-03T00:00:00Z"));
    assert.equal(revision.kind, "revision");
    assert.equal(revision.revisionOfAttemptId, ATTEMPT);
    expectDomain(() => planStartAttempt({ ...base, revisionPolicy: NO_REVISION }, ctxAt("2026-10-03T00:00:00Z")), "CONFLICT");
    const usedRevision = { ...revision, state: "returned" as const, id: "a5300000-0000-4000-8000-000000000009" };
    expectDomain(() => planStartAttempt({ ...base, existing: [returned, usedRevision] }, ctxAt("2026-10-03T00:00:00Z")), "CONFLICT");
  });

  test("submission grades objective work and releases results according to policy", () => {
    const attempt = started();
    const submitCtx = ctxAt("2026-10-03T10:00:00Z");
    const immediate = planSubmitAttempt(attempt, { responses: ALL_CORRECT, expectedRevision: 1 }, { learnerUid: "student-1", assignment, content: { ...content, items: content.items.slice(0, 5) }, lateWork: NO_LATE, releaseMode: "immediate" }, submitCtx);
    assert.equal(immediate.record.state, "graded");
    assert.equal(immediate.record.scorePercent, 100);
    assert.notEqual(immediate.record.releasedAt, null);
    assert.doesNotThrow(() => buildAuditEvent(immediate.audit));
    assert.equal(JSON.stringify(immediate.audit).includes("kitaab"), false, "responses stay out of the audit trail");

    const manual = planSubmitAttempt(attempt, { responses: ALL_CORRECT, expectedRevision: 1 }, { learnerUid: "student-1", assignment, content: { ...content, items: content.items.slice(0, 5) }, lateWork: NO_LATE, releaseMode: "manual_release" }, submitCtx);
    assert.equal(manual.record.state, "graded");
    assert.equal(manual.record.releasedAt, null);

    const reviewed = planSubmitAttempt(attempt, { responses: ALL_CORRECT, expectedRevision: 1 }, { learnerUid: "student-1", assignment, content: { ...content, items: content.items.slice(0, 5) }, lateWork: NO_LATE, releaseMode: "after_teacher_review" }, submitCtx);
    assert.equal(reviewed.record.state, "needs_review");

    const withEssay = planSubmitAttempt(attempt, { responses: [...ALL_CORRECT, { itemId: "q6", text: "My school." }], expectedRevision: 1 }, { learnerUid: "student-1", assignment, content, lateWork: NO_LATE, releaseMode: "immediate" }, submitCtx);
    assert.equal(withEssay.record.state, "needs_review");
    assert.equal(withEssay.record.scorePercent, null);
  });

  test("submission is owner-only, revision-checked and closes at the deadline", () => {
    const attempt = started();
    const context = { learnerUid: "student-1", assignment, content, lateWork: NO_LATE, releaseMode: "immediate" as const };
    expectDomain(() => planSubmitAttempt(attempt, { expectedRevision: 1 }, { ...context, learnerUid: "student-2" }, ctxAt("2026-10-03T00:00:00Z", "student-2")), "NOT_FOUND");
    expectDomain(() => planSubmitAttempt(attempt, { expectedRevision: 5 }, context, ctxAt("2026-10-03T00:00:00Z")), "CONFLICT");
    expectDomain(() => planSubmitAttempt(attempt, { expectedRevision: 1 }, context, ctxAt("2026-10-10T00:00:00Z")), "CONFLICT");
    const late = planSubmitAttempt(attempt, { expectedRevision: 1 }, { ...context, lateWork: LATE_24H }, ctxAt("2026-10-09T08:00:00Z"));
    assert.equal(late.record.isLate, true);
  });

  test("teachers grade, release and return; learners see results only after release, never answer keys", () => {
    const attempt = started();
    const submitted = planSubmitAttempt(attempt, { responses: [...ALL_CORRECT, { itemId: "q6", text: "My school." }], expectedRevision: 1 }, { learnerUid: "student-1", assignment, content, lateWork: NO_LATE, releaseMode: "manual_release" }, ctxAt("2026-10-03T00:00:00Z")).record;
    const hidden = learnerAttemptView(submitted);
    assert.equal(hidden.result, null);
    assert.equal(hidden.state, "submitted");

    const teacherCtx = ctxAt("2026-10-04T00:00:00Z", "teacher-1", "teacher");
    const graded = planGradeAttempt(submitted, { scores: { q6: 8 }, feedback: "Good structure.", expectedRevision: 2 }, { releaseMode: "manual_release" }, teacherCtx).record;
    assert.equal(graded.scorePercent, 87);
    assert.equal(learnerAttemptView(graded).result, null, "manual release keeps results hidden");
    const released = planReleaseAttempt(graded, { expectedRevision: 3 }, teacherCtx).record;
    const view = learnerAttemptView(released);
    assert.equal(view.result?.scorePercent, 87);
    assert.equal(view.result?.feedback, "Good structure.");
    assert.equal(JSON.stringify(view).includes("SECRET RUBRIC"), false);
    expectDomain(() => planReleaseAttempt(released, { expectedRevision: 4 }, teacherCtx), "CONFLICT");

    expectDomain(() => planReturnAttempt(released, { feedback: "Expand paragraph two.", expectedRevision: 4 }, { revisionPolicy: NO_REVISION, revisionsUsed: 0 }, teacherCtx), "CONFLICT");
    expectDomain(() => planReturnAttempt(released, { feedback: " ", expectedRevision: 4 }, { revisionPolicy: ONE_REVISION, revisionsUsed: 0 }, teacherCtx), "VALIDATION");
    const returned = planReturnAttempt(released, { feedback: "Expand paragraph two.", expectedRevision: 4 }, { revisionPolicy: ONE_REVISION, revisionsUsed: 0 }, teacherCtx);
    assert.equal(returned.record.state, "returned");
    assert.equal(learnerAttemptView(returned.record).result?.feedback, "Expand paragraph two.");
  });
});

describe("completion", () => {
  const progress: ProgressSnapshot = {
    lessons: { total: 10, completed: 9 },
    attendance: { recordedSessions: 10, attendedSessions: 8, attendedRatio: 0.8 },
    assessments: [
      { assignmentId: ASSIGNMENT, mode: "final", title: "Final", status: "graded", bestScorePercent: 72 },
      { assignmentId: "a5200000-0000-4000-8000-000000000002", mode: "quiz", title: "Quiz", status: "awaiting_result", bestScorePercent: null },
    ],
  };
  const criteria = { requireAllLessonsCompleted: true, minimumAttendedRatio: 0.75, requiredAssessmentModes: ["final" as const], minimumAssessmentScorePercent: 70 };

  test("criteria come from policy and every unmet criterion is reported", () => {
    const evaluation = evaluateCompletion(progress, criteria);
    assert.equal(evaluation.eligible, false);
    assert.deepEqual(evaluation.checks.map((c) => [c.criterion, c.met]), [
      ["all_lessons_completed", false],
      ["minimum_attendance", true],
      ["required_assessment", true],
      ["minimum_assessment_score", true],
    ]);
    assert.equal(evaluateCompletion({ ...progress, lessons: { total: 10, completed: 10 } }, criteria).eligible, true);
    assert.equal(evaluateCompletion(progress, { ...criteria, requiredAssessmentModes: ["quiz"] }).eligible, false);
    assert.equal(evaluateCompletion({ ...progress, attendance: { recordedSessions: 0, attendedSessions: 0, attendedRatio: null } }, { ...criteria, requireAllLessonsCompleted: false }).eligible, false);
  });

  test("recording completion without meeting criteria requires an override reason; both writes are audited", () => {
    const enrollment = mapEnrollmentRow(enrollmentRow({ revision: 2 }));
    const evaluation = evaluateCompletion(progress, criteria);
    const adminCtx = ctxAt("2026-12-20T00:00:00Z", "admin-1", "admin");
    expectDomain(() => planRecordCompletion({ enrollment, criteria, evaluation, expectedRevision: 2 }, adminCtx), "CONFLICT");
    expectDomain(() => planRecordCompletion({ enrollment, criteria, evaluation, overrideReason: "Medical leave", expectedRevision: 1 }, adminCtx), "CONFLICT");
    const plan = planRecordCompletion({ enrollment, criteria, evaluation, overrideReason: "Missed lesson covered by recording", expectedRevision: 2 }, adminCtx);
    assert.equal(plan.completion.metAllCriteria, false);
    assert.equal(plan.enrollment.state, "completed");
    assert.deepEqual(plan.audits.map((a) => a.action), ["completion.record", "enrollment.change_status"]);
    for (const audit of plan.audits) assert.doesNotThrow(() => buildAuditEvent(audit));
    expectDomain(() => planRecordCompletion({ enrollment: { ...enrollment, state: "withdrawn" }, criteria, evaluation, overrideReason: "x", expectedRevision: 2 }, adminCtx), "INVALID_TRANSITION");
    expectDomain(() => planRevokeCompletion(plan.completion, { reason: "" }, adminCtx), "VALIDATION");
    const revoked = planRevokeCompletion(plan.completion, { reason: "Issued in error" }, adminCtx).record;
    expectDomain(() => planRevokeCompletion(revoked, { reason: "Again" }, adminCtx), "CONFLICT");
  });
});

describe("assessment queries", () => {
  test("queries are well formed and delivery inserts re-check state with explicit casts", () => {
    const attempt = started();
    const queries = {
      insertAssignment: assessmentRepo.insertAssignmentQuery(assignment),
      insertAttempt: assessmentRepo.insertAttemptQuery(attempt),
      updateAttempt: assessmentRepo.updateAttemptQuery(attempt, { revision: 1, state: "in_progress" }),
      reviewQueue: assessmentRepo.selectReviewQueueQuery(IDS.classGroup),
      counts: assessmentRepo.selectAssignmentAttemptCountsQuery(IDS.classGroup),
      completedLessons: assessmentRepo.selectCompletedAttendedLessonsQuery(IDS.classGroup, "student-1"),
      listAssessments: assessmentRepo.listAssessmentsQuery(null),
      learnerAttempts: assessmentRepo.selectLearnerAttemptsQuery(ASSIGNMENT, "student-1"),
    };
    for (const [name, query] of Object.entries(queries)) assert.doesNotThrow(() => assertWellFormed(query), name);
    for (const name of ["insertAssignment", "insertAttempt"] as const) {
      for (const match of queries[name].text.matchAll(/\$(\d+)(::)?/g)) assert.equal(match[2], "::", `${name}: $${match[1]} has no cast`);
    }
    assert.match(queries.insertAssignment.text, /v\.state = 'published'[\s\S]*cg\.status IN \('planned', 'active'\)/);
    assert.match(queries.insertAttempt.text, /x\.state = 'active'/);
    assert.match(queries.completedLessons.text, /a\.counts_as_attended[\s\S]*s\.state = 'completed'/);
  });
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

const POLICY_VALUES: Record<string, unknown> = {
  "assessment.attempt_limit": { maxAttempts: 2 },
  "learning.late_work": NO_LATE,
  "assessment.result_release": { mode: "immediate" },
  "learning.revision": ONE_REVISION,
  "completion.criteria": { requireAllLessonsCompleted: true, minimumAttendedRatio: null, requiredAssessmentModes: [], minimumAssessmentScorePercent: null },
};

function policyRows(configured: Record<string, unknown>) {
  return (query: { values: readonly unknown[] }) => {
    const key = String(query.values[0]);
    if (!(key in configured)) return [];
    return [{ id: "70000000-0000-4000-8000-000000000001", policy_key: key, scope: "academy", program_id: null, course_id: null, value: JSON.stringify(configured[key]), revision: 1, set_by: "admin-1", set_at: T0, reason: "Academy rule" }];
  };
}

function assignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSIGNMENT, class_group_id: IDS.classGroup, course_id: IDS.course, assessment_id: ASSESSMENT, assessment_version_id: A_VERSION,
    mode: "quiz", title: "Nouns quiz", opens_at: T0, due_at: DUE, state: "active", cancel_reason: null, revision: 1,
    created_by: "admin-1", created_at: T0, updated_by: "admin-1", updated_at: T0, ...overrides,
  };
}

function attemptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTEMPT, assignment_id: ASSIGNMENT, class_group_id: IDS.classGroup, learner_uid: "student-1", attempt_number: 1, kind: "attempt",
    revision_of_attempt_id: null, state: "in_progress", responses: "{}", item_results: null, earned_points: null, max_points: "15",
    score_percent: null, is_late: false, started_at: "2026-10-02T10:00:00Z", submitted_at: null, graded_by: null, graded_at: null,
    feedback: null, released_at: null, revision: 1, updated_at: "2026-10-02T10:00:00Z", ...overrides,
  };
}

const R = {
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  course: /FROM academy_courses WHERE id = \$1::uuid$/,
  assignment: /FROM academy_assessment_assignments WHERE id = \$1::uuid$/,
  assignments: /FROM academy_assessment_assignments WHERE class_group_id/,
  version: /FROM academy_assessment_versions WHERE id = \$1::uuid$/,
  attempt: /FROM academy_assessment_attempts WHERE id = \$1::uuid$/,
  learnerAttempts: /FROM academy_assessment_attempts WHERE assignment_id = \$1::uuid AND learner_uid/,
  groupAttempts: /FROM academy_assessment_attempts WHERE class_group_id = \$1::uuid AND learner_uid/,
  policy: /FROM academy_policy_values/,
  enrollment: /FROM academy_enrollments WHERE id = \$1::uuid$/,
  completionByEnrollment: /FROM academy_completions WHERE enrollment_id/,
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    classGroup: [classGroupRow()],
    course: [courseRow()],
    assignment: [assignmentRow()],
    assignments: [assignmentRow()],
    version: [{ id: A_VERSION, assessment_id: ASSESSMENT, version_number: 1, based_on_version_id: null, state: "published", revision: 3, created_by: "admin-1", created_at: T0, updated_at: T0, submitted_at: T0, reviewed_by: "admin-2", reviewed_at: T0, published_by: "admin-2", published_at: T0, superseded_at: null, archived_at: null, content: JSON.stringify(CONTENT_INPUT) }],
    attempt: [attemptRow()],
    learnerAttempts: [],
    groupAttempts: [],
    policy: policyRows(POLICY_VALUES),
    enrollment: [enrollmentRow({ revision: 2 })],
    completionByEnrollment: [],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

function assessments(executor: FakeExecutor, now = "2026-10-03T10:00:00Z") {
  return createAssessmentService({ executor, flags: { coreSchemaReady: true }, clock: at(now), newId: sequentialIds("b9b9b9b9"), facts });
}

describe("assessment services", () => {
  test("only administrators author assessments", async () => {
    for (const user of [teacher, student]) {
      const executor = fakeExecutor(world());
      const svc = createAssessmentAuthoringService({ executor, flags: { coreSchemaReady: true } });
      await rejectsForbidden(svc.createAssessment(user, { courseId: IDS.course, mode: "quiz", title: "Q" }));
      await rejectsForbidden(svc.getVersion(user, A_VERSION));
      await rejectsForbidden(svc.publish(user, A_VERSION, { expectedRevision: 1 }));
      assert.equal(executor.queries.length + executor.transactions.length, 0);
    }
    const published = createAssessmentAuthoringService({ executor: fakeExecutor(world()), flags: { coreSchemaReady: true } });
    await rejectsDomain(published.saveContent(admin, A_VERSION, { content: CONTENT_INPUT, expectedRevision: 3 }), "IMMUTABLE");
  });

  test("learners get the assessment without answer keys, and only once it opens", async () => {
    await rejectsDomain(assessments(fakeExecutor(world()), "2026-09-30T00:00:00Z").getAssignment(student, ASSIGNMENT), "NOT_YET_AVAILABLE");
    const view = await assessments(fakeExecutor(world())).getAssignment(student, ASSIGNMENT);
    const json = JSON.stringify(view);
    for (const secret of ["correctIndex", "acceptedAnswers", "correctOrder", "SECRET RUBRIC", "kitaab"]) assert.equal(json.includes(secret), false, secret);
    const full = await assessments(fakeExecutor(world())).getAssignment(teacher, ASSIGNMENT);
    assert.equal(JSON.stringify(full).includes("SECRET RUBRIC"), true);
    await rejectsForbidden(assessments(fakeExecutor(world())).getAssignment(outsider, ASSIGNMENT));
    await rejectsForbidden(assessments(fakeExecutor(world())).getAssignment(otherTeacher, ASSIGNMENT));
  });

  test("only active learners start attempts, within configured policy", async () => {
    await rejectsForbidden(assessments(fakeExecutor(world())).startAttempt(teacher, ASSIGNMENT));
    await rejectsForbidden(assessments(fakeExecutor(world())).startAttempt(outsider, ASSIGNMENT));
    await rejectsDomain(assessments(fakeExecutor(world({ policy: policyRows({}) }))).startAttempt(student, ASSIGNMENT), "POLICY_UNCONFIGURED");
    const executor = fakeExecutor(world());
    const view = await assessments(executor).startAttempt(student, ASSIGNMENT);
    assert.equal(view.state, "in_progress");
    assert.match(executor.transactions[0][0].text, /INSERT INTO academy_assessment_attempts[\s\S]*academy_expect_rows/);
  });

  test("submitting grades and releases per policy; other learners cannot touch the attempt", async () => {
    const executor = fakeExecutor(world());
    const view = await assessments(executor).submitAttempt(student, ATTEMPT, { responses: [...ALL_CORRECT, { itemId: "q6", text: "My school is big." }], expectedRevision: 1 });
    assert.equal(view.state, "submitted", "the essay still needs a teacher");
    assert.equal(view.result, null);
    assert.match(executor.transactions[0][0].text, /UPDATE academy_assessment_attempts[\s\S]*academy_audit_events/);

    // Without an essay answer nothing needs a person, so the immediate-release policy shows the result at once.
    const objectiveOnly = await assessments(fakeExecutor(world())).submitAttempt(student, ATTEMPT, { responses: ALL_CORRECT, expectedRevision: 1 });
    assert.equal(objectiveOnly.state, "graded");
    assert.equal(objectiveOnly.result?.scorePercent, 33);
    await rejectsDomain(assessments(fakeExecutor(world())).submitAttempt(outsider, ATTEMPT, { responses: ALL_CORRECT, expectedRevision: 1 }), "NOT_FOUND");
    await rejectsDomain(assessments(fakeExecutor(world())).getAttempt(outsider, ATTEMPT), "NOT_FOUND");
  });

  test("only the class group's teachers and administrators grade", async () => {
    const pending = attemptRow({
      state: "needs_review",
      submitted_at: "2026-10-03T10:00:00Z",
      responses: JSON.stringify({}),
      item_results: JSON.stringify([{ itemId: "q6", maxPoints: 10, earnedPoints: null, correct: null }]),
      max_points: "10",
      revision: 2,
    });
    await rejectsForbidden(assessments(fakeExecutor(world({ attempt: [pending] }))).gradeAttempt(otherTeacher, ATTEMPT, { scores: { q6: 7 }, expectedRevision: 2 }));
    await rejectsForbidden(assessments(fakeExecutor(world({ attempt: [pending] }))).gradeAttempt(student, ATTEMPT, { scores: { q6: 7 }, expectedRevision: 2 }));
    const executor = fakeExecutor(world({ attempt: [pending] }));
    const graded = await assessments(executor).gradeAttempt(teacher, ATTEMPT, { scores: { q6: 7 }, feedback: "Clear.", expectedRevision: 2 });
    assert.equal(graded.scorePercent, 70);
    assert.notEqual(graded.releasedAt, null);
    assert.match(executor.transactions[0][0].text, /UPDATE academy_assessment_attempts[\s\S]*academy_audit_events/);
  });

  test("only administrators assign assessments", async () => {
    await rejectsForbidden(assessments(fakeExecutor(world())).createAssignment(teacher, IDS.classGroup, { assessmentId: ASSESSMENT, opensAt: T0 }));
  });
});

describe("progress service", () => {
  function progress(executor: FakeExecutor) {
    return createProgressService({ executor, flags: { coreSchemaReady: true }, clock: at("2026-12-20T00:00:00Z"), newId: sequentialIds("c9c9c9c9"), facts });
  }

  test("learners see their own progress; staff name a learner; outsiders see nothing", async () => {
    const own = fakeExecutor(world());
    const mine = await progress(own).progress(student, IDS.classGroup, { learnerUid: "student-9" });
    assert.equal(mine.learnerUid, "student-1", "a learner cannot ask for someone else's progress");
    assert.equal(mine.completion.configured, true);
    await rejectsForbidden(progress(fakeExecutor(world())).progress(outsider, IDS.classGroup));
    await rejectsDomain(progress(fakeExecutor(world())).progress(teacher, IDS.classGroup), "VALIDATION");
    const staff = await progress(fakeExecutor(world({ policy: policyRows({}) }))).progress(teacher, IDS.classGroup, { learnerUid: "student-1" });
    assert.deepEqual(staff.completion, { configured: false });
  });

  test("only administrators record completion, and unmet criteria need an override", async () => {
    await rejectsForbidden(progress(fakeExecutor(world())).recordCompletion(teacher, IDS.enrollment, { expectedRevision: 2 }));
    await rejectsDomain(progress(fakeExecutor(world())).recordCompletion(admin, IDS.enrollment, { expectedRevision: 2 }), "CONFLICT");
    const executor = fakeExecutor(world());
    const result = await progress(executor).recordCompletion(admin, IDS.enrollment, { overrideReason: "Completed through make-up sessions", expectedRevision: 2 });
    assert.equal(result.enrollment.state, "completed");
    const [completionWrite, enrollmentWrite] = executor.transactions[0];
    assert.match(completionWrite.text, /INSERT INTO academy_completions[\s\S]*academy_audit_events/);
    assert.match(enrollmentWrite.text, /UPDATE academy_enrollments[\s\S]*academy_audit_events/);
    const existingCompletion = {
      id: "c5000000-0000-4000-8000-000000000001", enrollment_id: IDS.enrollment, class_group_id: IDS.classGroup, course_id: IDS.course,
      learner_uid: "student-1", completed_at: "2026-12-01T00:00:00Z", decided_by: "admin-1", met_all_criteria: true,
      criteria_snapshot: JSON.stringify({ criteria: POLICY_VALUES["completion.criteria"], evaluation: { eligible: true, checks: [] } }),
      override_reason: null, revoked_at: null, revoked_by: null, revoke_reason: null,
    };
    await rejectsDomain(progress(fakeExecutor(world({ completionByEnrollment: [existingCompletion] }))).recordCompletion(admin, IDS.enrollment, { overrideReason: "x", expectedRevision: 2 }), "CONFLICT");
  });
});
