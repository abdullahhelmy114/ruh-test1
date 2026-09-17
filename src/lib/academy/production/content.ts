/**
 * 2C production content: activities, stories, adventures, games and media.
 *
 * Every kind is validated strictly and stored as plain data (no HTML).
 * Activities and games embed items of the single assessment engine and use
 * its objective grading; only objective item types are allowed, so practice
 * results never wait for a person. Learners receive a projection without
 * answer keys.
 *
 * Provenance records where content came from, who made it and its rights
 * status. Nothing here executes external tools: an "assisted_generation"
 * origin is a record that a tool was used, entered by a person.
 */
import { DomainError } from "../domain/errors.ts";
import { parseOptionalHttpsUrl } from "../domain/text.ts";
import { isObjective, parseAssessmentContent, projectForLearner, type AssessmentContent, type AssessmentItem } from "../assessment/content.ts";

export const CONTENT_KINDS = ["activity", "story", "adventure", "game", "media"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && (CONTENT_KINDS as readonly string[]).includes(value);
}

/** Kinds that learners can complete and receive a score for. */
export const SCORED_KINDS: readonly ContentKind[] = ["activity", "game"];

const LOCAL_ID = /^[A-Za-z0-9_-]{1,64}$/;

function fail(path: string, message: string): never {
  throw new DomainError("VALIDATION", `${path}: ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value as Record<string, unknown>;
}

function only(raw: Record<string, unknown>, keys: readonly string[], path: string): void {
  for (const key of Object.keys(raw)) if (!keys.includes(key)) fail(path, `unexpected field "${key}"`);
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== "string") fail(path, "must be text");
  const trimmed = value.replace(/\r\n?/g, "\n").trim();
  if (trimmed.length === 0) fail(path, "must not be empty");
  if (trimmed.length > max) fail(path, `must be at most ${max} characters`);
  return trimmed;
}

function optionalText(value: unknown, path: string, max: number): string | null {
  return value === undefined || value === null || value === "" ? null : text(value, path, max);
}

function list(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, `must list ${min} to ${max} entries`);
  return value;
}

function localId(value: unknown, path: string, seen: Set<string>): string {
  if (typeof value !== "string" || !LOCAL_ID.test(value)) fail(path, "id must be 1-64 letters, digits, hyphens or underscores");
  if (seen.has(value)) fail(path, "id is used twice");
  seen.add(value);
  return value;
}

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

export interface ActivityContent {
  readonly instructions: string | null;
  readonly items: readonly AssessmentItem[];
}

export interface StoryPage {
  readonly id: string;
  readonly text: string;
  readonly translation: string | null;
  readonly mediaItemId: string | null;
}

export interface StoryContent {
  readonly pages: readonly StoryPage[];
}

export interface AdventureScene {
  readonly id: string;
  readonly text: string;
  readonly ending: boolean;
  readonly choices: readonly { readonly id: string; readonly label: string; readonly targetSceneId: string }[];
}

export interface AdventureContent {
  readonly startSceneId: string;
  readonly scenes: readonly AdventureScene[];
}

export const GAME_TYPES = ["matching_pairs", "memory", "word_order_race", "quiz_race"] as const;
export type GameType = (typeof GAME_TYPES)[number];

const GAME_ITEM_TYPES: Readonly<Record<GameType, readonly AssessmentItem["type"][]>> = {
  matching_pairs: ["matching"],
  memory: ["matching"],
  word_order_race: ["word_order"],
  quiz_race: ["choice", "true_false", "fill_blank", "listening"],
};

export interface GameContent {
  readonly gameType: GameType;
  readonly timeLimitSeconds: number | null;
  readonly items: readonly AssessmentItem[];
}

export const MEDIA_TYPES = ["image", "audio", "video", "document"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export interface MediaContent {
  readonly mediaType: MediaType;
  readonly url: string;
  readonly altText: string | null;
  readonly transcript: string | null;
  readonly durationSeconds: number | null;
}

export type ProductionContent = ActivityContent | StoryContent | AdventureContent | GameContent | MediaContent;

function objectiveItems(raw: unknown, path: string): AssessmentContent {
  const parsed = parseAssessmentContent(raw);
  if (parsed.items.length === 0) fail(path, "add at least one item");
  for (const item of parsed.items) {
    if (!isObjective(item)) fail(`${path}.${item.id}`, "practice content can only use automatically graded item types");
  }
  return parsed;
}

function parseActivity(raw: Record<string, unknown>): ActivityContent {
  only(raw, ["instructions", "items"], "content");
  const parsed = objectiveItems({ instructions: raw.instructions, items: raw.items }, "content.items");
  return { instructions: parsed.instructions, items: parsed.items };
}

function parseStory(raw: Record<string, unknown>): StoryContent {
  only(raw, ["pages"], "content");
  const ids = new Set<string>();
  const pages = list(raw.pages, "content.pages", 1, 200).map((entry, i) => {
    const path = `content.pages[${i}]`;
    const page = object(entry, path);
    only(page, ["id", "text", "translation", "mediaItemId"], path);
    let mediaItemId: string | null = null;
    if (page.mediaItemId !== undefined && page.mediaItemId !== null) {
      if (typeof page.mediaItemId !== "string" || !/^[0-9a-f-]{36}$/i.test(page.mediaItemId)) fail(path, "mediaItemId must be a valid identifier");
      mediaItemId = page.mediaItemId.toLowerCase();
    }
    return {
      id: localId(page.id, path, ids),
      text: text(page.text, `${path}.text`, 10_000),
      translation: optionalText(page.translation, `${path}.translation`, 10_000),
      mediaItemId,
    };
  });
  return { pages };
}

function parseAdventure(raw: Record<string, unknown>): AdventureContent {
  only(raw, ["startSceneId", "scenes"], "content");
  const ids = new Set<string>();
  const scenes = list(raw.scenes, "content.scenes", 2, 300).map((entry, i) => {
    const path = `content.scenes[${i}]`;
    const scene = object(entry, path);
    only(scene, ["id", "text", "ending", "choices"], path);
    if (typeof scene.ending !== "boolean") fail(path, "ending must be true or false");
    const choiceIds = new Set<string>();
    const choices = scene.choices === undefined ? [] : list(scene.choices, `${path}.choices`, 0, 6).map((c, j) => {
      const cp = `${path}.choices[${j}]`;
      const choice = object(c, cp);
      only(choice, ["id", "label", "targetSceneId"], cp);
      if (typeof choice.targetSceneId !== "string") fail(cp, "targetSceneId is required");
      return { id: localId(choice.id, cp, choiceIds), label: text(choice.label, `${cp}.label`, 300), targetSceneId: choice.targetSceneId };
    });
    if (scene.ending && choices.length > 0) fail(path, "an ending scene has no choices");
    if (!scene.ending && choices.length === 0) fail(path, "a scene that is not an ending needs at least one choice");
    return { id: localId(scene.id, path, ids), text: text(scene.text, `${path}.text`, 10_000), ending: scene.ending, choices };
  });
  if (typeof raw.startSceneId !== "string" || !ids.has(raw.startSceneId)) fail("content.startSceneId", "must name one of the scenes");
  for (const scene of scenes) {
    for (const choice of scene.choices) {
      if (!ids.has(choice.targetSceneId)) fail(`content.scenes.${scene.id}`, `choice "${choice.id}" leads to a missing scene`);
    }
  }
  // Every scene must be reachable from the start, and at least one ending must be reachable.
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const reached = new Set<string>([raw.startSceneId]);
  const queue = [raw.startSceneId];
  while (queue.length > 0) {
    const scene = byId.get(queue.shift() as string) as AdventureScene;
    for (const choice of scene.choices) {
      if (!reached.has(choice.targetSceneId)) {
        reached.add(choice.targetSceneId);
        queue.push(choice.targetSceneId);
      }
    }
  }
  const unreachable = scenes.filter((scene) => !reached.has(scene.id));
  if (unreachable.length > 0) fail("content.scenes", `scene "${unreachable[0].id}" cannot be reached from the start`);
  if (!scenes.some((scene) => scene.ending)) fail("content.scenes", "add at least one ending");
  return { startSceneId: raw.startSceneId, scenes };
}

function parseGame(raw: Record<string, unknown>): GameContent {
  only(raw, ["gameType", "timeLimitSeconds", "items"], "content");
  if (typeof raw.gameType !== "string" || !(GAME_TYPES as readonly string[]).includes(raw.gameType)) {
    fail("content.gameType", `must be one of ${GAME_TYPES.join(", ")}`);
  }
  const gameType = raw.gameType as GameType;
  let timeLimitSeconds: number | null = null;
  if (raw.timeLimitSeconds !== undefined && raw.timeLimitSeconds !== null) {
    if (!Number.isInteger(raw.timeLimitSeconds) || (raw.timeLimitSeconds as number) < 10 || (raw.timeLimitSeconds as number) > 3600) {
      fail("content.timeLimitSeconds", "must be a whole number from 10 to 3600");
    }
    timeLimitSeconds = raw.timeLimitSeconds as number;
  }
  const parsed = objectiveItems({ items: raw.items }, "content.items");
  for (const item of parsed.items) {
    if (!GAME_ITEM_TYPES[gameType].includes(item.type)) fail(`content.items.${item.id}`, `a ${gameType} game cannot use ${item.type} items`);
  }
  return { gameType, timeLimitSeconds, items: parsed.items };
}

function parseMedia(raw: Record<string, unknown>): MediaContent {
  only(raw, ["mediaType", "url", "altText", "transcript", "durationSeconds"], "content");
  if (typeof raw.mediaType !== "string" || !(MEDIA_TYPES as readonly string[]).includes(raw.mediaType)) {
    fail("content.mediaType", `must be one of ${MEDIA_TYPES.join(", ")}`);
  }
  const mediaType = raw.mediaType as MediaType;
  const url = parseOptionalHttpsUrl(raw.url, "content.url");
  if (!url) fail("content.url", "an https link is required");
  const altText = optionalText(raw.altText, "content.altText", 1000);
  if (mediaType === "image" && altText === null) fail("content.altText", "images need a text alternative");
  let durationSeconds: number | null = null;
  if (raw.durationSeconds !== undefined && raw.durationSeconds !== null) {
    if (mediaType !== "audio" && mediaType !== "video") fail("content.durationSeconds", "only audio and video have a duration");
    if (!Number.isInteger(raw.durationSeconds) || (raw.durationSeconds as number) < 1 || (raw.durationSeconds as number) > 86_400) {
      fail("content.durationSeconds", "must be a whole number of seconds up to 86400");
    }
    durationSeconds = raw.durationSeconds as number;
  }
  return { mediaType, url, altText, transcript: optionalText(raw.transcript, "content.transcript", 100_000), durationSeconds };
}

export const MAX_PRODUCTION_CONTENT_BYTES = 800_000;

export function parseProductionContent(kind: ContentKind, input: unknown): ProductionContent {
  const raw = object(input, "content");
  let parsed: ProductionContent;
  switch (kind) {
    case "activity":
      parsed = parseActivity(raw);
      break;
    case "story":
      parsed = parseStory(raw);
      break;
    case "adventure":
      parsed = parseAdventure(raw);
      break;
    case "game":
      parsed = parseGame(raw);
      break;
    case "media":
      parsed = parseMedia(raw);
      break;
  }
  if (JSON.stringify(parsed).length > MAX_PRODUCTION_CONTENT_BYTES) throw new DomainError("VALIDATION", "This content is too large.");
  return parsed;
}

/** Empty starting content for a new draft; it is not publishable until completed. */
export function isContentReady(kind: ContentKind, content: unknown): boolean {
  try {
    parseProductionContent(kind, content);
    return true;
  } catch {
    return false;
  }
}

export function scoredItemsOf(kind: ContentKind, content: ProductionContent): AssessmentContent | null {
  if (kind !== "activity" && kind !== "game") return null;
  const items = (content as ActivityContent | GameContent).items;
  return { instructions: kind === "activity" ? (content as ActivityContent).instructions : null, items };
}

/** What a learner receives: answer keys removed from scored kinds. */
export function projectProductionContent(kind: ContentKind, content: ProductionContent): unknown {
  const scored = scoredItemsOf(kind, content);
  if (!scored) return content;
  const projected = projectForLearner(scored);
  return kind === "game"
    ? { gameType: (content as GameContent).gameType, timeLimitSeconds: (content as GameContent).timeLimitSeconds, items: projected.items }
    : { instructions: projected.instructions, items: projected.items };
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export const ORIGINS = ["original", "adapted", "imported", "assisted_generation"] as const;
export type Origin = (typeof ORIGINS)[number];

export const RIGHTS_STATUSES = ["cleared", "pending", "restricted"] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const CONTRIBUTOR_ROLES = ["author", "editor", "reviewer", "translator", "narrator", "illustrator"] as const;

export interface Provenance {
  readonly origin: Origin;
  readonly sources: readonly { readonly title: string; readonly reference: string | null; readonly license: string | null }[];
  readonly contributors: readonly { readonly name: string; readonly role: (typeof CONTRIBUTOR_ROLES)[number] }[];
  readonly rightsStatus: RightsStatus;
  readonly assistedToolLabel: string | null;
  readonly notes: string | null;
}

export function parseProvenance(input: unknown): Provenance {
  const raw = object(input, "provenance");
  only(raw, ["origin", "sources", "contributors", "rightsStatus", "assistedToolLabel", "notes"], "provenance");
  if (typeof raw.origin !== "string" || !(ORIGINS as readonly string[]).includes(raw.origin)) fail("provenance.origin", `must be one of ${ORIGINS.join(", ")}`);
  const origin = raw.origin as Origin;
  if (typeof raw.rightsStatus !== "string" || !(RIGHTS_STATUSES as readonly string[]).includes(raw.rightsStatus)) {
    fail("provenance.rightsStatus", `must be one of ${RIGHTS_STATUSES.join(", ")}`);
  }
  const sources = (raw.sources === undefined ? [] : list(raw.sources, "provenance.sources", 0, 20)).map((entry, i) => {
    const path = `provenance.sources[${i}]`;
    const source = object(entry, path);
    only(source, ["title", "reference", "license"], path);
    return {
      title: text(source.title, `${path}.title`, 500),
      reference: optionalText(source.reference, `${path}.reference`, 2000),
      license: optionalText(source.license, `${path}.license`, 500),
    };
  });
  if ((origin === "adapted" || origin === "imported") && sources.length === 0) fail("provenance.sources", "adapted or imported content must name its sources");
  const contributors = list(raw.contributors, "provenance.contributors", 1, 50).map((entry, i) => {
    const path = `provenance.contributors[${i}]`;
    const contributor = object(entry, path);
    only(contributor, ["name", "role"], path);
    if (typeof contributor.role !== "string" || !(CONTRIBUTOR_ROLES as readonly string[]).includes(contributor.role)) {
      fail(`${path}.role`, `must be one of ${CONTRIBUTOR_ROLES.join(", ")}`);
    }
    return { name: text(contributor.name, `${path}.name`, 200), role: contributor.role as (typeof CONTRIBUTOR_ROLES)[number] };
  });
  const assistedToolLabel = optionalText(raw.assistedToolLabel, "provenance.assistedToolLabel", 200);
  if (origin === "assisted_generation" && assistedToolLabel === null) fail("provenance.assistedToolLabel", "name the tool that assisted");
  if (origin !== "assisted_generation" && assistedToolLabel !== null) fail("provenance.assistedToolLabel", "only assisted generation names a tool");
  if (origin === "assisted_generation" && !contributors.some((c) => c.role === "reviewer" || c.role === "editor")) {
    fail("provenance.contributors", "assisted content needs a human editor or reviewer");
  }
  return { origin, sources, contributors, rightsStatus: raw.rightsStatus as RightsStatus, assistedToolLabel, notes: optionalText(raw.notes, "provenance.notes", 5000) };
}
