/**
 * Persistence for academy policy values (table academy_policy_values).
 *
 * One row per (key, level). Writes use optimistic concurrency on `revision`
 * and are always coupled with their audit event through `withAudit`.
 */
import type { AuditEvent } from "../audit/audit.ts";
import { jsonParam, sqlQuery, type SqlQuery } from "../infra/sql.ts";
import type { PolicyScope } from "../policies/registry.ts";
import type { PolicyTarget, PolicyValueRecord } from "../policies/resolver.ts";
import { withAudit } from "./audit-repo.ts";

/*
 * `value` is always selected as JSON text (`value::text`) and parsed exactly
 * once by the mapper. Letting the driver decode jsonb would make a stored
 * JSON string (for example a time zone name) indistinguishable from
 * undecoded JSON text.
 */

/** Every value that can apply to the target: the academy default plus its program and course overrides. */
export function selectPolicyValuesForTargetQuery(key: string, target: PolicyTarget): SqlQuery {
  return sqlQuery`SELECT id, policy_key, scope, program_id, course_id, value::text AS value, revision, set_by, set_at, reason
    FROM academy_policy_values
    WHERE policy_key = ${key}
      AND (scope = 'academy'
           OR (scope = 'program' AND program_id = ${target.programId}::uuid)
           OR (scope = 'course' AND course_id = ${target.courseId}::uuid))`;
}

/** The value stored at exactly one level, if any. */
export function selectPolicyValueAtScopeQuery(key: string, scope: PolicyScope, scopeId: string | null): SqlQuery {
  if (scope === "academy") {
    return sqlQuery`SELECT id, policy_key, scope, program_id, course_id, value::text AS value, revision, set_by, set_at, reason
      FROM academy_policy_values WHERE policy_key = ${key} AND scope = 'academy'`;
  }
  if (scope === "program") {
    return sqlQuery`SELECT id, policy_key, scope, program_id, course_id, value::text AS value, revision, set_by, set_at, reason
      FROM academy_policy_values WHERE policy_key = ${key} AND scope = 'program' AND program_id = ${scopeId}::uuid`;
  }
  return sqlQuery`SELECT id, policy_key, scope, program_id, course_id, value::text AS value, revision, set_by, set_at, reason
    FROM academy_policy_values WHERE policy_key = ${key} AND scope = 'course' AND course_id = ${scopeId}::uuid`;
}

function programId(record: PolicyValueRecord): string | null {
  return record.scope === "program" ? record.scopeId : null;
}

function courseId(record: PolicyValueRecord): string | null {
  return record.scope === "course" ? record.scopeId : null;
}

/** Inserts a first value at a level (expected revision: none). */
export function insertPolicyValueWithAuditQuery(record: PolicyValueRecord, event: AuditEvent): SqlQuery {
  const mutation = sqlQuery`INSERT INTO academy_policy_values
      (id, policy_key, scope, program_id, course_id, value, revision, set_by, set_at, reason)
    VALUES (${record.id}::uuid, ${record.key}, ${record.scope}, ${programId(record)}::uuid, ${courseId(record)}::uuid,
      ${jsonParam(record.value)}::jsonb, ${record.revision}, ${record.setBy}, ${record.setAt}::timestamptz, ${record.reason})
    ON CONFLICT DO NOTHING
    RETURNING id`;
  return withAudit(mutation, event);
}

/** Replaces an existing value only if nobody changed it since `expectedRevision`. */
export function updatePolicyValueWithAuditQuery(
  record: PolicyValueRecord,
  expectedRevision: number,
  event: AuditEvent,
): SqlQuery {
  const mutation = sqlQuery`UPDATE academy_policy_values
    SET value = ${jsonParam(record.value)}::jsonb, revision = ${record.revision}, set_by = ${record.setBy},
        set_at = ${record.setAt}::timestamptz, reason = ${record.reason}
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
  return withAudit(mutation, event);
}

/** Removes an override only if nobody changed it since `expectedRevision`. */
export function deletePolicyValueWithAuditQuery(record: PolicyValueRecord, expectedRevision: number, event: AuditEvent): SqlQuery {
  const mutation = sqlQuery`DELETE FROM academy_policy_values
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision} AND scope <> 'academy'
    RETURNING id`;
  return withAudit(mutation, event);
}

export interface PolicyValueRow {
  readonly id: string;
  readonly policy_key: string;
  readonly scope: string;
  readonly program_id: string | null;
  readonly course_id: string | null;
  readonly value: unknown;
  readonly revision: number | string;
  readonly set_by: string;
  readonly set_at: string | Date;
  readonly reason: string;
}

export function mapPolicyValueRow(row: PolicyValueRow): PolicyValueRecord {
  const scope = row.scope as PolicyScope;
  return Object.freeze({
    id: row.id,
    key: row.policy_key,
    scope,
    scopeId: scope === "program" ? row.program_id : scope === "course" ? row.course_id : null,
    // Selected as JSON text; a malformed value throws and resolution fails closed.
    value: JSON.parse(String(row.value)),
    revision: Number(row.revision),
    setBy: row.set_by,
    setAt: row.set_at instanceof Date ? row.set_at.toISOString() : String(row.set_at),
    reason: row.reason,
  });
}
