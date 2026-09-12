/**
 * Server-authoritative exam grading helpers (Phase 2.4a).
 *
 * Pure functions with no I/O so they can be unit-tested. The grading formula
 * (score = round(correct / total * 100), pass at >= 50) is the pre-existing
 * one; what changed is the SOURCE of each input:
 *   - the valid question set comes from the attempt's course, never the client
 *   - the denominator is the number of questions served at start-exam
 *     (exam_attempts.total_questions), never the size of the submitted subset
 *   - answers are de-duplicated by questionId and capped at the denominator
 */

export const PASS_THRESHOLD_PERCENT = 50;

export interface GradableQuestion {
  question_type: string;
  correct_answer: unknown;
  options?: unknown;
}

export interface SubmittedAnswer {
  questionId: unknown;
  answer: unknown;
}

export interface GradeResult {
  correctCount: number;
  totalQuestions: number;
  score: number;
  passed: boolean;
  /** Submitted ids that were not part of the attempt's course (ignored). */
  rejectedQuestionIds: string[];
}

export function safeJsonParse(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function normalizeText(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Pre-existing per-question comparison rules (unchanged). */
export function isAnswerCorrect(
  questionType: string,
  userAnswer: unknown,
  correctAnswer: unknown,
  options?: unknown
): boolean {
  let finalCorrect = correctAnswer;
  if (
    (typeof correctAnswer === "number" || /^\d+$/.test(String(correctAnswer))) &&
    Array.isArray(options)
  ) {
    const idx = parseInt(String(correctAnswer), 10);
    if (idx >= 0 && idx < options.length) finalCorrect = options[idx];
  }

  switch (questionType) {
    case "choice":
    case "true_false":
    case "listening":
    case "fill_blank":
      return normalizeText(userAnswer) === normalizeText(finalCorrect);
    case "word_order":
    case "matching":
      return JSON.stringify(userAnswer) === JSON.stringify(finalCorrect);
    default:
      return false;
  }
}

/**
 * Grade a submission against the attempt's own question set.
 * @param questions  map of questionId -> question, restricted to the attempt's course
 * @param answers    client-submitted answers (untrusted)
 * @param servedCount number of questions served at start-exam (attempt.total_questions)
 */
export function gradeAttempt(
  questions: Map<string, GradableQuestion>,
  answers: SubmittedAnswer[],
  servedCount: number
): GradeResult {
  const seen = new Set<string>();
  const rejectedQuestionIds: string[] = [];
  let correctCount = 0;

  for (const ans of answers) {
    const id = typeof ans?.questionId === "string" ? ans.questionId : String(ans?.questionId ?? "");
    if (!id || seen.has(id)) continue; // duplicates never count twice
    const q = questions.get(id);
    if (!q) {
      rejectedQuestionIds.push(id); // not in this attempt's course
      continue;
    }
    seen.add(id);
    if (isAnswerCorrect(q.question_type, ans.answer, q.correct_answer, q.options)) correctCount++;
  }

  // The denominator is what the server served, never what the client chose to send.
  const totalQuestions = Number.isInteger(servedCount) && servedCount > 0 ? servedCount : questions.size;
  if (correctCount > totalQuestions) correctCount = totalQuestions;

  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  return { correctCount, totalQuestions, score, passed: score >= PASS_THRESHOLD_PERCENT, rejectedQuestionIds };
}

/** Keys that must never reach a student client. */
const ANSWER_KEY_FIELDS = new Set(["correct", "correct_answer", "correctanswer", "answer_key", "correct_index"]);

/** Return a copy of each row with answer-key fields removed. */
export function stripAnswerKeys<T extends Record<string, unknown>>(rows: T[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!ANSWER_KEY_FIELDS.has(k.toLowerCase())) out[k] = v;
    }
    return out;
  });
}
