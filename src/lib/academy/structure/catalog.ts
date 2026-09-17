/**
 * Programs and courses.
 *
 * A Program groups Courses and is the middle level of policy inheritance
 * (ACADEMY -> PROGRAM -> COURSE). A Course is the academic offering; it is
 * never a class group (a delivery of the course) and never a session.
 *
 * A course may link to the legacy public catalog row (`course.id`) so the
 * existing storefront keeps working; that link is informational and never
 * grants access by itself.
 *
 * All functions are pure planners: they validate, return the next record and
 * the audit input, and leave persistence to the caller.
 */
import type { AuditActor, AuditEventInput } from "../audit/audit.ts";
import { DomainError, optionalReason, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseOptionalUuid, parseUid, systemClock, toIso, type Clock, type IdGenerator } from "../domain/ids.ts";
import { CATALOG_MACHINE, assertTransition, parseState, type CatalogState } from "../domain/states.ts";
import { assertRevision, parseOptionalText, parseRequiredRevision, parseSlug, parseTitle } from "../domain/text.ts";
import { assertVisible, type SoftDeletable } from "../governance/soft-delete.ts";

export interface StructureContext {
  readonly actor: AuditActor;
  readonly clock?: Clock;
  readonly newId?: IdGenerator;
  readonly correlationId?: string | null;
}

export interface ProgramRecord extends SoftDeletable {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: CatalogState;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface CourseRecord extends SoftDeletable {
  readonly id: string;
  readonly programId: string | null;
  readonly catalogCourseId: string | null;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: CatalogState;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface CurriculumRecord {
  readonly id: string;
  readonly courseId: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface Planned<T> {
  readonly record: T;
  readonly audit: AuditEventInput;
}

function now(ctx: StructureContext): string {
  return toIso((ctx.clock ?? systemClock)());
}

function newId(ctx: StructureContext): string {
  return (ctx.newId ?? defaultIdGenerator)();
}

function baseAudit(ctx: StructureContext): Pick<AuditEventInput, "actor" | "correlationId"> {
  return { actor: ctx.actor, correlationId: ctx.correlationId ?? null };
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export function planCreateProgram(
  input: { readonly slug: unknown; readonly title: unknown; readonly description?: unknown },
  ctx: StructureContext,
): Planned<ProgramRecord> {
  const actorUid = parseUid(ctx.actor.uid, "actor");
  const at = now(ctx);
  const record: ProgramRecord = Object.freeze({
    id: newId(ctx),
    slug: parseSlug(input.slug),
    title: parseTitle(input.title, "title"),
    description: parseOptionalText(input.description, "description"),
    status: CATALOG_MACHINE.initial,
    revision: 1,
    createdBy: actorUid,
    createdAt: at,
    updatedBy: actorUid,
    updatedAt: at,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
  });
  return {
    record,
    audit: {
      ...baseAudit(ctx),
      action: "program.create",
      object: { kind: "program", id: record.id },
      metadata: { slug: record.slug, title: record.title },
    },
  };
}

export interface CatalogUpdateInput {
  readonly title?: unknown;
  readonly description?: unknown;
  readonly expectedRevision: unknown;
}

function applyTextUpdates<T extends { readonly title: string; readonly description: string | null }>(
  record: T,
  input: CatalogUpdateInput,
): { next: { title: string; description: string | null }; changed: string[] } {
  const next = { title: record.title, description: record.description };
  const changed: string[] = [];
  if (input.title !== undefined) {
    const title = parseTitle(input.title, "title");
    if (title !== record.title) {
      next.title = title;
      changed.push("title");
    }
  }
  if (input.description !== undefined) {
    const description = parseOptionalText(input.description, "description");
    if (description !== record.description) {
      next.description = description;
      changed.push("description");
    }
  }
  return { next, changed };
}

export function planUpdateProgram(record: ProgramRecord, input: CatalogUpdateInput, ctx: StructureContext): Planned<ProgramRecord> {
  assertVisible(record);
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  const { next, changed } = applyTextUpdates(record, input);
  if (changed.length === 0) throw new DomainError("VALIDATION", "Nothing to change.");
  const updated: ProgramRecord = Object.freeze({
    ...record,
    ...next,
    revision: record.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: now(ctx),
  });
  return {
    record: updated,
    audit: {
      ...baseAudit(ctx),
      action: "program.update",
      object: { kind: "program", id: record.id },
      metadata: { changed, revision: updated.revision },
    },
  };
}

export interface StatusChangeInput {
  readonly to: unknown;
  readonly reason?: unknown;
  readonly expectedRevision: unknown;
}

export function planProgramStatus(record: ProgramRecord, input: StatusChangeInput, ctx: StructureContext): Planned<ProgramRecord> {
  assertVisible(record);
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  const to = parseState(CATALOG_MACHINE, input.to);
  assertTransition(CATALOG_MACHINE, record.status, to);
  const reason = to === "retired" ? requireReason(input.reason) : optionalReason(input.reason);
  const updated: ProgramRecord = Object.freeze({
    ...record,
    status: to,
    revision: record.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: now(ctx),
  });
  return {
    record: updated,
    audit: {
      ...baseAudit(ctx),
      action: "program.change_status",
      object: { kind: "program", id: record.id },
      reason,
      metadata: { from: record.status, to, revision: updated.revision },
    },
  };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

function assertProgramAcceptsCourses(program: ProgramRecord | null, programId: string | null): void {
  if (programId === null) return;
  if (!program || program.id !== programId) throw new DomainError("NOT_FOUND", "Program not found.");
  assertVisible(program);
  if (program.status === "retired") {
    throw new DomainError("CONFLICT", "A retired program cannot receive courses.");
  }
}

export interface CreateCourseInput {
  readonly programId?: unknown;
  /** The program record loaded for `programId` (null when none was given or found). */
  readonly program: ProgramRecord | null;
  readonly catalogCourseId?: unknown;
  readonly slug: unknown;
  readonly title: unknown;
  readonly description?: unknown;
}

/** Creates a course together with its (single) curriculum. */
export function planCreateCourse(
  input: CreateCourseInput,
  ctx: StructureContext,
): Planned<CourseRecord> & { readonly curriculum: CurriculumRecord } {
  const actorUid = parseUid(ctx.actor.uid, "actor");
  const programId = parseOptionalUuid(input.programId, "programId");
  assertProgramAcceptsCourses(input.program, programId);
  const at = now(ctx);
  const record: CourseRecord = Object.freeze({
    id: newId(ctx),
    programId,
    catalogCourseId: parseOptionalUuid(input.catalogCourseId, "catalogCourseId"),
    slug: parseSlug(input.slug),
    title: parseTitle(input.title, "title"),
    description: parseOptionalText(input.description, "description"),
    status: CATALOG_MACHINE.initial,
    revision: 1,
    createdBy: actorUid,
    createdAt: at,
    updatedBy: actorUid,
    updatedAt: at,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
  });
  const curriculum: CurriculumRecord = Object.freeze({ id: newId(ctx), courseId: record.id, createdBy: actorUid, createdAt: at });
  return {
    record,
    curriculum,
    audit: {
      ...baseAudit(ctx),
      action: "course.create",
      object: { kind: "course", id: record.id },
      changedRelationships: programId
        ? [{ change: "linked", relationship: "program_courses", from: { kind: "program", id: programId }, to: { kind: "course", id: record.id } }]
        : [],
      metadata: { slug: record.slug, title: record.title, curriculumId: curriculum.id, catalogCourseId: record.catalogCourseId },
    },
  };
}

export function planUpdateCourse(record: CourseRecord, input: CatalogUpdateInput, ctx: StructureContext): Planned<CourseRecord> {
  assertVisible(record);
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  const { next, changed } = applyTextUpdates(record, input);
  if (changed.length === 0) throw new DomainError("VALIDATION", "Nothing to change.");
  const updated: CourseRecord = Object.freeze({
    ...record,
    ...next,
    revision: record.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: now(ctx),
  });
  return {
    record: updated,
    audit: {
      ...baseAudit(ctx),
      action: "course.update",
      object: { kind: "course", id: record.id },
      metadata: { changed, revision: updated.revision },
    },
  };
}

export function planCourseStatus(record: CourseRecord, input: StatusChangeInput, ctx: StructureContext): Planned<CourseRecord> {
  assertVisible(record);
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  const to = parseState(CATALOG_MACHINE, input.to);
  assertTransition(CATALOG_MACHINE, record.status, to);
  const reason = to === "retired" ? requireReason(input.reason) : optionalReason(input.reason);
  const updated: CourseRecord = Object.freeze({
    ...record,
    status: to,
    revision: record.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: now(ctx),
  });
  return {
    record: updated,
    audit: {
      ...baseAudit(ctx),
      action: "course.change_status",
      object: { kind: "course", id: record.id },
      reason,
      metadata: { from: record.status, to, revision: updated.revision },
    },
  };
}

/**
 * Moving a course to another program changes which program-level policy
 * overrides apply to it, so it is high impact and always needs a reason.
 */
export function planMoveCourse(
  record: CourseRecord,
  input: { readonly programId: unknown; readonly program: ProgramRecord | null; readonly reason: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<CourseRecord> {
  assertVisible(record);
  assertRevision(record.revision, parseRequiredRevision(input.expectedRevision));
  const programId = parseOptionalUuid(input.programId, "programId");
  if (programId === record.programId) throw new DomainError("VALIDATION", "The course is already in that program.");
  assertProgramAcceptsCourses(input.program, programId);
  const reason = requireReason(input.reason);
  const updated: CourseRecord = Object.freeze({
    ...record,
    programId,
    revision: record.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: now(ctx),
  });
  const relationships: NonNullable<AuditEventInput["changedRelationships"]>[number][] = [];
  if (record.programId) {
    relationships.push({ change: "unlinked", relationship: "program_courses", from: { kind: "program", id: record.programId }, to: { kind: "course", id: record.id } });
  }
  if (programId) {
    relationships.push({ change: "linked", relationship: "program_courses", from: { kind: "program", id: programId }, to: { kind: "course", id: record.id } });
  }
  return {
    record: updated,
    audit: {
      ...baseAudit(ctx),
      action: "course.move_program",
      object: { kind: "course", id: record.id },
      reason,
      changedRelationships: relationships,
      metadata: { fromProgramId: record.programId, toProgramId: programId, revision: updated.revision },
    },
  };
}
