/**
 * Persistence for approval gate definitions, gates and decisions (migration 0001).
 * Decisions are append-only in the database.
 */
import type { ApprovalGateState } from "../domain/states.ts";
import type { EntityKind } from "../domain/ids.ts";
import { sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { ApprovalGate, GateDecision, GateDecisionKind, GateDeciderRole, GateDefinition, GateType } from "../governance/approval-gates.ts";
import { iso, isoOrNull, num, str, strOrNull } from "./rows.ts";

export interface StoredGateDefinition extends GateDefinition {
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly reason: string;
}

function roles(value: unknown): GateDeciderRole[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.replace(/^\{|\}$/g, "").split(",").filter(Boolean) : [];
  return list.map((role) => String(role)) as GateDeciderRole[];
}

export function listGateDefinitionsQuery(): SqlQuery {
  return { text: `SELECT gate_type, required_approvals, eligible_roles, allow_self_approval, updated_by, updated_at, reason FROM academy_approval_gate_definitions ORDER BY gate_type`, values: [] };
}

export function selectGateDefinitionQuery(type: GateType): SqlQuery {
  return sqlQuery`SELECT gate_type, required_approvals, eligible_roles, allow_self_approval, updated_by, updated_at, reason
    FROM academy_approval_gate_definitions WHERE gate_type = ${type}`;
}

export function upsertGateDefinitionQuery(definition: GateDefinition, updatedBy: string, updatedAt: string, reason: string): SqlQuery {
  return sqlQuery`INSERT INTO academy_approval_gate_definitions
      (gate_type, required_approvals, eligible_roles, allow_self_approval, updated_by, updated_at, reason)
    VALUES (${definition.type}, ${definition.requiredApprovals}, ${[...definition.eligibleRoles]}::text[], ${definition.allowSelfApproval},
      ${updatedBy}, ${updatedAt}::timestamptz, ${reason})
    ON CONFLICT (gate_type) DO UPDATE SET required_approvals = EXCLUDED.required_approvals, eligible_roles = EXCLUDED.eligible_roles,
      allow_self_approval = EXCLUDED.allow_self_approval, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at,
      reason = EXCLUDED.reason
    RETURNING gate_type`;
}

export function mapGateDefinitionRow(row: SqlRow): StoredGateDefinition {
  return Object.freeze({
    type: str(row.gate_type) as GateType,
    requiredApprovals: num(row.required_approvals),
    eligibleRoles: Object.freeze(roles(row.eligible_roles)),
    allowSelfApproval: row.allow_self_approval === true,
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
    reason: str(row.reason),
  });
}

const GATE_COLUMNS = `id, gate_type, subject_kind, subject_id, subject_version_id, state, requested_by, requested_at, resolved_at,
  required_approvals, eligible_roles, allow_self_approval`;

export function selectGateQuery(id: string): SqlQuery {
  return { text: `SELECT ${GATE_COLUMNS} FROM academy_approval_gates WHERE id = $1::uuid`, values: [id] };
}

export function listSubjectGatesQuery(subjectKind: EntityKind, subjectId: string): SqlQuery {
  return {
    text: `SELECT ${GATE_COLUMNS} FROM academy_approval_gates WHERE subject_kind = $1 AND subject_id = $2 ORDER BY requested_at DESC`,
    values: [subjectKind, subjectId],
  };
}

export function listOpenGatesQuery(): SqlQuery {
  return { text: `SELECT ${GATE_COLUMNS} FROM academy_approval_gates WHERE state = 'open' ORDER BY requested_at ASC LIMIT 500`, values: [] };
}

export function insertGateQuery(gate: ApprovalGate): SqlQuery {
  return sqlQuery`INSERT INTO academy_approval_gates
      (id, gate_type, subject_kind, subject_id, subject_version_id, state, requested_by, requested_at, resolved_at,
       required_approvals, eligible_roles, allow_self_approval)
    VALUES (${gate.id}::uuid, ${gate.type}, ${gate.subject.kind}, ${gate.subject.id}, ${gate.subjectVersionId}::uuid, ${gate.state},
      ${gate.requestedBy}, ${gate.requestedAt}::timestamptz, NULL, ${gate.requiredApprovals}, ${[...gate.eligibleRoles]}::text[],
      ${gate.allowSelfApproval})
    RETURNING id`;
}

/** Moves a gate out of `open` exactly once. */
export function resolveGateQuery(gate: ApprovalGate): SqlQuery {
  return sqlQuery`UPDATE academy_approval_gates SET state = ${gate.state}, resolved_at = ${gate.resolvedAt}::timestamptz
    WHERE id = ${gate.id}::uuid AND state = 'open'
    RETURNING id`;
}

export function mapGateRow(row: SqlRow): ApprovalGate {
  return Object.freeze({
    id: str(row.id),
    type: str(row.gate_type) as GateType,
    subject: Object.freeze({ kind: str(row.subject_kind) as EntityKind, id: str(row.subject_id) }),
    subjectVersionId: strOrNull(row.subject_version_id),
    state: str(row.state) as ApprovalGateState,
    requestedBy: str(row.requested_by),
    requestedAt: iso(row.requested_at),
    resolvedAt: isoOrNull(row.resolved_at),
    requiredApprovals: num(row.required_approvals),
    eligibleRoles: Object.freeze(roles(row.eligible_roles)),
    allowSelfApproval: row.allow_self_approval === true,
  });
}

export function listDecisionsQuery(gateId: string): SqlQuery {
  return sqlQuery`SELECT id, gate_id, decided_by, decided_role, decision, reason, decided_at FROM academy_approval_decisions
    WHERE gate_id = ${gateId}::uuid ORDER BY decided_at ASC`;
}

/** Records a decision only while its gate is still open. */
export function insertDecisionQuery(decision: GateDecision): SqlQuery {
  return sqlQuery`INSERT INTO academy_approval_decisions (id, gate_id, decided_by, decided_role, decision, reason, decided_at)
    SELECT ${decision.id}::uuid, g.id, ${decision.decidedBy}::text, ${decision.decidedRole}::text, ${decision.decision}::text,
      ${decision.reason}::text, ${decision.decidedAt}::timestamptz
    FROM academy_approval_gates g WHERE g.id = ${decision.gateId}::uuid AND g.state = 'open'
    RETURNING id`;
}

export function mapDecisionRow(row: SqlRow): GateDecision {
  return Object.freeze({
    id: str(row.id),
    gateId: str(row.gate_id),
    decidedBy: str(row.decided_by),
    decidedRole: str(row.decided_role) as GateDeciderRole,
    decision: str(row.decision) as GateDecisionKind,
    reason: strOrNull(row.reason),
    decidedAt: iso(row.decided_at),
  });
}
