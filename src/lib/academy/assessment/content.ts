/**
 * Assessment content for the single assessment engine.
 *
 * Every assessment mode (practice, quiz, homework, writing, oral, placement,
 * midterm, final) uses the same item model. Objective items are graded by
 * the server with the existing comparison rules (src/lib/exam/grading.ts);
 * open items (short text without accepted answers, essays, oral responses)
 * are graded by a person.
 *
 * Answer keys and rubrics never reach learners: `projectForLearner` removes
 * them and re-orders anything whose stored order would reveal the answer.
 */
import { DomainError } from "../domain/errors.ts";
import { parseOptionalHttpsUrl } from "../domain/text.ts";

export const ITEM_TYPES = [
  "choice",
  "true_false",
  "fill_blank",
  "word_order",
  "matching",
  "listening",
  "short_text",
  "essay",
  "oral_response",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const MAX_ITEMS = 200;

interface ItemBase {
  readonly id: string;
  readonly prompt: string;
  readonly points: number;
}

export type AssessmentItem =
  | (ItemBase & { readonly type: "choice"; readonly options: readonly string[]; readonly correctIndex: number })
  | (ItemBase & { readonly type: "true_false"; readonly correct: boolean })
  | (ItemBase & { readonly type: "fill_blank"; readonly acceptedAnswers: readonly string[] })
  | (ItemBase & { readonly type: "word_order"; readonly correctOrder: readonly string[] })
  | (ItemBase & { readonly type: "matching"; readonly pairs: readonly { readonly left: string; readonly right: string }[] })
  | (ItemBase & { readonly type: "listening"; readonly audioUrl: string; readonly options: readonly string[]; readonly correctIndex: number })
  | (ItemBase & { readonly type: "short_text"; readonly acceptedAnswers: readonly string[] | null; readonly maxLength: number })
  | (ItemBase & { readonly type: "essay"; readonly maxWords: number | null; readonly rubric: string | null })
  | (ItemBase & { readonly type: "oral_response"; readonly maxSeconds: number; readonly rubric: string | null });

export interface AssessmentContent {
  readonly instructions: string | null;
  readonly items: readonly AssessmentItem[];
}

const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;

function fail(path: string, message: string): never {
  throw new DomainError("VALIDATION", `${path}: ${message}`);
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== "string") fail(path, "must be text");
  const trimmed = value.trim();
  if (trimmed.length === 0) fail(path, "must not be empty");
  if (trimmed.length > max) fail(path, `must be at most ${max} characters`);
  return trimmed;
}

function optionalText(value: unknown, path: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, path, max);
}

function int(value: unknown, path: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(path, `must be a whole number from ${min} to ${max}`);
  return value as number;
}

function strings(value: unknown, path: string, min: number, max: number, itemMax: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, `must list ${min} to ${max} entries`);
  return value.map((entry, i) => text(entry, `${path}[${i}]`, itemMax));
}

/** Options are compared as normalised text when grading, so they must differ as normalised text. */
function distinctOptions(value: unknown, path: string): string[] {
  const options = strings(value, path, 2, 12, 1000);
  const seen = new Set<string>();
  for (const option of options) {
    const key = option.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) fail(path, "options must all be different");
    seen.add(key);
  }
  return options;
}

function allowed(raw: Record<string, unknown>, keys: readonly string[], path: string): void {
  for (const key of Object.keys(raw)) if (!keys.includes(key)) fail(path, `unexpected field "${key}"`);
}

const BASE_KEYS = ["id", "type", "prompt", "points"];

function parseItem(raw: unknown, index: number, ids: Set<string>): AssessmentItem {
  const path = `items[${index}]`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(path, "must be an object");
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || !ITEM_ID.test(item.id)) fail(path, "id must be 1-64 letters, digits, hyphens or underscores");
  if (ids.has(item.id)) fail(path, "id is used twice");
  ids.add(item.id);
  if (typeof item.type !== "string" || !(ITEM_TYPES as readonly string[]).includes(item.type)) fail(path, "unknown item type");
  const base = {
    id: item.id,
    prompt: text(item.prompt, `${path}.prompt`, 5000),
    points: item.points === undefined ? 1 : int(item.points, `${path}.points`, 1, 100),
  };
  switch (item.type as ItemType) {
    case "choice": {
      allowed(item, [...BASE_KEYS, "options", "correctIndex"], path);
      const options = distinctOptions(item.options, `${path}.options`);
      return { ...base, type: "choice", options, correctIndex: int(item.correctIndex, `${path}.correctIndex`, 0, options.length - 1) };
    }
    case "true_false":
      allowed(item, [...BASE_KEYS, "correct"], path);
      if (typeof item.correct !== "boolean") fail(path, "correct must be true or false");
      return { ...base, type: "true_false", correct: item.correct };
    case "fill_blank":
      allowed(item, [...BASE_KEYS, "acceptedAnswers"], path);
      return { ...base, type: "fill_blank", acceptedAnswers: strings(item.acceptedAnswers, `${path}.acceptedAnswers`, 1, 20, 500) };
    case "word_order": {
      allowed(item, [...BASE_KEYS, "correctOrder"], path);
      return { ...base, type: "word_order", correctOrder: strings(item.correctOrder, `${path}.correctOrder`, 2, 50, 200) };
    }
    case "matching": {
      allowed(item, [...BASE_KEYS, "pairs"], path);
      if (!Array.isArray(item.pairs) || item.pairs.length < 2 || item.pairs.length > 30) fail(path, "pairs must list 2 to 30 entries");
      const lefts = new Set<string>();
      const pairs = item.pairs.map((pair: unknown, i: number) => {
        const p = `${path}.pairs[${i}]`;
        if (!pair || typeof pair !== "object") fail(p, "must be an object");
        const raw = pair as Record<string, unknown>;
        allowed(raw, ["left", "right"], p);
        const left = text(raw.left, `${p}.left`, 500);
        if (lefts.has(left)) fail(p, "left side is used twice");
        lefts.add(left);
        return { left, right: text(raw.right, `${p}.right`, 500) };
      });
      return { ...base, type: "matching", pairs };
    }
    case "listening": {
      allowed(item, [...BASE_KEYS, "audioUrl", "options", "correctIndex"], path);
      const audioUrl = parseOptionalHttpsUrl(item.audioUrl, `${path}.audioUrl`);
      if (!audioUrl) fail(path, "audioUrl is required");
      const options = distinctOptions(item.options, `${path}.options`);
      return { ...base, type: "listening", audioUrl, options, correctIndex: int(item.correctIndex, `${path}.correctIndex`, 0, options.length - 1) };
    }
    case "short_text":
      allowed(item, [...BASE_KEYS, "acceptedAnswers", "maxLength"], path);
      return {
        ...base,
        type: "short_text",
        acceptedAnswers: item.acceptedAnswers === undefined || item.acceptedAnswers === null ? null : strings(item.acceptedAnswers, `${path}.acceptedAnswers`, 1, 20, 500),
        maxLength: item.maxLength === undefined ? 500 : int(item.maxLength, `${path}.maxLength`, 1, 2000),
      };
    case "essay":
      allowed(item, [...BASE_KEYS, "maxWords", "rubric"], path);
      return {
        ...base,
        type: "essay",
        maxWords: item.maxWords === undefined || item.maxWords === null ? null : int(item.maxWords, `${path}.maxWords`, 1, 10000),
        rubric: optionalText(item.rubric, `${path}.rubric`, 10000),
      };
    case "oral_response":
      allowed(item, [...BASE_KEYS, "maxSeconds", "rubric"], path);
      return {
        ...base,
        type: "oral_response",
        maxSeconds: int(item.maxSeconds, `${path}.maxSeconds`, 5, 3600),
        rubric: optionalText(item.rubric, `${path}.rubric`, 10000),
      };
  }
}

export function parseAssessmentContent(input: unknown): AssessmentContent {
  if (!input || typeof input !== "object" || !Array.isArray((input as { items?: unknown }).items)) {
    throw new DomainError("VALIDATION", "Assessment content must contain a list of items.");
  }
  const raw = input as { instructions?: unknown; items: unknown[] };
  if (raw.items.length > MAX_ITEMS) throw new DomainError("VALIDATION", `An assessment can have at most ${MAX_ITEMS} items.`);
  const ids = new Set<string>();
  return {
    instructions: optionalText(raw.instructions, "instructions", 10000),
    items: raw.items.map((item, index) => parseItem(item, index, ids)),
  };
}

export function readStoredAssessmentContent(stored: unknown): AssessmentContent {
  return parseAssessmentContent(typeof stored === "string" ? JSON.parse(stored) : stored);
}

export function maxPoints(content: AssessmentContent): number {
  return content.items.reduce((sum, item) => sum + item.points, 0);
}

/** Whether an item can be graded without a person. */
export function isObjective(item: AssessmentItem): boolean {
  if (item.type === "essay" || item.type === "oral_response") return false;
  if (item.type === "short_text") return item.acceptedAnswers !== null;
  return true;
}

/** Sorting shown to learners never depends on the stored (answer-revealing) order. */
function neutralOrder(values: readonly string[]): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export type LearnerItem =
  | (ItemBase & { readonly type: "choice"; readonly options: readonly string[] })
  | (ItemBase & { readonly type: "true_false" })
  | (ItemBase & { readonly type: "fill_blank" })
  | (ItemBase & { readonly type: "word_order"; readonly tokens: readonly string[] })
  | (ItemBase & { readonly type: "matching"; readonly lefts: readonly string[]; readonly rights: readonly string[] })
  | (ItemBase & { readonly type: "listening"; readonly audioUrl: string; readonly options: readonly string[] })
  | (ItemBase & { readonly type: "short_text"; readonly maxLength: number })
  | (ItemBase & { readonly type: "essay"; readonly maxWords: number | null })
  | (ItemBase & { readonly type: "oral_response"; readonly maxSeconds: number });

/** What a learner may see: no answer keys, no rubrics, no revealing order. */
export function projectForLearner(content: AssessmentContent): { readonly instructions: string | null; readonly items: readonly LearnerItem[] } {
  return {
    instructions: content.instructions,
    items: content.items.map((item): LearnerItem => {
      const base = { id: item.id, prompt: item.prompt, points: item.points };
      switch (item.type) {
        case "choice":
          return { ...base, type: "choice", options: item.options };
        case "true_false":
          return { ...base, type: "true_false" };
        case "fill_blank":
          return { ...base, type: "fill_blank" };
        case "word_order":
          return { ...base, type: "word_order", tokens: neutralOrder(item.correctOrder) };
        case "matching":
          return { ...base, type: "matching", lefts: item.pairs.map((p) => p.left), rights: neutralOrder(item.pairs.map((p) => p.right)) };
        case "listening":
          return { ...base, type: "listening", audioUrl: item.audioUrl, options: item.options };
        case "short_text":
          return { ...base, type: "short_text", maxLength: item.maxLength };
        case "essay":
          return { ...base, type: "essay", maxWords: item.maxWords };
        case "oral_response":
          return { ...base, type: "oral_response", maxSeconds: item.maxSeconds };
      }
    }),
  };
}
