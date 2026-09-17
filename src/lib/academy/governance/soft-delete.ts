/**
 * Soft delete and restore for governed records.
 *
 * Normal product flows never remove governed rows. They mark them deleted
 * (who, when, why) and can restore them. Permanent deletion is a separate,
 * high-impact operation that requires the record to be soft-deleted first and
 * an approved `permanent_deletion` approval gate for that exact record.
 */
import type { AuditActor, AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { entityRef, parseUid, systemClock, toIso, type Clock, type EntityRef } from "../domain/ids.ts";
import { assertGateApproved, type ApprovalGate } from "./approval-gates.ts";

export interface SoftDeletable {
  readonly deletedAt: string | null;
  readonly deletedBy: string | null;
  readonly deletionReason: string | null;
}

export interface SoftDeleteContext {
  readonly actor: AuditActor;
  readonly reason: string;
  readonly clock?: Clock;
  readonly correlationId?: string | null;
}

export function isSoftDeleted(record: SoftDeletable): boolean {
  return record.deletedAt !== null;
}

/**
 * Reading a soft-deleted record behaves exactly like reading a missing one,
 * so the existence of deleted content is not disclosed. Administrative
 * recovery views opt in with `includeDeleted`.
 */
export function assertVisible<T extends SoftDeletable>(
  record: T | null | undefined,
  options: { readonly includeDeleted?: boolean } = {},
): T {
  if (!record || (isSoftDeleted(record) && !options.includeDeleted)) {
    throw new DomainError("NOT_FOUND", "Not found.");
  }
  return record;
}

export function softDelete<T extends SoftDeletable>(
  record: T,
  ref: EntityRef,
  ctx: SoftDeleteContext,
): { readonly record: T; readonly audit: AuditEventInput } {
  const subject = entityRef(ref.kind, ref.id);
  if (isSoftDeleted(record)) {
    throw new DomainError("CONFLICT", "This item is already deleted.");
  }
  const reason = requireReason(ctx.reason);
  const deletedBy = parseUid(ctx.actor.uid, "actor");
  const deletedAt = toIso((ctx.clock ?? systemClock)());
  const next = Object.freeze({ ...record, deletedAt, deletedBy, deletionReason: reason });
  return {
    record: next,
    audit: {
      actor: ctx.actor,
      action: "entity.soft_delete",
      object: subject,
      reason,
      correlationId: ctx.correlationId ?? null,
      rollback: { capable: true, strategy: "Restore the item from the recovery view." },
    },
  };
}

export function restoreSoftDeleted<T extends SoftDeletable>(
  record: T,
  ref: EntityRef,
  ctx: SoftDeleteContext,
): { readonly record: T; readonly audit: AuditEventInput } {
  const subject = entityRef(ref.kind, ref.id);
  if (!isSoftDeleted(record)) {
    throw new DomainError("CONFLICT", "This item is not deleted.");
  }
  const reason = requireReason(ctx.reason);
  parseUid(ctx.actor.uid, "actor");
  const next = Object.freeze({ ...record, deletedAt: null, deletedBy: null, deletionReason: null });
  return {
    record: next,
    audit: {
      actor: ctx.actor,
      action: "entity.restore",
      object: subject,
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: {
        previouslyDeletedAt: record.deletedAt,
        previouslyDeletedBy: record.deletedBy,
        previousDeletionReason: record.deletionReason,
      },
      rollback: { capable: true, strategy: "Soft-delete the item again." },
    },
  };
}

/**
 * Permanent deletion requires: the record is already soft-deleted, and an
 * approved permanent-deletion gate exists for this exact record. Returns the
 * audit input the caller must write with the deletion.
 */
export function planPermanentDeletion(
  record: SoftDeletable,
  ref: EntityRef,
  gate: ApprovalGate | null,
  ctx: SoftDeleteContext,
): AuditEventInput {
  const subject = entityRef(ref.kind, ref.id);
  if (!isSoftDeleted(record)) {
    throw new DomainError("CONFLICT", "Only an item that is already deleted can be permanently removed.");
  }
  // The request must follow the current deletion. A gate approved while the
  // record was deleted before (and later restored) does not carry over.
  const deletedAt = Date.parse(record.deletedAt as string);
  const current = gate !== null && Date.parse(gate.requestedAt) >= deletedAt ? gate : null;
  assertGateApproved(current, { type: "permanent_deletion", subject, subjectVersionId: null });
  const reason = requireReason(ctx.reason);
  return {
    actor: ctx.actor,
    action: "entity.permanent_delete",
    object: subject,
    reason,
    correlationId: ctx.correlationId ?? null,
    approvalState: "approved",
    rollback: { capable: false },
    metadata: { approvalGateId: gate?.id ?? null },
  };
}
