/**
 * Course reading resources and reading progress.
 *
 * A course (optionally a specific lesson of its curriculum) can link library
 * books as required or recommended reading, whole or as a page range. Links
 * are removed, never deleted, so reading history stays explainable.
 *
 * Reading progress (where a reader left off) is private to the reader.
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseOptionalUuid, parseUid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { assertRevision, parseOptionalInt, parseOptionalText, parseRequiredRevision } from "../domain/text.ts";
import { assertVisible } from "../governance/soft-delete.ts";
import type { CourseRecord, Planned, StructureContext } from "../structure/catalog.ts";
import type { BookRecord } from "./access.ts";

export const RESOURCE_PURPOSES = ["required", "recommended"] as const;
export type ResourcePurpose = (typeof RESOURCE_PURPOSES)[number];

export interface CourseResourceRecord {
  readonly id: string;
  readonly courseId: string;
  readonly lessonId: string | null;
  readonly libraryBookId: string;
  readonly purpose: ResourcePurpose;
  readonly pagesFrom: number | null;
  readonly pagesTo: number | null;
  readonly note: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly removedAt: string | null;
  readonly removedBy: string | null;
  readonly removeReason: string | null;
}

export interface AddResourceInput {
  readonly course: CourseRecord;
  readonly book: BookRecord | null;
  /** Lesson ids of the course's curriculum (any version), to validate `lessonId`. */
  readonly courseLessonIds: ReadonlySet<string>;
  readonly existing: readonly CourseResourceRecord[];
  readonly libraryBookId: unknown;
  readonly lessonId?: unknown;
  readonly purpose: unknown;
  readonly pagesFrom?: unknown;
  readonly pagesTo?: unknown;
  readonly note?: unknown;
}

export function planAddCourseResource(input: AddResourceInput, ctx: StructureContext): Planned<CourseResourceRecord> {
  assertVisible(input.course);
  const libraryBookId = parseUuid(input.libraryBookId, "libraryBookId");
  if (!input.book || input.book.id !== libraryBookId) throw new DomainError("NOT_FOUND", "Book not found.");
  if (!input.book.isPublished) throw new DomainError("CONFLICT", "Only published library books can be linked to a course.");
  const lessonId = parseOptionalUuid(input.lessonId, "lessonId");
  if (lessonId !== null && !input.courseLessonIds.has(lessonId)) {
    throw new DomainError("VALIDATION", "This lesson is not part of the course's curriculum.");
  }
  if (typeof input.purpose !== "string" || !(RESOURCE_PURPOSES as readonly string[]).includes(input.purpose)) {
    throw new DomainError("VALIDATION", "purpose must be required or recommended.");
  }
  const pagesFrom = parseOptionalInt(input.pagesFrom, "pagesFrom", 1, 100_000);
  const pagesTo = parseOptionalInt(input.pagesTo, "pagesTo", 1, 100_000);
  if ((pagesFrom === null) !== (pagesTo === null)) throw new DomainError("VALIDATION", "Give both pagesFrom and pagesTo, or neither.");
  if (pagesFrom !== null && pagesTo !== null) {
    if (pagesTo < pagesFrom) throw new DomainError("VALIDATION", "pagesTo cannot be before pagesFrom.");
    if (input.book.pagesCount !== null && input.book.pagesCount > 0 && pagesTo > input.book.pagesCount) {
      throw new DomainError("VALIDATION", "The page range is beyond the end of the book.");
    }
  }
  const duplicate = input.existing.some(
    (r) => r.removedAt === null && r.libraryBookId === libraryBookId && r.lessonId === lessonId && r.pagesFrom === pagesFrom && r.pagesTo === pagesTo,
  );
  if (duplicate) throw new DomainError("CONFLICT", "This reading is already linked.");

  const record: CourseResourceRecord = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    courseId: input.course.id,
    lessonId,
    libraryBookId,
    purpose: input.purpose as ResourcePurpose,
    pagesFrom,
    pagesTo,
    note: parseOptionalText(input.note, "note", 2000),
    revision: 1,
    createdBy: parseUid(ctx.actor.uid, "actor"),
    createdAt: toIso((ctx.clock ?? systemClock)()),
    removedAt: null,
    removedBy: null,
    removeReason: null,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "course_resource.add",
      object: { kind: "library_resource", id: record.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [{ change: "linked", relationship: "course_reading", from: { kind: "course", id: record.courseId }, to: { kind: "library_resource", id: record.id } }],
      metadata: { libraryBookId, lessonId, purpose: record.purpose, pagesFrom, pagesTo },
    },
  };
}

export function planRemoveCourseResource(
  resource: CourseResourceRecord,
  input: { readonly reason: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): { readonly record: CourseResourceRecord; readonly audit: AuditEventInput } {
  assertRevision(resource.revision, parseRequiredRevision(input.expectedRevision));
  if (resource.removedAt !== null) throw new DomainError("CONFLICT", "This reading has already been removed.");
  const reason = requireReason(input.reason);
  const record: CourseResourceRecord = Object.freeze({
    ...resource,
    revision: resource.revision + 1,
    removedAt: toIso((ctx.clock ?? systemClock)()),
    removedBy: parseUid(ctx.actor.uid, "actor"),
    removeReason: reason,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "course_resource.remove",
      object: { kind: "library_resource", id: resource.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [{ change: "unlinked", relationship: "course_reading", from: { kind: "course", id: resource.courseId }, to: { kind: "library_resource", id: resource.id } }],
      metadata: { libraryBookId: resource.libraryBookId },
    },
  };
}

export interface ReadingProgressRecord {
  readonly userUid: string;
  readonly libraryBookId: string;
  readonly lastPage: number;
  readonly updatedAt: string;
}

export function planReadingProgress(
  input: { readonly userUid: string; readonly libraryBookId: string; readonly lastPage: unknown; readonly pageAllowed: (page: number) => boolean },
  ctx: { readonly clock?: StructureContext["clock"] },
): ReadingProgressRecord {
  const lastPage = parseOptionalInt(input.lastPage, "lastPage", 1, 100_000);
  if (lastPage === null) throw new DomainError("VALIDATION", "lastPage is required.");
  if (!input.pageAllowed(lastPage)) throw new DomainError("VALIDATION", "That page is outside the pages you can read.");
  return Object.freeze({
    userUid: parseUid(input.userUid, "user"),
    libraryBookId: input.libraryBookId,
    lastPage,
    updatedAt: toIso((ctx.clock ?? systemClock)()),
  });
}
