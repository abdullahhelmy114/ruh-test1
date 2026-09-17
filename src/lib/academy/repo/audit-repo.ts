/**
 * Persistence for the audit trail (table academy_audit_events).
 *
 * The table is append-only at the database level (a trigger rejects UPDATE,
 * DELETE and TRUNCATE). Governed mutations are written together with their
 * audit event in ONE statement via `withAudit`: the audit row is inserted from
 * the mutation's RETURNING set, so if the mutation changes nothing, no audit
 * row is written either, and the caller sees zero rows and reports a conflict.
 */
import type { AuditEvent, AuditImpact } from "../audit/audit.ts";
import { DomainError } from "../domain/errors.ts";
import { isEntityKind, isUid, isUuid } from "../domain/ids.ts";
import { jsonParam, joinQueries, sqlQuery, type SqlQuery } from "../infra/sql.ts";

const AUDIT_COLUMNS = `id, occurred_at, actor_uid, actor_role, action, impact, object_kind, object_id,
  previous_version_id, new_version_id, reason, impact_scope, changed_relationships, approval_state,
  rollback_capable, rollback_strategy, correlation_id, metadata`;

/**
 * Every parameter carries an explicit cast: in `INSERT ... SELECT $1, $2 FROM
 * mutated`, Postgres would otherwise type untyped select-list parameters as
 * text and reject them for boolean or uuid columns.
 */
function auditValues(event: AuditEvent): SqlQuery {
  return sqlQuery`${event.id}::uuid, ${event.occurredAt}::timestamptz, ${event.actor.uid}::text, ${event.actor.role}::text,
    ${event.action}::text, ${event.impact}::text, ${event.object.kind}::text, ${event.object.id}::text,
    ${event.previousVersionId}::uuid, ${event.newVersionId}::uuid, ${event.reason}::text,
    ${jsonParam(event.impactScope)}::jsonb, ${jsonParam(event.changedRelationships)}::jsonb, ${event.approvalState}::text,
    ${event.rollback.capable}::boolean, ${event.rollback.strategy ?? null}::text, ${event.correlationId}::text,
    ${jsonParam(event.metadata)}::jsonb`;
}

/** Stand-alone audit insert, for events that are not coupled to a row mutation. */
export function insertAuditEventQuery(event: AuditEvent): SqlQuery {
  return joinQueries([
    { text: `INSERT INTO academy_audit_events (${AUDIT_COLUMNS}) VALUES (`, values: [] },
    auditValues(event),
    { text: ") RETURNING id", values: [] },
  ], "");
}

/**
 * Couples a single-row mutation with its audit event in one statement.
 * `mutation` must be an INSERT/UPDATE/DELETE ending in `RETURNING ...`.
 * The statement returns one row per audited mutation; zero rows means the
 * mutation did not apply (and nothing was audited).
 */
export function withAudit(mutation: SqlQuery, event: AuditEvent): SqlQuery {
  if (!/\bRETURNING\b/i.test(mutation.text)) {
    throw new Error("withAudit requires a mutation with a RETURNING clause.");
  }
  return joinQueries([
    { text: "WITH mutated AS (", values: [] },
    mutation,
    { text: `) INSERT INTO academy_audit_events (${AUDIT_COLUMNS}) SELECT `, values: [] },
    auditValues(event),
    { text: " FROM mutated RETURNING id", values: [] },
  ], "");
}

export interface AuditListFilter {
  readonly objectKind?: string;
  readonly objectId?: string;
  readonly actorUid?: string;
  readonly action?: string;
  readonly correlationId?: string;
  /** Keyset cursor: return events strictly older than this ISO timestamp. */
  readonly before?: string;
  readonly limit?: number;
}

const MAX_PAGE = 200;

export function listAuditEventsQuery(filter: AuditListFilter): SqlQuery {
  const conditions: SqlQuery[] = [];
  if (filter.objectKind !== undefined) {
    if (!isEntityKind(filter.objectKind)) throw new DomainError("VALIDATION", "Unknown entity type.");
    conditions.push(sqlQuery`object_kind = ${filter.objectKind}`);
  }
  if (filter.objectId !== undefined) {
    if (!isUuid(filter.objectId) && !isUid(filter.objectId)) throw new DomainError("VALIDATION", "Invalid identifier.");
    conditions.push(sqlQuery`object_id = ${filter.objectId}`);
  }
  if (filter.actorUid !== undefined) {
    if (!isUid(filter.actorUid)) throw new DomainError("VALIDATION", "Invalid user identifier.");
    conditions.push(sqlQuery`actor_uid = ${filter.actorUid}`);
  }
  if (filter.action !== undefined) {
    if (!/^[a-z_]+\.[a-z_]+$/.test(filter.action)) throw new DomainError("VALIDATION", "Invalid action.");
    conditions.push(sqlQuery`action = ${filter.action}`);
  }
  if (filter.correlationId !== undefined) {
    conditions.push(sqlQuery`correlation_id = ${filter.correlationId}`);
  }
  if (filter.before !== undefined) {
    if (Number.isNaN(Date.parse(filter.before))) throw new DomainError("VALIDATION", "Invalid cursor.");
    conditions.push(sqlQuery`occurred_at < ${filter.before}::timestamptz`);
  }
  const limit = Math.min(Math.max(Math.trunc(filter.limit ?? 50), 1), MAX_PAGE);

  const parts: SqlQuery[] = [{ text: `SELECT ${AUDIT_COLUMNS} FROM academy_audit_events`, values: [] }];
  conditions.forEach((condition, index) => {
    parts.push({ text: index === 0 ? " WHERE " : " AND ", values: [] });
    parts.push(condition);
  });
  parts.push(sqlQuery` ORDER BY occurred_at DESC, id DESC LIMIT ${limit}`);
  return joinQueries(parts, "");
}

export interface AuditRow {
  readonly id: string;
  readonly occurred_at: string | Date;
  readonly actor_uid: string;
  readonly actor_role: string;
  readonly action: string;
  readonly impact: string;
  readonly object_kind: string;
  readonly object_id: string;
  readonly reason: string | null;
  readonly correlation_id: string | null;
  readonly [column: string]: unknown;
}

/** Read model for the audit screen. Metadata was redacted before it was stored. */
export interface AuditListItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorUid: string;
  readonly actorRole: string;
  readonly action: string;
  readonly impact: AuditImpact | string;
  readonly objectKind: string;
  readonly objectId: string;
  readonly reason: string | null;
  readonly correlationId: string | null;
}

export function mapAuditRow(row: AuditRow): AuditListItem {
  const occurredAt = row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at);
  return Object.freeze({
    id: row.id,
    occurredAt,
    actorUid: row.actor_uid,
    actorRole: row.actor_role,
    action: row.action,
    impact: row.impact,
    objectKind: row.object_kind,
    objectId: row.object_id,
    reason: row.reason,
    correlationId: row.correlation_id,
  });
}
