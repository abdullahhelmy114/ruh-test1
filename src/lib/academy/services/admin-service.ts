/**
 * Administration workspace: operational overview, review queue, audit trail
 * and the policy map (inherited / effective / override per level).
 */
import type { AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseOptionalUuid, systemClock } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import { POLICY_KEYS, getPolicyDefinition } from "../policies/registry.ts";
import { resolvePolicy } from "../policies/resolver.ts";
import { selectConfiguredAcademyPolicyKeysQuery, selectContentReviewQueueQuery, selectOverviewQuery } from "../repo/admin-repo.ts";
import { listAuditEventsQuery, mapAuditRow, type AuditRow } from "../repo/audit-repo.ts";
import { mapPolicyValueRow, selectPolicyValuesForTargetQuery, type PolicyValueRow } from "../repo/policy-repo.ts";
import { iso, num, str, strOrNull } from "../repo/rows.ts";
import { parseInstant } from "../domain/text.ts";
import type { ServiceDeps } from "./support.ts";

const WEEK_MS = 7 * 86_400_000;

export function createAdminService(deps: ServiceDeps) {
  const { executor } = deps;

  return {
    async overview(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "audit.read");
      const now = (deps.clock ?? systemClock)();
      const [countRows, configuredRows] = await Promise.all([
        executor.query(selectOverviewQuery(now.toISOString(), new Date(now.getTime() + WEEK_MS).toISOString())),
        executor.query(selectConfiguredAcademyPolicyKeysQuery()),
      ]);
      const row = countRows[0] ?? {};
      const counts = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, num(value ?? 0)]));
      const configured = new Set(configuredRows.map((r) => str(r.policy_key)));
      return {
        counts,
        // Settings with no academy-wide value: features depending on them fail closed until configured.
        unconfiguredAcademyPolicies: POLICY_KEYS.filter((key) => !configured.has(key)),
      };
    },

    async reviewQueue(user: AuthUser) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "audit.read");
      const rows = await executor.query(selectContentReviewQueueQuery());
      return rows.map((row) => ({
        kind: str(row.kind),
        versionId: str(row.id),
        versionNumber: num(row.version_number),
        label: strOrNull(row.label),
        courseId: strOrNull(row.course_id),
        createdBy: str(row.created_by),
        submittedAt: row.submitted_at === null || row.submitted_at === undefined ? null : iso(row.submitted_at),
      }));
    },

    async auditTrail(
      user: AuthUser,
      filter: {
        readonly objectKind?: string | null;
        readonly objectId?: string | null;
        readonly actorUid?: string | null;
        readonly action?: string | null;
        readonly correlationId?: string | null;
        readonly before?: string | null;
        readonly limit?: string | null;
      },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "audit.read");
      const limit = filter.limit ? Number(filter.limit) : undefined;
      if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new DomainError("VALIDATION", "limit must be a positive whole number.");
      const rows = await executor.query(
        listAuditEventsQuery({
          objectKind: filter.objectKind ?? undefined,
          objectId: filter.objectId ?? undefined,
          actorUid: filter.actorUid ?? undefined,
          action: filter.action ?? undefined,
          correlationId: filter.correlationId ?? undefined,
          before: filter.before ? parseInstant(filter.before, "before") : undefined,
          limit,
        }),
      );
      return rows.map((row) => mapAuditRow(row as unknown as AuditRow));
    },

    /** For each setting: whether it resolves for this target, from which level, and what it overrides. */
    async policyMap(user: AuthUser, target: { readonly programId?: unknown; readonly courseId?: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "policy.manage");
      const normalised = { programId: parseOptionalUuid(target.programId, "programId"), courseId: parseOptionalUuid(target.courseId, "courseId") };
      return Promise.all(
        POLICY_KEYS.map(async (key) => {
          const definition = getPolicyDefinition(key);
          const rows = await executor.query(selectPolicyValuesForTargetQuery(key, normalised));
          try {
            return { key, allowedScopes: definition.allowedScopes, resolution: resolvePolicy(definition, rows.map((r) => mapPolicyValueRow(r as unknown as PolicyValueRow)), normalised) };
          } catch (error) {
            if (error instanceof DomainError && (error.code === "POLICY_UNCONFIGURED" || error.code === "CONFLICT")) {
              return { key, allowedScopes: definition.allowedScopes, resolution: { status: "invalid" as const, key, message: error.message } };
            }
            throw error;
          }
        }),
      );
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
