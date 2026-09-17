/**
 * Effective policy lookup for services that act on academic rules.
 *
 * Reads the academy, program and course levels in one query, resolves them
 * (ACADEMY -> PROGRAM -> COURSE) and fails closed with a safe 503 when the
 * academy has not configured the setting.
 */
import type { SqlExecutor } from "../infra/sql.ts";
import { getPolicyDefinition, type PolicyKey, type PolicyValue } from "../policies/registry.ts";
import { requirePolicyValue, resolvePolicy, type PolicyTarget } from "../policies/resolver.ts";
import { mapPolicyValueRow, selectPolicyValuesForTargetQuery, type PolicyValueRow } from "../repo/policy-repo.ts";

export async function effectivePolicy<K extends PolicyKey>(
  executor: SqlExecutor,
  key: K,
  target: PolicyTarget,
): Promise<PolicyValue<K>> {
  const definition = getPolicyDefinition(key);
  const rows = await executor.query(selectPolicyValuesForTargetQuery(definition.key, target));
  const records = rows.map((row) => mapPolicyValueRow(row as unknown as PolicyValueRow));
  return requirePolicyValue(resolvePolicy(definition, records, target));
}

/** The academy time zone (academy-wide setting). */
export function academyTimeZone(executor: SqlExecutor): Promise<string> {
  return effectivePolicy(executor, "institution.timezone", { programId: null, courseId: null });
}
