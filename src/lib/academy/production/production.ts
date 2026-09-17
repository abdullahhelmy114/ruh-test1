/**
 * 2C production infrastructure: content libraries, factories, production
 * runs, content items and their links to the academic structure.
 *
 *   Library  -> a governed collection of content items (academy-wide, for a
 *               program, or for one course). There can be many.
 *   Factory  -> a registered production recipe with one output kind. It does
 *               not execute anything; people produce the content.
 *   Run      -> one tracked production job of a factory, with a guarded
 *               status (planned -> in production -> awaiting review ->
 *               completed, or cancelled).
 *   Item     -> an activity, story, adventure, game or media asset with
 *               governed versions (draft -> review -> approved -> published).
 *   Link     -> a published item attached to a course, lesson or assessment
 *               for practice, enrichment, preparation or remediation.
 *
 * Publication of a version is a human decision: it requires content,
 * provenance with rights cleared, and an approved `publication` approval
 * gate for that exact version.
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, optionalReason, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseOptionalUuid, parseUid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { PRODUCTION_RUN_MACHINE, assertTransition, parseState, type ProductionRunState } from "../domain/states.ts";
import { assertRevision, parseOptionalText, parseRequiredRevision, parseSlug, parseTitle } from "../domain/text.ts";
import { assertGateApproved, type ApprovalGate } from "../governance/approval-gates.ts";
import type { VersionRecord } from "../governance/versioning.ts";
import type { Planned, StructureContext } from "../structure/catalog.ts";
import { isContentKind, type ContentKind, type Provenance } from "./content.ts";

function at(ctx: StructureContext): string {
  return toIso((ctx.clock ?? systemClock)());
}

function newId(ctx: StructureContext): string {
  return (ctx.newId ?? defaultIdGenerator)();
}

function actor(ctx: StructureContext): string {
  return parseUid(ctx.actor.uid, "actor");
}

// ---------------------------------------------------------------------------
// Libraries
// ---------------------------------------------------------------------------

export const LIBRARY_SCOPES = ["academy", "program", "course"] as const;
export type LibraryScope = (typeof LIBRARY_SCOPES)[number];

export interface ContentLibraryRecord {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly scope: LibraryScope;
  readonly programId: string | null;
  readonly courseId: string | null;
  readonly state: "active" | "archived";
  readonly stateReason: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export function planCreateLibrary(
  input: { readonly slug: unknown; readonly title: unknown; readonly description?: unknown; readonly scope: unknown; readonly programId?: unknown; readonly courseId?: unknown },
  ctx: StructureContext,
): Planned<ContentLibraryRecord> {
  if (typeof input.scope !== "string" || !(LIBRARY_SCOPES as readonly string[]).includes(input.scope)) {
    throw new DomainError("VALIDATION", "scope must be academy, program or course.");
  }
  const scope = input.scope as LibraryScope;
  const programId = parseOptionalUuid(input.programId, "programId");
  const courseId = parseOptionalUuid(input.courseId, "courseId");
  if (scope === "academy" && (programId || courseId)) throw new DomainError("VALIDATION", "An academy library does not name a program or course.");
  if (scope === "program" && (!programId || courseId)) throw new DomainError("VALIDATION", "A program library names exactly one program.");
  if (scope === "course" && (!courseId || programId)) throw new DomainError("VALIDATION", "A course library names exactly one course.");
  const uid = actor(ctx);
  const now = at(ctx);
  const record: ContentLibraryRecord = Object.freeze({
    id: newId(ctx),
    slug: parseSlug(input.slug),
    title: parseTitle(input.title, "title"),
    description: parseOptionalText(input.description, "description"),
    scope,
    programId,
    courseId,
    state: "active",
    stateReason: null,
    revision: 1,
    createdBy: uid,
    createdAt: now,
    updatedBy: uid,
    updatedAt: now,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "content_library.create",
      object: { kind: "content_library", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { slug: record.slug, scope, programId, courseId },
    },
  };
}

export function planLibraryState(
  library: ContentLibraryRecord,
  input: { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<ContentLibraryRecord> {
  assertRevision(library.revision, parseRequiredRevision(input.expectedRevision));
  if (input.to !== "active" && input.to !== "archived") throw new DomainError("VALIDATION", "to must be active or archived.");
  if (input.to === library.state) throw new DomainError("INVALID_TRANSITION", `The library is already ${library.state}.`);
  const reason = input.to === "archived" ? requireReason(input.reason) : optionalReason(input.reason);
  const record: ContentLibraryRecord = Object.freeze({
    ...library,
    state: input.to,
    stateReason: reason,
    revision: library.revision + 1,
    updatedBy: actor(ctx),
    updatedAt: at(ctx),
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "content_library.change_state",
      object: { kind: "content_library", id: library.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { from: library.state, to: record.state },
    },
  };
}

/** Whether a library may serve a course (its own course, a course of its program, or any course). */
export function libraryServesCourse(library: ContentLibraryRecord, course: { readonly id: string; readonly programId: string | null }): boolean {
  if (library.scope === "academy") return true;
  if (library.scope === "program") return library.programId !== null && library.programId === course.programId;
  return library.courseId === course.id;
}

// ---------------------------------------------------------------------------
// Factories and runs
// ---------------------------------------------------------------------------

export interface FactoryRecord {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly description: string | null;
  readonly outputKind: ContentKind;
  readonly state: "active" | "retired";
  readonly createdBy: string;
  readonly createdAt: string;
}

export function planRegisterFactory(
  input: { readonly key: unknown; readonly title: unknown; readonly description?: unknown; readonly outputKind: unknown },
  ctx: StructureContext,
): Planned<FactoryRecord> {
  if (!isContentKind(input.outputKind)) throw new DomainError("VALIDATION", "Unknown output kind.");
  const record: FactoryRecord = Object.freeze({
    id: newId(ctx),
    key: parseSlug(input.key, "key"),
    title: parseTitle(input.title, "title"),
    description: parseOptionalText(input.description, "description"),
    outputKind: input.outputKind,
    state: "active",
    createdBy: actor(ctx),
    createdAt: at(ctx),
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "production_factory.register",
      object: { kind: "production_factory", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { key: record.key, outputKind: record.outputKind },
    },
  };
}

export interface ProductionRunRecord {
  readonly id: string;
  readonly factoryId: string;
  readonly libraryId: string;
  readonly title: string;
  readonly brief: string | null;
  readonly state: ProductionRunState;
  readonly stateReason: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export function planCreateRun(
  input: { readonly factory: FactoryRecord; readonly library: ContentLibraryRecord; readonly title: unknown; readonly brief?: unknown },
  ctx: StructureContext,
): Planned<ProductionRunRecord> {
  if (input.factory.state !== "active") throw new DomainError("CONFLICT", "This factory is retired.");
  if (input.library.state !== "active") throw new DomainError("CONFLICT", "This library is archived.");
  const uid = actor(ctx);
  const now = at(ctx);
  const record: ProductionRunRecord = Object.freeze({
    id: newId(ctx),
    factoryId: input.factory.id,
    libraryId: input.library.id,
    title: parseTitle(input.title, "title"),
    brief: parseOptionalText(input.brief, "brief", 20_000),
    state: PRODUCTION_RUN_MACHINE.initial,
    stateReason: null,
    revision: 1,
    createdBy: uid,
    createdAt: now,
    updatedBy: uid,
    updatedAt: now,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "production_run.create",
      object: { kind: "production_run", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { factoryId: record.factoryId, libraryId: record.libraryId, title: record.title },
    },
  };
}

export function planRunStatus(
  run: ProductionRunRecord,
  input: { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
  context: { readonly unresolvedItems: number; readonly items: number },
  ctx: StructureContext,
): Planned<ProductionRunRecord> {
  assertRevision(run.revision, parseRequiredRevision(input.expectedRevision));
  const to = parseState(PRODUCTION_RUN_MACHINE, input.to);
  assertTransition(PRODUCTION_RUN_MACHINE, run.state, to);
  if (to === "awaiting_review" && context.items === 0) throw new DomainError("CONFLICT", "Add at least one item before sending the run to review.");
  if (to === "completed" && context.unresolvedItems > 0) {
    throw new DomainError("CONFLICT", `${context.unresolvedItems} item(s) still have a version in progress. Publish, reject or archive them first.`);
  }
  const reason = to === "cancelled" ? requireReason(input.reason) : optionalReason(input.reason);
  const record: ProductionRunRecord = Object.freeze({
    ...run,
    state: to,
    stateReason: reason,
    revision: run.revision + 1,
    updatedBy: actor(ctx),
    updatedAt: at(ctx),
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "production_run.change_status",
      object: { kind: "production_run", id: run.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { from: run.state, to },
    },
  };
}

// ---------------------------------------------------------------------------
// Items and versions
// ---------------------------------------------------------------------------

export interface ContentItemRecord {
  readonly id: string;
  readonly libraryId: string;
  readonly kind: ContentKind;
  readonly title: string;
  readonly productionRunId: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface ContentItemVersionRecord extends VersionRecord {
  readonly revision: number;
}

export function planCreateItem(
  input: { readonly library: ContentLibraryRecord; readonly run: ProductionRunRecord | null; readonly runFactory: FactoryRecord | null; readonly kind: unknown; readonly title: unknown },
  ctx: StructureContext,
): Planned<ContentItemRecord> {
  if (!isContentKind(input.kind)) throw new DomainError("VALIDATION", "Unknown content kind.");
  if (input.library.state !== "active") throw new DomainError("CONFLICT", "This library is archived.");
  if (input.run) {
    if (input.run.libraryId !== input.library.id) throw new DomainError("VALIDATION", "The run produces content for a different library.");
    if (input.run.state !== "planned" && input.run.state !== "in_production") throw new DomainError("CONFLICT", "This run no longer accepts new items.");
    if (!input.runFactory || input.runFactory.outputKind !== input.kind) throw new DomainError("VALIDATION", "The run's factory produces a different kind of content.");
  }
  const record: ContentItemRecord = Object.freeze({
    id: newId(ctx),
    libraryId: input.library.id,
    kind: input.kind,
    title: parseTitle(input.title, "title"),
    productionRunId: input.run?.id ?? null,
    createdBy: actor(ctx),
    createdAt: at(ctx),
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "content_item.create",
      object: { kind: "content_item", id: record.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [{ change: "linked", relationship: "library_items", from: { kind: "content_library", id: record.libraryId }, to: { kind: "content_item", id: record.id } }],
      metadata: { kind: record.kind, title: record.title, productionRunId: record.productionRunId },
    },
  };
}

/**
 * The human publication gate for production content: content present,
 * provenance recorded with rights cleared, and an approved `publication`
 * approval gate for this exact version.
 */
export function assertPublishable(
  item: ContentItemRecord,
  version: ContentItemVersionRecord,
  stored: { readonly content: unknown; readonly provenance: Provenance | null },
  gates: readonly ApprovalGate[],
): void {
  if (stored.content === null || stored.content === undefined) throw new DomainError("CONFLICT", "Add content before publishing.");
  if (!stored.provenance) throw new DomainError("CONFLICT", "Record provenance before publishing.");
  if (stored.provenance.rightsStatus !== "cleared") throw new DomainError("CONFLICT", "Rights must be cleared before publishing.");
  const approved = gates.find((gate) => gate.state === "approved" && gate.type === "publication" && gate.subjectVersionId === version.id) ?? null;
  assertGateApproved(approved, { type: "publication", subject: { kind: "content_item", id: item.id }, subjectVersionId: version.id });
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export const LINK_PURPOSES = ["practice", "enrichment", "preparation", "remediation"] as const;
export type LinkPurpose = (typeof LINK_PURPOSES)[number];

export const LINK_TARGETS = ["course", "lesson", "assessment"] as const;
export type LinkTarget = (typeof LINK_TARGETS)[number];

export interface ContentLinkRecord {
  readonly id: string;
  readonly itemId: string;
  readonly courseId: string;
  readonly targetKind: LinkTarget;
  readonly targetId: string;
  readonly purpose: LinkPurpose;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly removedAt: string | null;
  readonly removedBy: string | null;
  readonly removeReason: string | null;
}

export interface AddLinkInput {
  readonly item: ContentItemRecord;
  readonly library: ContentLibraryRecord;
  readonly hasPublishedVersion: boolean;
  readonly course: { readonly id: string; readonly programId: string | null; readonly deletedAt: string | null } | null;
  /** The target's course, resolved by the caller (null when the target does not exist). */
  readonly targetCourseId: string | null;
  readonly existing: readonly ContentLinkRecord[];
  readonly targetKind: unknown;
  readonly targetId: unknown;
  readonly purpose: unknown;
}

export function planAddLink(input: AddLinkInput, ctx: StructureContext): Planned<ContentLinkRecord> {
  if (typeof input.targetKind !== "string" || !(LINK_TARGETS as readonly string[]).includes(input.targetKind)) {
    throw new DomainError("VALIDATION", "targetKind must be course, lesson or assessment.");
  }
  if (typeof input.purpose !== "string" || !(LINK_PURPOSES as readonly string[]).includes(input.purpose)) {
    throw new DomainError("VALIDATION", `purpose must be one of ${LINK_PURPOSES.join(", ")}.`);
  }
  const targetId = parseUuid(input.targetId, "targetId");
  if (!input.hasPublishedVersion) throw new DomainError("CONFLICT", "Only published content can be linked.");
  if (!input.course || input.course.deletedAt !== null || input.targetCourseId === null || input.targetCourseId !== input.course.id) {
    throw new DomainError("NOT_FOUND", "Link target not found.");
  }
  if (!libraryServesCourse(input.library, input.course)) throw new DomainError("VALIDATION", "This library does not serve that course.");
  const purpose = input.purpose as LinkPurpose;
  if (input.existing.some((l) => l.removedAt === null && l.targetKind === input.targetKind && l.targetId === targetId && l.purpose === purpose)) {
    throw new DomainError("CONFLICT", "This link already exists.");
  }
  const record: ContentLinkRecord = Object.freeze({
    id: newId(ctx),
    itemId: input.item.id,
    courseId: input.course.id,
    targetKind: input.targetKind as LinkTarget,
    targetId,
    purpose,
    revision: 1,
    createdBy: actor(ctx),
    createdAt: at(ctx),
    removedAt: null,
    removedBy: null,
    removeReason: null,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "content_link.add",
      object: { kind: "content_link", id: record.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [{ change: "linked", relationship: `content_${purpose}`, from: { kind: "content_item", id: record.itemId }, to: { kind: "course", id: record.courseId } }],
      metadata: { targetKind: record.targetKind, targetId, purpose },
    },
  };
}

export function planRemoveLink(
  link: ContentLinkRecord,
  input: { readonly reason: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): { readonly record: ContentLinkRecord; readonly audit: AuditEventInput } {
  assertRevision(link.revision, parseRequiredRevision(input.expectedRevision));
  if (link.removedAt !== null) throw new DomainError("CONFLICT", "This link has already been removed.");
  const reason = requireReason(input.reason);
  const record: ContentLinkRecord = Object.freeze({ ...link, revision: link.revision + 1, removedAt: at(ctx), removedBy: actor(ctx), removeReason: reason });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "content_link.remove",
      object: { kind: "content_link", id: link.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [{ change: "unlinked", relationship: `content_${link.purpose}`, from: { kind: "content_item", id: link.itemId }, to: { kind: "course", id: link.courseId } }],
    },
  };
}
