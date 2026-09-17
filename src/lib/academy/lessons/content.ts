/**
 * Canonical Lesson Script content.
 *
 * A lesson script version holds an ordered list of typed blocks. Every block
 * has a stable id that survives across versions, so learners' private
 * annotations stay anchored when the academy publishes a revision.
 *
 * Text is stored as plain text (never HTML): what an author writes can never
 * execute in a reader's browser.
 *
 * Audiences see different projections of the same canonical content:
 *   - learners never receive teacher notes, exercise answers or explanations;
 *   - teachers and administrators receive the full script.
 */
import { DomainError } from "../domain/errors.ts";
import { defaultIdGenerator, isUuid, type IdGenerator } from "../domain/ids.ts";
import { parseOptionalHttpsUrl } from "../domain/text.ts";

export const MAX_BLOCKS = 500;
export const MAX_BLOCK_TEXT = 20_000;
export const MAX_CONTENT_BYTES = 800_000;

export const BLOCK_TYPES = [
  "heading",
  "paragraph",
  "arabic_text",
  "list",
  "vocabulary",
  "example",
  "exercise",
  "audio",
  "image",
  "teacher_note",
  "divider",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export interface ExerciseOption {
  readonly id: string;
  readonly text: string;
}

export interface ExerciseQuestion {
  readonly id: string;
  readonly question: string;
  readonly options: readonly ExerciseOption[];
  /** Answer key: never sent to learners. */
  readonly correctOptionId: string | null;
  /** May reveal the answer: never sent to learners. */
  readonly explanation: string | null;
}

export type LessonBlock =
  | { readonly id: string; readonly type: "heading"; readonly level: 1 | 2 | 3; readonly text: string }
  | { readonly id: string; readonly type: "paragraph"; readonly text: string }
  | { readonly id: string; readonly type: "arabic_text"; readonly text: string; readonly translation: string | null }
  | { readonly id: string; readonly type: "list"; readonly ordered: boolean; readonly items: readonly string[] }
  | { readonly id: string; readonly type: "vocabulary"; readonly entries: readonly { readonly term: string; readonly meaning: string; readonly note: string | null }[] }
  | { readonly id: string; readonly type: "example"; readonly text: string; readonly translation: string | null }
  | { readonly id: string; readonly type: "exercise"; readonly prompt: string; readonly questions: readonly ExerciseQuestion[] }
  | { readonly id: string; readonly type: "audio"; readonly title: string; readonly url: string; readonly transcript: string | null }
  | { readonly id: string; readonly type: "image"; readonly url: string; readonly alt: string; readonly caption: string | null }
  | { readonly id: string; readonly type: "teacher_note"; readonly text: string }
  | { readonly id: string; readonly type: "divider" };

export interface LessonContent {
  readonly blocks: readonly LessonBlock[];
}

const LOCAL_ID = /^[A-Za-z0-9_-]{1,64}$/;

function fail(path: string, message: string): never {
  throw new DomainError("VALIDATION", `${path}: ${message}`);
}

function text(value: unknown, path: string, max = MAX_BLOCK_TEXT): string {
  if (typeof value !== "string") fail(path, "must be text");
  const trimmed = value.replace(/\r\n?/g, "\n").trim();
  if (trimmed.length === 0) fail(path, "must not be empty");
  if (trimmed.length > max) fail(path, `must be at most ${max} characters`);
  return trimmed;
}

function optionalText(value: unknown, path: string, max = MAX_BLOCK_TEXT): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, path, max);
}

function allowedKeys(raw: Record<string, unknown>, keys: readonly string[], path: string): void {
  for (const key of Object.keys(raw)) {
    if (!keys.includes(key)) fail(path, `unexpected field "${key}"`);
  }
}

function list(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, `must list ${min} to ${max} items`);
  return value;
}

function url(value: unknown, path: string): string {
  const parsed = parseOptionalHttpsUrl(value, path);
  if (!parsed) fail(path, "an https link is required");
  return parsed;
}

function localId(value: unknown, path: string, seen: Set<string>, generate: IdGenerator): string {
  let id: string;
  if (value === undefined || value === null || value === "") {
    id = generate();
  } else {
    if (typeof value !== "string" || !LOCAL_ID.test(value)) fail(path, "id must be 1-64 letters, digits, hyphens or underscores");
    id = value;
  }
  if (seen.has(id)) fail(path, "id is used twice");
  seen.add(id);
  return id;
}

function parseBlock(raw: unknown, index: number, blockIds: Set<string>, generate: IdGenerator): LessonBlock {
  const path = `blocks[${index}]`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(path, "must be an object");
  const block = raw as Record<string, unknown>;
  const type = block.type;
  if (typeof type !== "string" || !(BLOCK_TYPES as readonly string[]).includes(type)) fail(path, "unknown block type");

  let id: string;
  if (block.id === undefined || block.id === null || block.id === "") {
    id = generate();
    if (!isUuid(id)) throw new Error("Identifier generator returned an invalid id.");
  } else {
    if (!isUuid(block.id)) fail(path, "id must be a valid identifier");
    id = (block.id as string).toLowerCase();
  }
  if (blockIds.has(id)) fail(path, "block id is used twice");
  blockIds.add(id);

  switch (type as BlockType) {
    case "heading": {
      allowedKeys(block, ["id", "type", "level", "text"], path);
      if (block.level !== 1 && block.level !== 2 && block.level !== 3) fail(path, "level must be 1, 2 or 3");
      return { id, type: "heading", level: block.level, text: text(block.text, `${path}.text`, 500) };
    }
    case "paragraph":
      allowedKeys(block, ["id", "type", "text"], path);
      return { id, type: "paragraph", text: text(block.text, `${path}.text`) };
    case "arabic_text":
      allowedKeys(block, ["id", "type", "text", "translation"], path);
      return { id, type: "arabic_text", text: text(block.text, `${path}.text`), translation: optionalText(block.translation, `${path}.translation`) };
    case "list": {
      allowedKeys(block, ["id", "type", "ordered", "items"], path);
      if (typeof block.ordered !== "boolean") fail(path, "ordered must be true or false");
      const items = list(block.items, `${path}.items`, 1, 200).map((item, i) => text(item, `${path}.items[${i}]`, 2000));
      return { id, type: "list", ordered: block.ordered, items };
    }
    case "vocabulary": {
      allowedKeys(block, ["id", "type", "entries"], path);
      const entries = list(block.entries, `${path}.entries`, 1, 200).map((entry, i) => {
        const p = `${path}.entries[${i}]`;
        if (!entry || typeof entry !== "object") fail(p, "must be an object");
        const e = entry as Record<string, unknown>;
        allowedKeys(e, ["term", "meaning", "note"], p);
        return { term: text(e.term, `${p}.term`, 500), meaning: text(e.meaning, `${p}.meaning`, 2000), note: optionalText(e.note, `${p}.note`, 2000) };
      });
      return { id, type: "vocabulary", entries };
    }
    case "example":
      allowedKeys(block, ["id", "type", "text", "translation"], path);
      return { id, type: "example", text: text(block.text, `${path}.text`), translation: optionalText(block.translation, `${path}.translation`) };
    case "exercise": {
      allowedKeys(block, ["id", "type", "prompt", "questions"], path);
      const questionIds = new Set<string>();
      const questions = list(block.questions, `${path}.questions`, 1, 100).map((rawQuestion, qi) => {
        const qp = `${path}.questions[${qi}]`;
        if (!rawQuestion || typeof rawQuestion !== "object") fail(qp, "must be an object");
        const q = rawQuestion as Record<string, unknown>;
        allowedKeys(q, ["id", "question", "options", "correctOptionId", "explanation"], qp);
        const optionIds = new Set<string>();
        const options = list(q.options, `${qp}.options`, 2, 12).map((rawOption, oi) => {
          const op = `${qp}.options[${oi}]`;
          if (!rawOption || typeof rawOption !== "object") fail(op, "must be an object");
          const o = rawOption as Record<string, unknown>;
          allowedKeys(o, ["id", "text"], op);
          return { id: localId(o.id, op, optionIds, () => `o${oi + 1}`), text: text(o.text, `${op}.text`, 2000) };
        });
        let correctOptionId: string | null = null;
        if (q.correctOptionId !== undefined && q.correctOptionId !== null) {
          if (typeof q.correctOptionId !== "string" || !optionIds.has(q.correctOptionId)) fail(qp, "correctOptionId must name one of the options");
          correctOptionId = q.correctOptionId;
        }
        return {
          id: localId(q.id, qp, questionIds, () => `q${qi + 1}`),
          question: text(q.question, `${qp}.question`, 2000),
          options,
          correctOptionId,
          explanation: optionalText(q.explanation, `${qp}.explanation`, 5000),
        };
      });
      return { id, type: "exercise", prompt: text(block.prompt, `${path}.prompt`, 2000), questions };
    }
    case "audio":
      allowedKeys(block, ["id", "type", "title", "url", "transcript"], path);
      return { id, type: "audio", title: text(block.title, `${path}.title`, 200), url: url(block.url, `${path}.url`), transcript: optionalText(block.transcript, `${path}.transcript`) };
    case "image":
      allowedKeys(block, ["id", "type", "url", "alt", "caption"], path);
      return { id, type: "image", url: url(block.url, `${path}.url`), alt: text(block.alt, `${path}.alt`, 500), caption: optionalText(block.caption, `${path}.caption`, 1000) };
    case "teacher_note":
      allowedKeys(block, ["id", "type", "text"], path);
      return { id, type: "teacher_note", text: text(block.text, `${path}.text`) };
    case "divider":
      allowedKeys(block, ["id", "type"], path);
      return { id, type: "divider" };
  }
}

/** Validates editor input. Existing block ids are kept; blocks without an id get a new one. */
export function parseLessonContent(input: unknown, generate: IdGenerator = defaultIdGenerator): LessonContent {
  if (!input || typeof input !== "object" || !Array.isArray((input as { blocks?: unknown }).blocks)) {
    throw new DomainError("VALIDATION", "Lesson content must contain a list of blocks.");
  }
  const rawBlocks = (input as { blocks: unknown[] }).blocks;
  if (rawBlocks.length > MAX_BLOCKS) throw new DomainError("VALIDATION", `A lesson can have at most ${MAX_BLOCKS} blocks.`);
  const ids = new Set<string>();
  const blocks = rawBlocks.map((raw, index) => parseBlock(raw, index, ids, generate));
  const content: LessonContent = { blocks };
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) {
    throw new DomainError("VALIDATION", "This lesson is too large. Split it into smaller lessons.");
  }
  return content;
}

/** Reads stored content defensively: stored data is re-validated, never trusted. */
export function readStoredContent(stored: unknown): LessonContent {
  const content = typeof stored === "string" ? JSON.parse(stored) : stored;
  return parseLessonContent(content, () => {
    throw new Error("Stored lesson content is missing a block id.");
  });
}

export function blockIdsOf(content: LessonContent): Set<string> {
  return new Set(content.blocks.map((block) => block.id));
}

export function hasTeachingContent(content: LessonContent): boolean {
  return content.blocks.some((block) => block.type !== "divider" && block.type !== "teacher_note");
}

export type ContentAudience = "learner" | "teacher" | "admin";

/** The projection of canonical content an audience may receive. */
export function projectContent(content: LessonContent, audience: ContentAudience): LessonContent {
  if (audience !== "learner") return content;
  const blocks = content.blocks
    .filter((block) => block.type !== "teacher_note")
    .map((block): LessonBlock => {
      if (block.type !== "exercise") return block;
      return {
        ...block,
        questions: block.questions.map((question) => ({ ...question, correctOptionId: null, explanation: null })),
      };
    });
  return { blocks };
}

/** Text of a block that annotations may anchor into (null when a block has no single text). */
export function anchorTextOf(block: LessonBlock): string | null {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "arabic_text":
    case "example":
    case "teacher_note":
      return block.text;
    default:
      return null;
  }
}
