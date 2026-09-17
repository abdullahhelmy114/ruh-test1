/**
 * Audit envelope for important academy mutations.
 *
 * Every governed mutation produces exactly one AuditEvent, written in the same
 * database transaction as the mutation itself (see repo/audit-repo.ts), so a
 * change can never happen silently and an audit row can never describe a
 * change that did not happen.
 *
 * Actions are registered: an unknown action is a programming error, and each
 * action declares its impact and whether a human-readable reason is required.
 * Metadata is redacted recursively before it is stored, so credentials, answer
 * keys and private note content can never land in the audit trail.
 */
import type { Role } from "../../auth/core.ts";
import { DomainError, optionalReason, requireReason } from "../domain/errors.ts";
import {
  defaultIdGenerator,
  entityRef,
  isUuid,
  parseCorrelationId,
  parseUid,
  systemClock,
  toIso,
  type Clock,
  type EntityKind,
  type EntityRef,
  type IdGenerator,
} from "../domain/ids.ts";

export const AUDIT_IMPACTS = ["low", "standard", "high"] as const;
export type AuditImpact = (typeof AUDIT_IMPACTS)[number];

export interface AuditActionDefinition {
  readonly impact: AuditImpact;
  readonly reasonRequired: boolean;
}

/**
 * The closed registry of auditable actions. Later batches extend this list;
 * nothing may be audited under an ad-hoc action name.
 */
export const AUDIT_ACTIONS = {
  "version.create_draft": { impact: "standard", reasonRequired: false },
  "version.submit_for_review": { impact: "standard", reasonRequired: false },
  "version.withdraw": { impact: "standard", reasonRequired: false },
  "version.request_changes": { impact: "standard", reasonRequired: true },
  "version.approve": { impact: "high", reasonRequired: false },
  "version.unapprove": { impact: "high", reasonRequired: true },
  "version.reject": { impact: "high", reasonRequired: true },
  "version.publish": { impact: "high", reasonRequired: false },
  "version.supersede": { impact: "standard", reasonRequired: false },
  "version.archive": { impact: "high", reasonRequired: true },
  "entity.soft_delete": { impact: "high", reasonRequired: true },
  "entity.restore": { impact: "high", reasonRequired: true },
  "entity.permanent_delete": { impact: "high", reasonRequired: true },
  "policy.set_value": { impact: "high", reasonRequired: true },
  "policy.reset_to_inherited": { impact: "high", reasonRequired: true },
  "approval_gate.open": { impact: "standard", reasonRequired: false },
  "approval_gate.decide": { impact: "high", reasonRequired: false },
  "approval_gate.cancel": { impact: "standard", reasonRequired: true },
  "approval_gate.configure": { impact: "high", reasonRequired: true },
  "relationship.link": { impact: "standard", reasonRequired: false },
  "relationship.unlink": { impact: "standard", reasonRequired: true },
  // Core academic structure
  "program.create": { impact: "standard", reasonRequired: false },
  "program.update": { impact: "standard", reasonRequired: false },
  "program.change_status": { impact: "high", reasonRequired: false },
  "course.create": { impact: "standard", reasonRequired: false },
  "course.update": { impact: "standard", reasonRequired: false },
  "course.change_status": { impact: "high", reasonRequired: false },
  "course.move_program": { impact: "high", reasonRequired: true },
  "curriculum_version.save_outline": { impact: "standard", reasonRequired: false },
  "class_group.create": { impact: "standard", reasonRequired: false },
  "class_group.update": { impact: "standard", reasonRequired: false },
  "class_group.change_status": { impact: "high", reasonRequired: false },
  "class_group.repin_curriculum": { impact: "high", reasonRequired: true },
  "class_group.assign_teacher": { impact: "high", reasonRequired: false },
  "class_group.unassign_teacher": { impact: "high", reasonRequired: true },
  "session.schedule": { impact: "standard", reasonRequired: false },
  "session.reschedule": { impact: "standard", reasonRequired: true },
  "session.change_status": { impact: "standard", reasonRequired: false },
  "enrollment.create": { impact: "standard", reasonRequired: false },
  "enrollment.change_status": { impact: "high", reasonRequired: false },
} as const satisfies Record<string, AuditActionDefinition>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(AUDIT_ACTIONS, value);
}

export type AuditActorRole = Role | "system";

export interface AuditActor {
  readonly uid: string;
  readonly role: AuditActorRole;
}

/** Counts of what a change touches, for reviewers and impact previews. */
export interface AuditImpactScope {
  readonly programs?: number;
  readonly courses?: number;
  readonly classGroups?: number;
  readonly learners?: number;
  readonly teachers?: number;
  readonly notes?: string;
}

export interface AuditRelationshipChange {
  readonly change: "linked" | "unlinked";
  readonly relationship: string;
  readonly from: EntityRef;
  readonly to: EntityRef;
}

export interface AuditRollback {
  readonly capable: boolean;
  /** Human description of how the change can be reversed, when capable. */
  readonly strategy?: string;
}

export interface AuditEventInput {
  readonly actor: AuditActor;
  readonly action: AuditAction;
  readonly object: { readonly kind: EntityKind; readonly id: string };
  readonly reason?: string | null;
  readonly previousVersionId?: string | null;
  readonly newVersionId?: string | null;
  readonly impactScope?: AuditImpactScope;
  readonly changedRelationships?: readonly AuditRelationshipChange[];
  readonly approvalState?: string | null;
  readonly rollback?: AuditRollback;
  readonly correlationId?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface AuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: AuditActor;
  readonly action: AuditAction;
  readonly impact: AuditImpact;
  readonly object: EntityRef;
  readonly reason: string | null;
  readonly previousVersionId: string | null;
  readonly newVersionId: string | null;
  readonly impactScope: AuditImpactScope;
  readonly changedRelationships: readonly AuditRelationshipChange[];
  readonly approvalState: string | null;
  readonly rollback: AuditRollback;
  readonly correlationId: string | null;
  readonly metadata: Record<string, unknown>;
}

const AUDIT_ROLES: readonly AuditActorRole[] = ["admin", "teacher", "student", "system"];

/**
 * Keys whose values must never be written to the audit trail. Keys are
 * normalised (lower-cased, separators removed) before matching, so
 * `api_key`, `apiKey` and `API-KEY` are all caught, while harmless keys that
 * merely contain a short fragment (`passageId`, `footprint`) are not.
 */
const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "passwd",
  "passcode",
  "secret",
  "token",
  "cookie",
  "authorization",
  "apikey",
  "credential",
  "signature",
  "answerkey",
  "correctanswer",
  "correctindex",
  "privatenote",
  "notebody",
  "annotationdata",
  "otpcode",
  "codehash",
] as const;

const SENSITIVE_EXACT_KEYS = new Set(["correct", "otp", "pin", "code"]);

export function isSensitiveAuditKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (SENSITIVE_EXACT_KEYS.has(normalised)) return true;
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalised.includes(fragment));
}

export const REDACTED = "[redacted]";

const MAX_METADATA_DEPTH = 6;
const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_ITEMS = 100;

/** Recursively redacts sensitive keys and bounds the size of audit metadata. */
export function redactAuditMetadata(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return typeof value === "number" && !Number.isFinite(value) ? null : value;
  }
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  if (depth >= MAX_METADATA_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactAuditMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveAuditKey(key) ? REDACTED : redactAuditMetadata(inner, depth + 1);
    }
    return out;
  }
  // functions, symbols, bigint, undefined: never persisted
  return null;
}

function nonNegativeCount(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new DomainError("VALIDATION", `${field} must be a non-negative whole number.`);
  }
  return value;
}

function normaliseImpactScope(scope: AuditImpactScope | undefined): AuditImpactScope {
  if (!scope) return {};
  const out: Record<string, number | string> = {};
  for (const field of ["programs", "courses", "classGroups", "learners", "teachers"] as const) {
    const count = nonNegativeCount(scope[field], field);
    if (count !== undefined) out[field] = count;
  }
  const notes = optionalReason(scope.notes, 1000);
  if (notes) out.notes = notes;
  return out as AuditImpactScope;
}

function optionalVersionId(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (!isUuid(value)) throw new DomainError("VALIDATION", `${field} must be a valid identifier.`);
  return value.toLowerCase();
}

export interface AuditBuildOptions {
  readonly clock?: Clock;
  readonly newId?: IdGenerator;
}

/** Validates, normalises and redacts an audit event. Throws on invalid input. */
export function buildAuditEvent(input: AuditEventInput, options: AuditBuildOptions = {}): AuditEvent {
  if (!isAuditAction(input.action)) {
    throw new DomainError("VALIDATION", "Unknown audit action.");
  }
  const definition: AuditActionDefinition = AUDIT_ACTIONS[input.action];

  if (!AUDIT_ROLES.includes(input.actor?.role)) {
    throw new DomainError("VALIDATION", "Unknown audit actor role.");
  }
  const actor: AuditActor = Object.freeze({ uid: parseUid(input.actor.uid, "actor"), role: input.actor.role });

  const object = entityRef(input.object?.kind, input.object?.id);
  const reason = definition.reasonRequired ? requireReason(input.reason) : optionalReason(input.reason);

  const changedRelationships = (input.changedRelationships ?? []).map((change) => {
    if (change.change !== "linked" && change.change !== "unlinked") {
      throw new DomainError("VALIDATION", "Unknown relationship change.");
    }
    if (typeof change.relationship !== "string" || change.relationship.trim() === "") {
      throw new DomainError("VALIDATION", "Relationship name is required.");
    }
    return Object.freeze({
      change: change.change,
      relationship: change.relationship.trim(),
      from: entityRef(change.from?.kind, change.from?.id),
      to: entityRef(change.to?.kind, change.to?.id),
    });
  });

  const rollback: AuditRollback = input.rollback?.capable
    ? Object.freeze({ capable: true, strategy: optionalReason(input.rollback.strategy, 500) ?? undefined })
    : Object.freeze({ capable: false });

  const clock = options.clock ?? systemClock;
  const newId = options.newId ?? defaultIdGenerator;

  return Object.freeze({
    id: newId(),
    occurredAt: toIso(clock()),
    actor,
    action: input.action,
    impact: definition.impact,
    object,
    reason,
    previousVersionId: optionalVersionId(input.previousVersionId, "previousVersionId"),
    newVersionId: optionalVersionId(input.newVersionId, "newVersionId"),
    impactScope: Object.freeze(normaliseImpactScope(input.impactScope)),
    changedRelationships: Object.freeze(changedRelationships),
    approvalState: optionalReason(input.approvalState, 64),
    rollback,
    correlationId: parseCorrelationId(input.correlationId),
    metadata: Object.freeze((redactAuditMetadata(input.metadata ?? {}) ?? {}) as Record<string, unknown>),
  });
}
