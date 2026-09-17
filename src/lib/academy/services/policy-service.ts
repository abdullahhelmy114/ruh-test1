/**
 * Academy policy service: resolve, set an override, reset to inherited.
 *
 * Order of checks for every mutation: capability available -> caller is an
 * administrator -> key/level/value valid -> revision matches -> one coupled
 * statement writes the value and its audit event together.
 */
import type { AuthUser } from "../../auth/core.ts";
import { buildAuditEvent } from "../audit/audit.ts";
import { DomainError } from "../domain/errors.ts";
import type { Clock, IdGenerator } from "../domain/ids.ts";
import { assertAcademyCoreAvailable, type AcademyFeatureFlags } from "../infra/flags.ts";
import { isUniqueViolation, type SqlExecutor } from "../infra/sql.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import { getPolicyDefinition } from "../policies/registry.ts";
import {
  normaliseTarget,
  parseExpectedRevision,
  parsePolicyLevel,
  planResetToInherited,
  planSetPolicyValue,
  resolvePolicy,
  type PolicyResolution,
  type PolicyValueRecord,
} from "../policies/resolver.ts";
import {
  deletePolicyValueWithAuditQuery,
  insertPolicyValueWithAuditQuery,
  mapPolicyValueRow,
  selectPolicyValueAtScopeQuery,
  selectPolicyValuesForTargetQuery,
  updatePolicyValueWithAuditQuery,
  type PolicyValueRow,
} from "../repo/policy-repo.ts";

export interface PolicyServiceDeps {
  readonly executor: SqlExecutor;
  readonly flags: AcademyFeatureFlags;
  readonly clock?: Clock;
  readonly newId?: IdGenerator;
}

export interface SetPolicyValueRequest {
  readonly key: unknown;
  readonly scope: unknown;
  readonly scopeId?: unknown;
  readonly value: unknown;
  readonly reason: unknown;
  readonly expectedRevision: unknown;
  readonly correlationId?: string | null;
}

export interface ResetPolicyValueRequest {
  readonly key: unknown;
  readonly scope: unknown;
  readonly scopeId?: unknown;
  readonly reason: unknown;
  readonly expectedRevision: unknown;
  readonly correlationId?: string | null;
}

export interface PolicyService {
  resolve(key: unknown, target: { programId?: unknown; courseId?: unknown }): Promise<PolicyResolution<unknown>>;
  setValue(user: AuthUser, request: SetPolicyValueRequest): Promise<PolicyValueRecord>;
  resetToInherited(user: AuthUser, request: ResetPolicyValueRequest): Promise<PolicyValueRecord>;
}

const STALE = "This setting was changed by someone else. Reload and try again.";

export function createPolicyService(deps: PolicyServiceDeps): PolicyService {
  async function runCoupled(statement: Parameters<SqlExecutor["query"]>[0]): Promise<void> {
    let rows: unknown[];
    try {
      rows = await deps.executor.query(statement);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError("CONFLICT", STALE);
      throw error;
    }
    if (rows.length !== 1) throw new DomainError("CONFLICT", STALE);
  }

  async function loadAtLevel(key: string, scope: ReturnType<typeof parsePolicyLevel>): Promise<PolicyValueRecord[]> {
    const rows = await deps.executor.query<PolicyValueRow & Record<string, unknown>>(
      selectPolicyValueAtScopeQuery(key, scope.scope, scope.scopeId),
    );
    return rows.map(mapPolicyValueRow);
  }

  return {
    async resolve(key, target) {
      assertAcademyCoreAvailable(deps.flags);
      const definition = getPolicyDefinition(key);
      const normalised = normaliseTarget(target);
      const rows = await deps.executor.query<PolicyValueRow & Record<string, unknown>>(
        selectPolicyValuesForTargetQuery(definition.key, normalised),
      );
      return resolvePolicy(definition, rows.map(mapPolicyValueRow), normalised);
    },

    async setValue(user, request) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "policy.manage");
      const definition = getPolicyDefinition(request.key);
      const level = parsePolicyLevel(request.scope, request.scopeId);
      const expectedRevision = parseExpectedRevision(request.expectedRevision);
      const existing = await loadAtLevel(definition.key, level);

      const plan = planSetPolicyValue(
        definition,
        { scope: level.scope, scopeId: level.scopeId, value: request.value, reason: request.reason, expectedRevision, existing },
        { actor: { uid: user.uid, role: user.role }, clock: deps.clock, newId: deps.newId, correlationId: request.correlationId },
      );
      const event = buildAuditEvent(plan.audit, { clock: deps.clock, newId: deps.newId });
      const statement = plan.previous
        ? updatePolicyValueWithAuditQuery(plan.record, plan.previous.revision, event)
        : insertPolicyValueWithAuditQuery(plan.record, event);
      await runCoupled(statement);
      return plan.record;
    },

    async resetToInherited(user, request) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "policy.manage");
      const definition = getPolicyDefinition(request.key);
      const level = parsePolicyLevel(request.scope, request.scopeId);
      const expectedRevision = parseExpectedRevision(request.expectedRevision);
      if (expectedRevision === null) {
        throw new DomainError("VALIDATION", "expectedRevision is required to reset a setting.");
      }
      const existing = await loadAtLevel(definition.key, level);

      const plan = planResetToInherited(
        definition,
        { scope: level.scope, scopeId: level.scopeId, reason: request.reason, expectedRevision, existing },
        { actor: { uid: user.uid, role: user.role }, clock: deps.clock, newId: deps.newId, correlationId: request.correlationId },
      );
      const event = buildAuditEvent(plan.audit, { clock: deps.clock, newId: deps.newId });
      await runCoupled(deletePolicyValueWithAuditQuery(plan.removed, expectedRevision, event));
      return plan.removed;
    },
  };
}
