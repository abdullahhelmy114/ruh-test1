/**
 * Policy resolution: ACADEMY DEFAULT -> PROGRAM OVERRIDE -> COURSE OVERRIDE.
 *
 * There is no class-group layer. Resolution reports the effective value, the
 * level that supplied it, the value it overrides (the nearest defined ancestor)
 * and the full trail, which is what the admin policy screen renders as
 * inherited / effective / override / reset-to-inherited.
 *
 * Stored values are re-validated on every read. A corrupt stored value never
 * silently degrades to a default: resolution fails closed.
 */
import type { AuditActor, AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import {
  defaultIdGenerator,
  parseOptionalUuid,
  parseUid,
  parseUuid,
  systemClock,
  toIso,
  type Clock,
  type IdGenerator,
} from "../domain/ids.ts";
import { isPolicyScope, type PolicyDefinition, type PolicyScope } from "./registry.ts";

export interface PolicyValueRecord {
  readonly id: string;
  readonly key: string;
  readonly scope: PolicyScope;
  /** null for the academy default; the program or course id otherwise. */
  readonly scopeId: string | null;
  readonly value: unknown;
  readonly revision: number;
  readonly setBy: string;
  readonly setAt: string;
  readonly reason: string;
}

export interface PolicyTarget {
  readonly programId: string | null;
  readonly courseId: string | null;
}

export interface PolicyTrailEntry {
  readonly scope: PolicyScope;
  readonly scopeId: string | null;
  readonly defined: boolean;
  readonly recordId: string | null;
  readonly revision: number | null;
}

export type PolicyResolution<V> =
  | {
      readonly status: "resolved";
      readonly key: string;
      readonly effectiveValue: V;
      readonly source: PolicyScope;
      readonly sourceRecordId: string;
      readonly sourceRevision: number;
      /** The value this level overrides, when an ancestor level defines one. */
      readonly inheritedValue: V | null;
      readonly inheritedSource: PolicyScope | null;
      readonly isOverride: boolean;
      readonly trail: readonly PolicyTrailEntry[];
    }
  | {
      readonly status: "unconfigured";
      readonly key: string;
      readonly trail: readonly PolicyTrailEntry[];
    };

function levelsFor(definition: PolicyDefinition, target: PolicyTarget): { scope: PolicyScope; scopeId: string | null }[] {
  const levels: { scope: PolicyScope; scopeId: string | null }[] = [];
  if (definition.allowedScopes.includes("academy")) levels.push({ scope: "academy", scopeId: null });
  if (target.programId && definition.allowedScopes.includes("program")) {
    levels.push({ scope: "program", scopeId: target.programId });
  }
  if (target.courseId && definition.allowedScopes.includes("course")) {
    levels.push({ scope: "course", scopeId: target.courseId });
  }
  return levels;
}

function findAt(
  records: readonly PolicyValueRecord[],
  key: string,
  scope: PolicyScope,
  scopeId: string | null,
): PolicyValueRecord | null {
  const matches = records.filter((r) => r.key === key && r.scope === scope && r.scopeId === scopeId);
  if (matches.length > 1) {
    throw new DomainError("CONFLICT", "Academy settings are inconsistent. Contact an administrator.");
  }
  return matches[0] ?? null;
}

function parseStored<V>(definition: PolicyDefinition<V>, stored: PolicyValueRecord): V {
  try {
    return definition.parse(stored.value);
  } catch {
    throw new DomainError("POLICY_UNCONFIGURED", "An academy setting is invalid and must be corrected by an administrator.");
  }
}

export function normaliseTarget(target: { programId?: unknown; courseId?: unknown }): PolicyTarget {
  return {
    programId: parseOptionalUuid(target.programId, "programId"),
    courseId: parseOptionalUuid(target.courseId, "courseId"),
  };
}

export function resolvePolicy<V>(
  definition: PolicyDefinition<V>,
  records: readonly PolicyValueRecord[],
  target: PolicyTarget,
): PolicyResolution<V> {
  const trail: PolicyTrailEntry[] = [];
  const defined: { scope: PolicyScope; record: PolicyValueRecord; value: V }[] = [];

  for (const level of levelsFor(definition, target)) {
    const stored = findAt(records, definition.key, level.scope, level.scopeId);
    trail.push(
      Object.freeze({
        scope: level.scope,
        scopeId: level.scopeId,
        defined: stored !== null,
        recordId: stored?.id ?? null,
        revision: stored?.revision ?? null,
      }),
    );
    if (stored) defined.push({ scope: level.scope, record: stored, value: parseStored(definition, stored) });
  }

  if (defined.length === 0) {
    return Object.freeze({ status: "unconfigured", key: definition.key, trail: Object.freeze(trail) });
  }

  const effective = defined[defined.length - 1];
  const inherited = defined.length > 1 ? defined[defined.length - 2] : null;

  return Object.freeze({
    status: "resolved",
    key: definition.key,
    effectiveValue: effective.value,
    source: effective.scope,
    sourceRecordId: effective.record.id,
    sourceRevision: effective.record.revision,
    inheritedValue: inherited?.value ?? null,
    inheritedSource: inherited?.scope ?? null,
    isOverride: effective.scope !== "academy",
    trail: Object.freeze(trail),
  });
}

/** Returns the effective value or fails closed with a safe 503. */
export function requirePolicyValue<V>(resolution: PolicyResolution<V>): V {
  if (resolution.status !== "resolved") {
    throw new DomainError("POLICY_UNCONFIGURED", "This academy setting has not been configured yet.");
  }
  return resolution.effectiveValue;
}

/** Parses and validates a policy level from untrusted input. No class-group level exists. */
export function parsePolicyLevel(scope: unknown, scopeId: unknown): { scope: PolicyScope; scopeId: string | null } {
  return parseScopeId(scope, scopeId);
}

/** The editor's expected revision: null (no value yet) or a positive whole number. */
export function parseExpectedRevision(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new DomainError("VALIDATION", "expectedRevision must be a positive whole number or null.");
  }
  return value;
}

function parseScopeId(scope: unknown, scopeId: unknown): { scope: PolicyScope; scopeId: string | null } {
  if (!isPolicyScope(scope)) {
    throw new DomainError("VALIDATION", "Settings can only be defined for the academy, a program or a course.");
  }
  if (scope === "academy") {
    if (scopeId !== null && scopeId !== undefined && scopeId !== "") {
      throw new DomainError("VALIDATION", "The academy default does not take a program or course.");
    }
    return { scope, scopeId: null };
  }
  return { scope, scopeId: parseUuid(scopeId, scope === "program" ? "programId" : "courseId") };
}

function assertRevision(existing: PolicyValueRecord | null, expectedRevision: number | null): void {
  const actual = existing?.revision ?? null;
  if (actual !== expectedRevision) {
    throw new DomainError("CONFLICT", "This setting was changed by someone else. Reload and try again.");
  }
}

export interface PolicyChangeContext {
  readonly actor: AuditActor;
  readonly clock?: Clock;
  readonly newId?: IdGenerator;
  readonly correlationId?: string | null;
}

export interface SetPolicyValueInput {
  readonly scope: unknown;
  readonly scopeId: unknown;
  readonly value: unknown;
  readonly reason: unknown;
  /** The revision the editor saw; null when no value existed at this level. */
  readonly expectedRevision: number | null;
  /** Records already stored at exactly this key and level (zero or one). */
  readonly existing: readonly PolicyValueRecord[];
}

export interface PolicyValueChange {
  readonly record: PolicyValueRecord;
  readonly previous: PolicyValueRecord | null;
  readonly audit: AuditEventInput;
}

export function planSetPolicyValue<V>(
  definition: PolicyDefinition<V>,
  input: SetPolicyValueInput,
  ctx: PolicyChangeContext,
): PolicyValueChange {
  const { scope, scopeId } = parseScopeId(input.scope, input.scopeId);
  if (!definition.allowedScopes.includes(scope)) {
    throw new DomainError("VALIDATION", `This setting cannot be overridden at the ${scope} level.`);
  }
  const reason = requireReason(input.reason);
  const setBy = parseUid(ctx.actor.uid, "actor");
  const value = definition.parse(input.value);
  const previous = findAt(input.existing, definition.key, scope, scopeId);
  assertRevision(previous, input.expectedRevision);

  const record: PolicyValueRecord = Object.freeze({
    id: previous?.id ?? (ctx.newId ?? defaultIdGenerator)(),
    key: definition.key,
    scope,
    scopeId,
    value,
    revision: (previous?.revision ?? 0) + 1,
    setBy,
    setAt: toIso((ctx.clock ?? systemClock)()),
    reason,
  });

  return {
    record,
    previous,
    audit: {
      actor: ctx.actor,
      action: "policy.set_value",
      object: { kind: "policy_value", id: record.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      rollback: { capable: true, strategy: previous ? "Set the previous value again." : "Reset to inherited." },
      metadata: {
        key: definition.key,
        scope,
        scopeId,
        previousValue: previous?.value ?? null,
        newValue: value,
        previousRevision: previous?.revision ?? null,
        newRevision: record.revision,
      },
    },
  };
}

export interface ResetPolicyValueInput {
  readonly scope: unknown;
  readonly scopeId: unknown;
  readonly reason: unknown;
  readonly expectedRevision: number;
  readonly existing: readonly PolicyValueRecord[];
}

/** Removes an override so the level inherits again. The academy default cannot be reset. */
export function planResetToInherited(
  definition: PolicyDefinition,
  input: ResetPolicyValueInput,
  ctx: PolicyChangeContext,
): { readonly removed: PolicyValueRecord; readonly audit: AuditEventInput } {
  const { scope, scopeId } = parseScopeId(input.scope, input.scopeId);
  if (scope === "academy") {
    throw new DomainError("VALIDATION", "The academy default has nothing to inherit from.");
  }
  const reason = requireReason(input.reason);
  parseUid(ctx.actor.uid, "actor");
  const existing = findAt(input.existing, definition.key, scope, scopeId);
  if (!existing) {
    throw new DomainError("NOT_FOUND", "There is no override to reset at this level.");
  }
  assertRevision(existing, input.expectedRevision);
  return {
    removed: existing,
    audit: {
      actor: ctx.actor,
      action: "policy.reset_to_inherited",
      object: { kind: "policy_value", id: existing.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      rollback: { capable: true, strategy: "Set the removed value again." },
      metadata: {
        key: definition.key,
        scope,
        scopeId,
        removedValue: existing.value,
        removedRevision: existing.revision,
      },
    },
  };
}
