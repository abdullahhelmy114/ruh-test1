/**
 * Responses and grading for the assessment engine.
 *
 * Objective items reuse the platform's existing answer comparison
 * (`isAnswerCorrect` in src/lib/exam/grading.ts), so the academy engine and
 * the legacy exam flow judge answers identically. The score is
 * round(earned / max * 100), the same formula, weighted by item points.
 *
 * There is no pass mark here. Whether a score is enough is an academy
 * decision (completion and certificate policies), never a constant.
 */
import { isAnswerCorrect } from "../../exam/grading.ts";
import { DomainError } from "../domain/errors.ts";
import { parseOptionalHttpsUrl } from "../domain/text.ts";
import { isObjective, maxPoints, type AssessmentContent, type AssessmentItem } from "./content.ts";

export type ItemResponse =
  | { readonly itemId: string; readonly optionIndex: number }
  | { readonly itemId: string; readonly value: boolean }
  | { readonly itemId: string; readonly text: string }
  | { readonly itemId: string; readonly tokens: readonly string[] }
  | { readonly itemId: string; readonly pairs: readonly { readonly left: string; readonly right: string }[] }
  | { readonly itemId: string; readonly audioUrl: string };

export type Responses = Readonly<Record<string, ItemResponse>>;

function fail(itemId: string, message: string): never {
  throw new DomainError("VALIDATION", `Response to "${itemId}": ${message}`);
}

function parseOne(item: AssessmentItem, raw: Record<string, unknown>): ItemResponse {
  const itemId = item.id;
  switch (item.type) {
    case "choice":
    case "listening": {
      const index = raw.optionIndex;
      if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= item.options.length) fail(itemId, "choose one of the options");
      return { itemId, optionIndex: index as number };
    }
    case "true_false":
      if (typeof raw.value !== "boolean") fail(itemId, "answer true or false");
      return { itemId, value: raw.value };
    case "fill_blank":
    case "short_text": {
      const max = item.type === "short_text" ? item.maxLength : 500;
      if (typeof raw.text !== "string" || raw.text.length > max) fail(itemId, `answer with at most ${max} characters`);
      return { itemId, text: raw.text };
    }
    case "essay": {
      if (typeof raw.text !== "string" || raw.text.length > 50_000) fail(itemId, "answer with at most 50000 characters");
      if (item.maxWords !== null && raw.text.trim().split(/\s+/).filter(Boolean).length > item.maxWords) {
        fail(itemId, `answer with at most ${item.maxWords} words`);
      }
      return { itemId, text: raw.text };
    }
    case "word_order": {
      const tokens = raw.tokens;
      if (!Array.isArray(tokens) || tokens.length !== item.correctOrder.length || tokens.some((t) => typeof t !== "string")) {
        fail(itemId, "arrange every word exactly once");
      }
      const expected = [...item.correctOrder].sort();
      const given = [...(tokens as string[])].sort();
      if (expected.some((token, i) => token !== given[i])) fail(itemId, "arrange every word exactly once");
      return { itemId, tokens: tokens as string[] };
    }
    case "matching": {
      const pairs = raw.pairs;
      if (!Array.isArray(pairs) || pairs.length !== item.pairs.length) fail(itemId, "match every item exactly once");
      const lefts = new Set(item.pairs.map((p) => p.left));
      const rights = item.pairs.map((p) => p.right).sort();
      const seenLeft = new Set<string>();
      const parsed = (pairs as unknown[]).map((pair) => {
        const p = pair as Record<string, unknown> | null;
        if (!p || typeof p.left !== "string" || typeof p.right !== "string" || !lefts.has(p.left) || seenLeft.has(p.left)) {
          fail(itemId, "match every item exactly once");
        }
        seenLeft.add(p.left);
        return { left: p.left, right: p.right };
      });
      const givenRights = parsed.map((p) => p.right).sort();
      if (rights.some((right, i) => right !== givenRights[i])) fail(itemId, "match every item exactly once");
      return { itemId, pairs: parsed };
    }
    case "oral_response": {
      const url = parseOptionalHttpsUrl(raw.audioUrl, "audioUrl");
      if (!url) fail(itemId, "attach a recording");
      return { itemId, audioUrl: url };
    }
  }
}

/**
 * Parses submitted answers against the assessment. Unknown items are refused;
 * unanswered items are allowed (they earn nothing).
 */
export function parseResponses(content: AssessmentContent, input: unknown): Responses {
  if (input === undefined || input === null) return {};
  if (!Array.isArray(input)) throw new DomainError("VALIDATION", "responses must be a list.");
  const items = new Map(content.items.map((item) => [item.id, item]));
  const out: Record<string, ItemResponse> = {};
  for (const raw of input) {
    if (!raw || typeof raw !== "object") throw new DomainError("VALIDATION", "Each response must be an object.");
    const itemId = (raw as { itemId?: unknown }).itemId;
    if (typeof itemId !== "string" || !items.has(itemId)) throw new DomainError("VALIDATION", "A response refers to an item that is not in this assessment.");
    if (out[itemId]) throw new DomainError("VALIDATION", "An item is answered twice.");
    out[itemId] = parseOne(items.get(itemId) as AssessmentItem, raw as Record<string, unknown>);
  }
  return out;
}

export interface ItemResult {
  readonly itemId: string;
  readonly maxPoints: number;
  /** null while a person still has to grade the item. */
  readonly earnedPoints: number | null;
  readonly correct: boolean | null;
}

function objectiveCorrect(item: AssessmentItem, response: ItemResponse | undefined): boolean {
  if (!response) return false;
  switch (item.type) {
    case "choice":
    case "listening": {
      const answer = "optionIndex" in response ? item.options[response.optionIndex] : undefined;
      return isAnswerCorrect("choice", answer, item.correctIndex, item.options);
    }
    case "true_false":
      return "value" in response && isAnswerCorrect("true_false", String(response.value), String(item.correct));
    case "fill_blank":
    case "short_text": {
      if (!("text" in response)) return false;
      const accepted = item.type === "fill_blank" ? item.acceptedAnswers : (item.acceptedAnswers ?? []);
      return accepted.some((answer) => isAnswerCorrect("fill_blank", response.text, answer));
    }
    case "word_order":
      return "tokens" in response && isAnswerCorrect("word_order", [...response.tokens], [...item.correctOrder]);
    case "matching": {
      if (!("pairs" in response)) return false;
      const byLeft = (a: { left: string }, b: { left: string }) => (a.left < b.left ? -1 : a.left > b.left ? 1 : 0);
      const given = [...response.pairs].map((p) => ({ left: p.left, right: p.right })).sort(byLeft);
      const expected = [...item.pairs].map((p) => ({ left: p.left, right: p.right })).sort(byLeft);
      return isAnswerCorrect("matching", given, expected);
    }
    default:
      return false;
  }
}

export interface AutoGrade {
  readonly items: readonly ItemResult[];
  readonly maxPoints: number;
  readonly pendingReview: boolean;
}

/** Grades objective items; open items are left for a person. */
export function autoGrade(content: AssessmentContent, responses: Responses): AutoGrade {
  const items = content.items.map((item): ItemResult => {
    const response = responses[item.id];
    if (!isObjective(item)) {
      // An unanswered open item needs no review: it earns nothing.
      return response ? { itemId: item.id, maxPoints: item.points, earnedPoints: null, correct: null } : { itemId: item.id, maxPoints: item.points, earnedPoints: 0, correct: null };
    }
    const correct = objectiveCorrect(item, response);
    return { itemId: item.id, maxPoints: item.points, earnedPoints: correct ? item.points : 0, correct };
  });
  return { items, maxPoints: maxPoints(content), pendingReview: items.some((i) => i.earnedPoints === null) };
}

/** Applies a reviewer's points to items still awaiting review. Every pending item must be graded. */
export function applyReview(results: readonly ItemResult[], scores: unknown): ItemResult[] {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    throw new DomainError("VALIDATION", "scores must map item ids to points.");
  }
  const given = scores as Record<string, unknown>;
  const known = new Set(results.map((r) => r.itemId));
  for (const itemId of Object.keys(given)) {
    if (!known.has(itemId)) throw new DomainError("VALIDATION", "A score refers to an item that is not in this assessment.");
  }
  return results.map((result) => {
    if (result.earnedPoints !== null) {
      if (given[result.itemId] !== undefined) throw new DomainError("VALIDATION", "Only items awaiting review can be scored by hand.");
      return result;
    }
    const points = given[result.itemId];
    if (typeof points !== "number" || !Number.isFinite(points) || points < 0 || points > result.maxPoints || Math.round(points * 2) !== points * 2) {
      throw new DomainError("VALIDATION", `Give "${result.itemId}" between 0 and ${result.maxPoints} points (whole or half points).`);
    }
    return { ...result, earnedPoints: points };
  });
}

export function scoreOf(results: readonly ItemResult[]): { earnedPoints: number; maxPoints: number; scorePercent: number } {
  if (results.some((r) => r.earnedPoints === null)) throw new DomainError("CONFLICT", "Some answers still need to be graded.");
  const earned = results.reduce((sum, r) => sum + (r.earnedPoints as number), 0);
  const max = results.reduce((sum, r) => sum + r.maxPoints, 0);
  return { earnedPoints: earned, maxPoints: max, scorePercent: max > 0 ? Math.round((earned / max) * 100) : 0 };
}
