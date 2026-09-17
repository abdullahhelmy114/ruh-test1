/**
 * Approval gates: configuration (administrators), requests (administrators),
 * decisions (eligible administrators or teachers, per the gate's own
 * snapshot of its definition) and cancellation.
 *
 * Nothing here invents gate configuration: an unconfigured gate type cannot
 * be opened (governance/approval-gates.ts).
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { entityRef, isEntityKind, parseOptionalUuid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import {
  cancelGate,
  decideGate,
  isGateType,
  openGate,
  parseGateDefinition,
  type GateDecisionKind,
} from "../governance/approval-gates.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import { expectRows } from "../repo/audit-repo.ts";
import {
  insertDecisionQuery,
  insertGateQuery,
  listDecisionsQuery,
  listGateDefinitionsQuery,
  listOpenGatesQuery,
  listSubjectGatesQuery,
  mapDecisionRow,
  mapGateDefinitionRow,
  mapGateRow,
  resolveGateQuery,
  selectGateDefinitionQuery,
  selectGateQuery,
  upsertGateDefinitionQuery,
} from "../repo/gate-repo.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

type Correlated = { readonly correlationId?: string | null };

export function createGovernanceService(deps: ServiceDeps) {
  const { executor } = deps;

  return {
    async listGateDefinitions(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "approval_gate.configure");
      return loadMany(executor, listGateDefinitionsQuery(), mapGateDefinitionRow);
    },

    async configureGate(
      user: AuthUser,
      input: Correlated & { readonly type: unknown; readonly requiredApprovals: unknown; readonly eligibleRoles: unknown; readonly allowSelfApproval: unknown; readonly reason: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "approval_gate.configure");
      const definition = parseGateDefinition({
        type: input.type,
        requiredApprovals: input.requiredApprovals,
        eligibleRoles: input.eligibleRoles,
        allowSelfApproval: input.allowSelfApproval,
      });
      const reason = requireReason(input.reason);
      const previous = await loadOptional(executor, selectGateDefinitionQuery(definition.type), mapGateDefinitionRow);
      const ctx = contextFor(user, deps, input.correlationId);
      const at = toIso((deps.clock ?? systemClock)());
      await runGuarded(executor, [
        audited(deps, upsertGateDefinitionQuery(definition, user.uid, at, reason), {
          actor: ctx.actor,
          action: "approval_gate.configure",
          object: entityRef("approval_gate_definition", definition.type),
          reason,
          correlationId: ctx.correlationId,
          rollback: { capable: previous !== null, strategy: previous ? "Configure the previous values again." : undefined },
          metadata: {
            previous: previous
              ? { requiredApprovals: previous.requiredApprovals, eligibleRoles: [...previous.eligibleRoles], allowSelfApproval: previous.allowSelfApproval }
              : null,
            next: { requiredApprovals: definition.requiredApprovals, eligibleRoles: [...definition.eligibleRoles], allowSelfApproval: definition.allowSelfApproval },
          },
        }),
      ]);
      return { ...definition, updatedBy: user.uid, updatedAt: at, reason };
    },

    async openGate(
      user: AuthUser,
      input: Correlated & { readonly type: unknown; readonly subjectKind: unknown; readonly subjectId: unknown; readonly subjectVersionId?: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "approval_gate.configure");
      if (!isGateType(input.type)) throw new DomainError("VALIDATION", "Unknown approval gate type.");
      if (!isEntityKind(input.subjectKind)) throw new DomainError("VALIDATION", "Unknown subject type.");
      const subject = entityRef(input.subjectKind, input.subjectId);
      const [definition, existing] = await Promise.all([
        loadOptional(executor, selectGateDefinitionQuery(input.type), mapGateDefinitionRow),
        loadMany(executor, listSubjectGatesQuery(subject.kind, subject.id), mapGateRow),
      ]);
      const plan = openGate(
        { definition, subject, subjectVersionId: parseOptionalUuid(input.subjectVersionId, "subjectVersionId"), existingGates: existing },
        { ...contextFor(user, deps, input.correlationId) },
      );
      await runGuarded(executor, [audited(deps, insertGateQuery(plan.gate), plan.audit)], { unique: "An approval request is already open for this item." });
      return plan.gate;
    },

    async listOpenGates(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      if (user.role !== "admin" && user.role !== "teacher") throw new AuthError("FORBIDDEN");
      const gates = await loadMany(executor, listOpenGatesQuery(), mapGateRow);
      // Teachers only see requests they are eligible to decide.
      return user.role === "admin" ? gates : gates.filter((gate) => gate.eligibleRoles.includes("teacher"));
    },

    async getGate(user: AuthUser, gateId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const gate = await loadRequired(executor, selectGateQuery(parseUuid(gateId, "gateId")), mapGateRow, "Approval request not found.");
      if (user.role !== "admin" && !(user.role === "teacher" && gate.eligibleRoles.includes("teacher"))) {
        throw new DomainError("NOT_FOUND", "Approval request not found.");
      }
      const decisions = await loadMany(executor, listDecisionsQuery(gate.id), mapDecisionRow);
      return { gate, decisions };
    },

    async decide(user: AuthUser, gateId: unknown, input: Correlated & { readonly decision: unknown; readonly reason?: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const gate = await loadRequired(executor, selectGateQuery(parseUuid(gateId, "gateId")), mapGateRow, "Approval request not found.");
      const prior = await loadMany(executor, listDecisionsQuery(gate.id), mapDecisionRow);
      const plan = decideGate(
        gate,
        prior,
        { decision: input.decision as GateDecisionKind, reason: input.reason as string | undefined },
        contextFor(user, deps, input.correlationId),
      );
      const statements: SqlQuery[] = [audited(deps, insertDecisionQuery(plan.decision), plan.audit)];
      if (plan.gate.state !== gate.state) statements.push(expectRows(resolveGateQuery(plan.gate), 1));
      await runGuarded(executor, statements, { unique: "You have already recorded a decision on this request." });
      return { gate: plan.gate, decision: plan.decision };
    },

    async cancel(user: AuthUser, gateId: unknown, input: Correlated & { readonly reason: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "approval_gate.configure");
      const gate = await loadRequired(executor, selectGateQuery(parseUuid(gateId, "gateId")), mapGateRow, "Approval request not found.");
      const plan = cancelGate(gate, input.reason as string, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, resolveGateQuery(plan.gate), plan.audit)]);
      return plan.gate;
    },
  };
}

export type GovernanceService = ReturnType<typeof createGovernanceService>;
