/**
 * Phase 2.4a — server-authoritative exam grading (pure functions).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  PASS_THRESHOLD_PERCENT,
  gradeAttempt,
  isAnswerCorrect,
  stripAnswerKeys,
  safeJsonParse,
  type GradableQuestion,
} from "../../src/lib/exam/grading.ts";

function courseQuestions(n: number): Map<string, GradableQuestion> {
  const m = new Map<string, GradableQuestion>();
  for (let i = 1; i <= n; i++) {
    m.set(`q${i}`, { question_type: "choice", correct_answer: "A", options: ["A", "B", "C"] });
  }
  return m;
}

describe("gradeAttempt", () => {
  test("denominator is the served count, not the number of answers submitted", () => {
    // 10 served; the client submits only its 2 correct answers.
    const r = gradeAttempt(courseQuestions(10), [
      { questionId: "q1", answer: "A" },
      { questionId: "q2", answer: "A" },
    ], 10);
    assert.equal(r.correctCount, 2);
    assert.equal(r.totalQuestions, 10);
    assert.equal(r.score, 20);
    assert.equal(r.passed, false);
  });

  test("duplicate questionIds never count twice", () => {
    const r = gradeAttempt(courseQuestions(4), Array(20).fill({ questionId: "q1", answer: "A" }), 4);
    assert.equal(r.correctCount, 1);
    assert.equal(r.score, 25);
  });

  test("ids outside the attempt's course are ignored and reported", () => {
    const r = gradeAttempt(courseQuestions(2), [
      { questionId: "q1", answer: "A" },
      { questionId: "other-course-q", answer: "A" },
      { questionId: 123, answer: "A" },
    ], 2);
    assert.equal(r.correctCount, 1);
    assert.deepEqual(r.rejectedQuestionIds, ["other-course-q", "123"]);
  });

  test("correct count can never exceed the denominator", () => {
    const r = gradeAttempt(courseQuestions(5), [
      { questionId: "q1", answer: "A" },
      { questionId: "q2", answer: "A" },
      { questionId: "q3", answer: "A" },
    ], 2); // a smaller served count than the course size
    assert.equal(r.totalQuestions, 2);
    assert.equal(r.correctCount, 2);
    assert.equal(r.score, 100);
  });

  test("falls back to the course size when the served count is unusable", () => {
    for (const bad of [0, -1, 2.5, NaN]) {
      const r = gradeAttempt(courseQuestions(4), [{ questionId: "q1", answer: "A" }], bad);
      assert.equal(r.totalQuestions, 4, `servedCount=${bad}`);
    }
  });

  test("pass threshold is inclusive at 50%", () => {
    assert.equal(PASS_THRESHOLD_PERCENT, 50);
    const half = gradeAttempt(courseQuestions(4), [
      { questionId: "q1", answer: "A" },
      { questionId: "q2", answer: "A" },
    ], 4);
    assert.equal(half.score, 50);
    assert.equal(half.passed, true);
    const below = gradeAttempt(courseQuestions(4), [{ questionId: "q1", answer: "A" }], 4);
    assert.equal(below.passed, false);
  });

  test("empty question set scores 0 and does not pass", () => {
    const r = gradeAttempt(new Map(), [{ questionId: "q1", answer: "A" }], 0);
    assert.deepEqual({ score: r.score, passed: r.passed, total: r.totalQuestions }, { score: 0, passed: false, total: 0 });
  });

  test("malformed answer entries do not throw", () => {
    const r = gradeAttempt(courseQuestions(2), [null, undefined, {}, { questionId: null }] as never[], 2);
    assert.equal(r.correctCount, 0);
  });
});

describe("isAnswerCorrect (pre-existing rules)", () => {
  test("choice: numeric correct index resolves through options", () => {
    assert.equal(isAnswerCorrect("choice", "B", 1, ["A", "B"]), true);
    assert.equal(isAnswerCorrect("choice", "b ", "1", ["A", "B"]), true);
    assert.equal(isAnswerCorrect("choice", "A", 1, ["A", "B"]), false);
  });
  test("fill_blank is case/whitespace-insensitive", () => {
    assert.equal(isAnswerCorrect("fill_blank", "  Kitab ", "kitab"), true);
  });
  test("word_order / matching compare structurally", () => {
    assert.equal(isAnswerCorrect("word_order", ["a", "b"], ["a", "b"]), true);
    assert.equal(isAnswerCorrect("matching", { a: 1 }, { a: 2 }), false);
  });
  test("unknown types are never correct", () => {
    assert.equal(isAnswerCorrect("essay", "x", "x"), false);
  });
});

describe("stripAnswerKeys", () => {
  test("removes every answer-key field regardless of case and keeps the rest", () => {
    const rows = [
      { id: "1", question: "?", options: ["a"], correct: 0, correct_answer: "a", correctAnswer: "a", answer_key: "a", correct_index: 0, Correct: 0 },
    ];
    const [out] = stripAnswerKeys(rows);
    assert.deepEqual(out, { id: "1", question: "?", options: ["a"] });
  });
  test("returns copies (input rows are not mutated)", () => {
    const rows = [{ id: "1", correct: 2 }];
    stripAnswerKeys(rows);
    assert.equal(rows[0].correct, 2);
  });
});

describe("safeJsonParse", () => {
  test("parses JSON strings, passes objects through, keeps plain text", () => {
    assert.deepEqual(safeJsonParse('["a","b"]'), ["a", "b"]);
    assert.deepEqual(safeJsonParse({ a: 1 }), { a: 1 });
    assert.equal(safeJsonParse("plain, text"), "plain, text");
    assert.equal(safeJsonParse(null), null);
  });
});
