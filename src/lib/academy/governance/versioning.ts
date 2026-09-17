/**
 * Versioning primitives for governed academic content.
 *
 * A versioned entity (a curriculum, a lesson script, later activities and
 * assessments) owns an ordered list of versions. Rules enforced here:
 *
 *   - a version id and a version number are never reused;
 *   - content is editable only while a version is `draft` or
 *     `changes_requested`; everything else, and above all `published`, is
 *     immutable;
 *   - at most one working version (draft, in review, changes requested or
 *     approved) exists per parent, so edits cannot silently diverge;
 *   - publication is the only way a version becomes canonical, and it
 *     atomically supersedes the previously published version, which stays
 *     addressable for audit.
 *
 * All functions are pure: they return the next records plus the audit inputs
 * that the caller must persist in the same transaction.
 */
import { AuthError } from "../../auth/core.ts";
import type { AuditActor, AuditEventInput } from "../audit/audit.ts";
import { DomainError, optionalReason, requireReason } from "../domain/errors.ts";
import {
  defaultIdGenerator,
  parseUid,
  parseUuid,
  systemClock,
  toIso,
  type Clock,
  type EntityKind,
  type IdGenerator,
} from "../domain/ids.ts";
import {
  CONTENT_VERSION_MACHINE,
  MUTABLE_CONTENT_STATES,
  assertTransition,
  type ContentVersionState,
} from "../domain/states.ts";

export interface VersionRecord {
  readonly id: string;
  readonly versionKind: EntityKind;
  readonly parentKind: EntityKind;
  readonly parentId: string;
  readonly versionNumber: number;
  readonly basedOnVersionId: string | null;
  readonly state: ContentVersionState;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt: string | null;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly publishedBy: string | null;
  readonly publishedAt: string | null;
  readonly supersededAt: string | null;
  readonly archivedAt: string | null;
}

/** States in which a version is still being worked towards publication. */
export const WORKING_VERSION_STATES: readonly ContentVersionState[] = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
];

export interface VersionContext {
  readonly actor: AuditActor;
  readonly clock?: Clock;
  readonly correlationId?: string | null;
}

/**
 * Stored versions may carry extra fields (for example a `revision`). The
 * helpers below are generic so those fields survive every transition.
 */
export interface VersionChange<V extends VersionRecord = VersionRecord> {
  readonly version: V;
  readonly audit: AuditEventInput;
}

export function isContentMutable(version: Pick<VersionRecord, "state">): boolean {
  return MUTABLE_CONTENT_STATES.includes(version.state);
}

/** Throws IMMUTABLE unless the version's content may still be edited. */
export function assertContentMutable(version: Pick<VersionRecord, "state">): void {
  if (!isContentMutable(version)) {
    throw new DomainError(
      "IMMUTABLE",
      version.state === "published"
        ? "Published content cannot be changed. Create a new version instead."
        : "This version can no longer be edited.",
    );
  }
}

export function nextVersionNumber(existing: readonly Pick<VersionRecord, "versionNumber">[]): number {
  let max = 0;
  for (const version of existing) {
    if (!Number.isInteger(version.versionNumber) || version.versionNumber < 1) {
      throw new DomainError("CONFLICT", "Stored version numbering is inconsistent.");
    }
    if (version.versionNumber > max) max = version.versionNumber;
  }
  return max + 1;
}

function audit(
  ctx: VersionContext,
  action: AuditEventInput["action"],
  version: VersionRecord,
  extra: Partial<AuditEventInput> = {},
): AuditEventInput {
  return {
    actor: ctx.actor,
    action,
    object: { kind: version.versionKind, id: version.id },
    correlationId: ctx.correlationId ?? null,
    metadata: {
      parentKind: version.parentKind,
      parentId: version.parentId,
      versionNumber: version.versionNumber,
      state: version.state,
    },
    ...extra,
  };
}

export interface CreateDraftInput {
  readonly versionKind: EntityKind;
  readonly parentKind: EntityKind;
  readonly parentId: string;
  readonly existingVersions: readonly VersionRecord[];
  readonly basedOn?: VersionRecord | null;
  readonly newId?: IdGenerator;
}

/** Opens a new draft version. Refuses when a working version already exists. */
export function createDraftVersion(input: CreateDraftInput, ctx: VersionContext): VersionChange {
  const parentId = parseUuid(input.parentId, "parentId");
  const createdBy = parseUid(ctx.actor.uid, "actor");

  for (const version of input.existingVersions) {
    if (version.parentId !== parentId || version.parentKind !== input.parentKind) {
      throw new DomainError("CONFLICT", "Version history belongs to a different item.");
    }
    if (WORKING_VERSION_STATES.includes(version.state)) {
      throw new DomainError(
        "CONFLICT",
        "A version is already being prepared for this item. Finish or archive it first.",
      );
    }
  }

  const basedOn = input.basedOn ?? null;
  if (basedOn && (basedOn.parentId !== parentId || basedOn.parentKind !== input.parentKind)) {
    throw new DomainError("VALIDATION", "A new version can only be based on a version of the same item.");
  }

  const newId = input.newId ?? defaultIdGenerator;
  const now = toIso((ctx.clock ?? systemClock)());
  const id = newId();
  if (input.existingVersions.some((version) => version.id === id)) {
    throw new DomainError("CONFLICT", "Version identifiers cannot be reused.");
  }

  const version: VersionRecord = Object.freeze({
    id,
    versionKind: input.versionKind,
    parentKind: input.parentKind,
    parentId,
    versionNumber: nextVersionNumber(input.existingVersions),
    basedOnVersionId: basedOn?.id ?? null,
    state: CONTENT_VERSION_MACHINE.initial,
    createdBy,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    publishedBy: null,
    publishedAt: null,
    supersededAt: null,
    archivedAt: null,
  });

  return {
    version,
    audit: audit(ctx, "version.create_draft", version, { previousVersionId: basedOn?.id ?? null, newVersionId: id }),
  };
}

/** Records a content edit on a mutable version (bumps updatedAt). */
export function touchDraftVersion<V extends VersionRecord>(version: V, ctx: VersionContext): V {
  assertContentMutable(version);
  return Object.freeze({ ...version, updatedAt: toIso((ctx.clock ?? systemClock)()) });
}

export type ReviewTransition =
  /** Submit (from draft/changes_requested) or unapprove (from approved, reason required). */
  | { readonly to: "in_review"; readonly reason?: string | null }
  | { readonly to: "draft" }
  | { readonly to: "changes_requested"; readonly reason: string }
  | { readonly to: "approved"; readonly reviewerMayBeAuthor: boolean; readonly reason?: string | null }
  | { readonly to: "rejected"; readonly reason: string }
  | { readonly to: "archived"; readonly reason: string };

/**
 * Moves a version through review. Publication and supersession are not
 * available here: they only happen through `publishVersion`.
 */
export function transitionVersion<V extends VersionRecord>(
  version: V,
  transition: ReviewTransition,
  ctx: VersionContext,
): VersionChange<V> {
  assertTransition(CONTENT_VERSION_MACHINE, version.state, transition.to);
  const now = toIso((ctx.clock ?? systemClock)());
  const actorUid = parseUid(ctx.actor.uid, "actor");

  switch (transition.to) {
    case "in_review": {
      const next: V = Object.freeze({ ...version, state: "in_review" as const, submittedAt: now, updatedAt: now });
      if (version.state === "approved") {
        const reason = requireReason(transition.reason);
        return { version: next, audit: audit(ctx, "version.unapprove", next, { reason }) };
      }
      return { version: next, audit: audit(ctx, "version.submit_for_review", next) };
    }
    case "draft": {
      const next: V = Object.freeze({ ...version, state: "draft" as const, submittedAt: null, updatedAt: now });
      return { version: next, audit: audit(ctx, "version.withdraw", next) };
    }
    case "changes_requested": {
      const reason = requireReason(transition.reason);
      const next: V = Object.freeze({
        ...version,
        state: "changes_requested" as const,
        reviewedBy: actorUid,
        reviewedAt: now,
        updatedAt: now,
      });
      return { version: next, audit: audit(ctx, "version.request_changes", next, { reason }) };
    }
    case "approved": {
      if (!transition.reviewerMayBeAuthor && actorUid === version.createdBy) {
        throw new AuthError("FORBIDDEN", "You cannot approve a version you created.");
      }
      const next: V = Object.freeze({
        ...version,
        state: "approved" as const,
        reviewedBy: actorUid,
        reviewedAt: now,
        updatedAt: now,
      });
      return {
        version: next,
        audit: audit(ctx, "version.approve", next, { reason: optionalReason(transition.reason), approvalState: "approved" }),
      };
    }
    case "rejected": {
      const reason = requireReason(transition.reason);
      const next: V = Object.freeze({
        ...version,
        state: "rejected" as const,
        reviewedBy: actorUid,
        reviewedAt: now,
        updatedAt: now,
      });
      return { version: next, audit: audit(ctx, "version.reject", next, { reason, approvalState: "rejected" }) };
    }
    case "archived": {
      const reason = requireReason(transition.reason);
      const next: V = Object.freeze({ ...version, state: "archived" as const, archivedAt: now, updatedAt: now });
      return { version: next, audit: audit(ctx, "version.archive", next, { reason }) };
    }
  }
}

/** Unapproval is a transition back to review and always needs a reason. */
export function unapproveVersion<V extends VersionRecord>(version: V, reason: string, ctx: VersionContext): VersionChange<V> {
  if (version.state !== "approved") {
    throw new DomainError("INVALID_TRANSITION", "Only an approved version can be unapproved.");
  }
  return transitionVersion(version, { to: "in_review", reason }, ctx);
}

export interface PublishResult<V extends VersionRecord = VersionRecord> {
  readonly published: V;
  readonly superseded: V | null;
  readonly audits: readonly AuditEventInput[];
}

/**
 * Publishes an approved version and supersedes the currently published one.
 * `currentPublished` must be the parent's published version, or null when the
 * item has never been published. The caller persists both records and all
 * audit inputs in one transaction.
 */
export function publishVersion<V extends VersionRecord>(
  target: V,
  currentPublished: V | null,
  ctx: VersionContext,
): PublishResult<V> {
  assertTransition(CONTENT_VERSION_MACHINE, target.state, "published");
  const actorUid = parseUid(ctx.actor.uid, "actor");
  const now = toIso((ctx.clock ?? systemClock)());

  let superseded: V | null = null;
  if (currentPublished) {
    if (currentPublished.parentId !== target.parentId || currentPublished.parentKind !== target.parentKind) {
      throw new DomainError("CONFLICT", "The published version belongs to a different item.");
    }
    if (currentPublished.id === target.id) {
      throw new DomainError("CONFLICT", "This version is already published.");
    }
    if (currentPublished.versionNumber >= target.versionNumber) {
      throw new DomainError("CONFLICT", "A newer version is already published. Compare before publishing.");
    }
    assertTransition(CONTENT_VERSION_MACHINE, currentPublished.state, "superseded");
    superseded = Object.freeze({ ...currentPublished, state: "superseded" as const, supersededAt: now, updatedAt: now });
  }

  const published: V = Object.freeze({
    ...target,
    state: "published" as const,
    publishedBy: actorUid,
    publishedAt: now,
    updatedAt: now,
  });

  const audits: AuditEventInput[] = [
    audit(ctx, "version.publish", published, {
      previousVersionId: superseded?.id ?? null,
      newVersionId: published.id,
      approvalState: "published",
    }),
  ];
  if (superseded) {
    audits.push(
      audit(ctx, "version.supersede", superseded, {
        previousVersionId: superseded.id,
        newVersionId: published.id,
      }),
    );
  }
  return { published, superseded, audits: Object.freeze(audits) };
}
