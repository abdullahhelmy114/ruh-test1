/**
 * Private annotations on Lesson Sheets (highlights and notes).
 *
 * Annotations are never canonical content. They belong to exactly one person
 * and nobody else can read or change them, whatever their role
 * (permissions: annotation.read / annotation.modify are owner-only).
 *
 * An annotation is anchored to a block id of the script version it was made
 * on, plus an optional character range and a short quote used to re-anchor
 * it. Block ids are stable across versions, so an annotation follows its
 * block into newer versions; when a block is removed, the annotation is
 * reported as orphaned instead of disappearing.
 *
 * Annotations are personal study data, not governance changes: they are not
 * written to the audit trail, which keeps private note text out of it.
 */
import { DomainError } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, parseUuid, systemClock, toIso, type Clock, type IdGenerator } from "../domain/ids.ts";
import { assertRevision, parseRequiredRevision } from "../domain/text.ts";
import { anchorTextOf, type LessonContent } from "./content.ts";

export const ANNOTATION_KINDS = ["highlight", "note"] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];

export const ANNOTATION_COLORS = ["yellow", "green", "blue", "pink", "purple"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export const MAX_NOTE_LENGTH = 5000;
export const MAX_QUOTE_LENGTH = 500;
export const MAX_ANNOTATIONS_PER_SCRIPT = 1000;

export interface AnnotationRange {
  readonly start: number;
  readonly end: number;
}

export interface AnnotationRecord {
  readonly id: string;
  readonly ownerUid: string;
  readonly lessonScriptId: string;
  readonly scriptVersionId: string;
  readonly classGroupId: string | null;
  readonly blockId: string;
  readonly range: AnnotationRange | null;
  readonly quote: string | null;
  readonly kind: AnnotationKind;
  readonly color: AnnotationColor;
  readonly body: string | null;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface AnnotationContext {
  readonly ownerUid: string;
  readonly clock?: Clock;
  readonly newId?: IdGenerator;
}

function parseKind(value: unknown): AnnotationKind {
  if (typeof value !== "string" || !(ANNOTATION_KINDS as readonly string[]).includes(value)) {
    throw new DomainError("VALIDATION", "kind must be highlight or note.");
  }
  return value as AnnotationKind;
}

function parseColor(value: unknown): AnnotationColor {
  if (value === undefined || value === null) return "yellow";
  if (typeof value !== "string" || !(ANNOTATION_COLORS as readonly string[]).includes(value)) {
    throw new DomainError("VALIDATION", `color must be one of ${ANNOTATION_COLORS.join(", ")}.`);
  }
  return value as AnnotationColor;
}

function parseBody(kind: AnnotationKind, value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    if (kind === "note") throw new DomainError("VALIDATION", "A note needs text.");
    return null;
  }
  if (typeof value !== "string") throw new DomainError("VALIDATION", "The note must be text.");
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (kind === "note") throw new DomainError("VALIDATION", "A note needs text.");
    return null;
  }
  if (trimmed.length > MAX_NOTE_LENGTH) throw new DomainError("VALIDATION", `A note can have at most ${MAX_NOTE_LENGTH} characters.`);
  return trimmed;
}

function parseRange(value: unknown, blockText: string | null): AnnotationRange | null {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object") throw new DomainError("VALIDATION", "range must be an object.");
  const { start, end } = value as { start?: unknown; end?: unknown };
  if (!Number.isInteger(start) || !Number.isInteger(end)) throw new DomainError("VALIDATION", "range needs whole-number start and end.");
  const s = start as number;
  const e = end as number;
  if (blockText === null) throw new DomainError("VALIDATION", "This block does not support text ranges.");
  if (s < 0 || e <= s || e > blockText.length) throw new DomainError("VALIDATION", "range is outside the block text.");
  return { start: s, end: e };
}

export interface CreateAnnotationInput {
  readonly lessonScriptId: string;
  readonly scriptVersionId: string;
  readonly classGroupId: string | null;
  /** The (projected) content the owner is looking at: annotations can only target blocks they can see. */
  readonly visibleContent: LessonContent;
  readonly existingCount: number;
  readonly blockId: unknown;
  readonly range?: unknown;
  readonly kind: unknown;
  readonly color?: unknown;
  readonly body?: unknown;
}

export function planCreateAnnotation(input: CreateAnnotationInput, ctx: AnnotationContext): AnnotationRecord {
  const ownerUid = parseUid(ctx.ownerUid, "owner");
  if (input.existingCount >= MAX_ANNOTATIONS_PER_SCRIPT) {
    throw new DomainError("CONFLICT", "You have reached the annotation limit for this lesson.");
  }
  const blockId = parseUuid(input.blockId, "blockId");
  const block = input.visibleContent.blocks.find((b) => b.id === blockId);
  if (!block) throw new DomainError("VALIDATION", "This block is not part of the lesson you are reading.");
  const blockText = anchorTextOf(block);
  const range = parseRange(input.range, blockText);
  const kind = parseKind(input.kind);
  const now = toIso((ctx.clock ?? systemClock)());
  return Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    ownerUid,
    lessonScriptId: input.lessonScriptId,
    scriptVersionId: input.scriptVersionId,
    classGroupId: input.classGroupId,
    blockId,
    range,
    quote: range && blockText ? blockText.slice(range.start, range.end).slice(0, MAX_QUOTE_LENGTH) : null,
    kind,
    color: parseColor(input.color),
    body: parseBody(kind, input.body),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

function assertOwnedAndLive(record: AnnotationRecord, ownerUid: string): void {
  // Someone else's annotation is reported exactly like a missing one.
  if (record.ownerUid !== ownerUid || record.deletedAt !== null) throw new DomainError("NOT_FOUND", "Annotation not found.");
}

export function planUpdateAnnotation(
  record: AnnotationRecord,
  input: { readonly kind?: unknown; readonly color?: unknown; readonly body?: unknown; readonly expectedRevision: unknown },
  ctx: AnnotationContext,
): AnnotationRecord {
  assertOwnedAndLive(record, parseUid(ctx.ownerUid, "owner"));
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  const kind = input.kind === undefined ? record.kind : parseKind(input.kind);
  const color = input.color === undefined ? record.color : parseColor(input.color);
  const body = input.body === undefined && kind === record.kind ? record.body : parseBody(kind, input.body === undefined ? record.body : input.body);
  return Object.freeze({
    ...record,
    kind,
    color,
    body,
    revision: record.revision + 1,
    updatedAt: toIso((ctx.clock ?? systemClock)()),
  });
}

export function planDeleteAnnotation(record: AnnotationRecord, input: { readonly expectedRevision: unknown }, ctx: AnnotationContext): AnnotationRecord {
  assertOwnedAndLive(record, parseUid(ctx.ownerUid, "owner"));
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  const now = toIso((ctx.clock ?? systemClock)());
  return Object.freeze({ ...record, revision: record.revision + 1, updatedAt: now, deletedAt: now });
}

export interface AnnotationView extends AnnotationRecord {
  /** True when the annotated block no longer exists in the content being shown. */
  readonly orphaned: boolean;
}

export function withAnchorStatus(records: readonly AnnotationRecord[], shownContent: LessonContent): AnnotationView[] {
  const ids = new Set(shownContent.blocks.map((block) => block.id));
  return records.filter((r) => r.deletedAt === null).map((r) => Object.freeze({ ...r, orphaned: !ids.has(r.blockId) }));
}
