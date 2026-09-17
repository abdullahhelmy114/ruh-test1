/**
 * Shared plumbing for academy services: guarded transactions, loaders and
 * audit coupling. Keeps every service's error mapping identical.
 */
import type { AuthUser } from "../../auth/core.ts";
import { buildAuditEvent, type AuditEventInput } from "../audit/audit.ts";
import { DomainError } from "../domain/errors.ts";
import type { Clock, IdGenerator } from "../domain/ids.ts";
import type { AcademyFeatureFlags } from "../infra/flags.ts";
import {
  isForeignKeyViolation,
  isStaleWrite,
  isUniqueViolation,
  type SqlExecutor,
  type SqlQuery,
  type SqlRow,
} from "../infra/sql.ts";
import { withAuditExpectOne } from "../repo/audit-repo.ts";
import type { StructureContext } from "../structure/catalog.ts";

export const STALE_MESSAGE = "This item was changed by someone else. Reload and try again.";

export interface ServiceDeps {
  readonly executor: SqlExecutor;
  readonly flags: AcademyFeatureFlags;
  readonly clock?: Clock;
  readonly newId?: IdGenerator;
}

/** Runs statements atomically and maps database guard failures to safe conflicts. */
export async function runGuarded(
  executor: SqlExecutor,
  queries: readonly SqlQuery[],
  messages: { readonly unique?: string } = {},
): Promise<SqlRow[][]> {
  try {
    return await executor.transaction(queries);
  } catch (error) {
    if (isStaleWrite(error)) throw new DomainError("CONFLICT", STALE_MESSAGE);
    if (isUniqueViolation(error)) throw new DomainError("CONFLICT", messages.unique ?? STALE_MESSAGE);
    if (isForeignKeyViolation(error)) {
      throw new DomainError("CONFLICT", "A related item no longer exists. Reload and try again.");
    }
    throw error;
  }
}

export async function loadOptional<T>(executor: SqlExecutor, query: SqlQuery, map: (row: SqlRow) => T): Promise<T | null> {
  const rows = await executor.query(query);
  return rows.length === 0 ? null : map(rows[0]);
}

export async function loadRequired<T>(
  executor: SqlExecutor,
  query: SqlQuery,
  map: (row: SqlRow) => T,
  notFound: string,
): Promise<T> {
  const found = await loadOptional(executor, query, map);
  if (found === null) throw new DomainError("NOT_FOUND", notFound);
  return found;
}

export async function loadMany<T>(executor: SqlExecutor, query: SqlQuery, map: (row: SqlRow) => T): Promise<T[]> {
  return (await executor.query(query)).map(map);
}

export function contextFor(user: AuthUser, deps: ServiceDeps, correlationId?: string | null): StructureContext {
  return { actor: { uid: user.uid, role: user.role }, clock: deps.clock, newId: deps.newId, correlationId: correlationId ?? null };
}

/** Builds the audit event (validated and redacted) and couples it with the mutation. */
export function audited(deps: ServiceDeps, mutation: SqlQuery, audit: AuditEventInput): SqlQuery {
  return withAuditExpectOne(mutation, buildAuditEvent(audit, { clock: deps.clock, newId: deps.newId }));
}

/** Soft delete / restore bump the record's revision like any other edit. */
export function touched<T extends { readonly revision: number; readonly updatedBy: string; readonly updatedAt: string }>(
  record: T,
  previousRevision: number,
  actorUid: string,
  at: string,
): T {
  return Object.freeze({ ...record, revision: previousRevision + 1, updatedBy: actorUid, updatedAt: at });
}
