/**
 * Human approval gates.
 *
 * A gate is a recorded request for one or more human decisions about a
 * specific subject (and, for versioned content, a specific version). It is
 * never a checkbox: every decision is attributed, time-stamped and, when it
 * blocks the subject, justified.
 *
 * Gate definitions (how many approvals, which roles, whether the requester may
 * approve their own request) are academy configuration. This module ships no
 * default values: an unconfigured gate type cannot be opened. When a gate is
 * opened, its definition is snapshotted so later configuration changes never
 * retroactively alter a gate that is already in progress.
 */
import { AuthError, type Role } from "../../auth/core.ts";
import type { AuditActor, AuditEventInput } from "../audit/audit.ts";
import { DomainError, optionalReason, requireReason } from "../domain/errors.ts";
import {
  defaultIdGenerator,
  entityRef,
  parseOptionalUuid,
  parseUid,
  systemClock,
  toIso,
  type Clock,
  type EntityRef,
  type IdGenerator,
} from "../domain/ids.ts";
import { APPROVAL_GATE_MACHINE, assertTransition, type ApprovalGateState } from "../domain/states.ts";

export const GATE_TYPES = [
  "publication",
  "high_impact_academic",
  "rights_clearance",
  "religious_review",
  "historical_review",
  "privacy_review",
  "final_assessment_release",
  "permanent_deletion",
  "external_publication",
] as const;

export type GateType = (typeof GATE_TYPES)[number];

/** Students can never decide a governance gate. */
export type GateDeciderRole = Extract<Role, "admin" | "teacher">;

const DECIDER_ROLES: readonly GateDeciderRole[] = ["admin", "teacher"];

export interface GateDefinition {
  readonly type: GateType;
  readonly requiredApprovals: number;
  readonly eligibleRoles: readonly GateDeciderRole[];
  readonly allowSelfApproval: boolean;
}

export interface ApprovalGate {
  readonly id: string;
  readonly type: GateType;
  readonly subject: EntityRef;
  readonly subjectVersionId: string | null;
  readonly state: ApprovalGateState;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly resolvedAt: string | null;
  readonly requiredApprovals: number;
  readonly eligibleRoles: readonly GateDeciderRole[];
  readonly allowSelfApproval: boolean;
}

export const GATE_DECISIONS = ["approve", "reject", "request_changes"] as const;
export type GateDecisionKind = (typeof GATE_DECISIONS)[number];

export interface GateDecision {
  readonly id: string;
  readonly gateId: string;
  readonly decidedBy: string;
  readonly decidedRole: GateDeciderRole;
  readonly decision: GateDecisionKind;
  readonly reason: string | null;
  readonly decidedAt: string;
}

export function isGateType(value: unknown): value is GateType {
  return typeof value === "string" && (GATE_TYPES as readonly string[]).includes(value);
}

/** Validates academy-supplied gate configuration. */
export function parseGateDefinition(input: unknown): GateDefinition {
  if (!input || typeof input !== "object") {
    throw new DomainError("VALIDATION", "Gate configuration is required.");
  }
  const raw = input as Record<string, unknown>;
  if (!isGateType(raw.type)) {
    throw new DomainError("VALIDATION", "Unknown approval gate type.");
  }
  const required = raw.requiredApprovals;
  if (typeof required !== "number" || !Number.isInteger(required) || required < 1 || required > 10) {
    throw new DomainError("VALIDATION", "Required approvals must be a whole number from 1 to 10.");
  }
  if (!Array.isArray(raw.eligibleRoles) || raw.eligibleRoles.length === 0) {
    throw new DomainError("VALIDATION", "At least one eligible role is required.");
  }
  const roles = new Set<GateDeciderRole>();
  for (const role of raw.eligibleRoles) {
    if (!DECIDER_ROLES.includes(role as GateDeciderRole)) {
      throw new DomainError("VALIDATION", "Only admins and teachers can decide approval gates.");
    }
    roles.add(role as GateDeciderRole);
  }
  if (typeof raw.allowSelfApproval !== "boolean") {
    throw new DomainError("VALIDATION", "Self-approval must be explicitly allowed or disallowed.");
  }
  return Object.freeze({
    type: raw.type,
    requiredApprovals: required,
    eligibleRoles: Object.freeze([...roles]),
    allowSelfApproval: raw.allowSelfApproval,
  });
}

export interface GateContext {
  readonly actor: AuditActor;
  readonly clock?: Clock;
  readonly newId?: IdGenerator;
  readonly correlationId?: string | null;
}

function gateAudit(
  ctx: GateContext,
  action: AuditEventInput["action"],
  gate: ApprovalGate,
  extra: Partial<AuditEventInput> = {},
): AuditEventInput {
  return {
    actor: ctx.actor,
    action,
    object: { kind: "approval_gate", id: gate.id },
    newVersionId: gate.subjectVersionId,
    approvalState: gate.state,
    correlationId: ctx.correlationId ?? null,
    metadata: {
      gateType: gate.type,
      subjectKind: gate.subject.kind,
      subjectId: gate.subject.id,
      requiredApprovals: gate.requiredApprovals,
    },
    ...extra,
  };
}

export interface OpenGateInput {
  readonly definition: GateDefinition | null;
  readonly subject: EntityRef;
  readonly subjectVersionId?: string | null;
  /** Gates already recorded for this subject (to prevent duplicate open gates). */
  readonly existingGates: readonly ApprovalGate[];
}

export function openGate(input: OpenGateInput, ctx: GateContext): { readonly gate: ApprovalGate; readonly audit: AuditEventInput } {
  if (!input.definition) {
    throw new DomainError("POLICY_UNCONFIGURED", "This approval step has not been configured by the academy.");
  }
  const definition = parseGateDefinition(input.definition);
  const subject = entityRef(input.subject.kind, input.subject.id);
  const subjectVersionId = parseOptionalUuid(input.subjectVersionId, "subjectVersionId");

  const duplicate = input.existingGates.some(
    (gate) =>
      gate.state === "open" &&
      gate.type === definition.type &&
      gate.subject.kind === subject.kind &&
      gate.subject.id === subject.id &&
      gate.subjectVersionId === subjectVersionId,
  );
  if (duplicate) {
    throw new DomainError("CONFLICT", "An approval request is already open for this item.");
  }

  const gate: ApprovalGate = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    type: definition.type,
    subject,
    subjectVersionId,
    state: APPROVAL_GATE_MACHINE.initial,
    requestedBy: parseUid(ctx.actor.uid, "actor"),
    requestedAt: toIso((ctx.clock ?? systemClock)()),
    resolvedAt: null,
    requiredApprovals: definition.requiredApprovals,
    eligibleRoles: definition.eligibleRoles,
    allowSelfApproval: definition.allowSelfApproval,
  });
  return { gate, audit: gateAudit(ctx, "approval_gate.open", gate) };
}

export interface DecideGateInput {
  readonly decision: GateDecisionKind;
  readonly reason?: string | null;
}

export function decideGate(
  gate: ApprovalGate,
  priorDecisions: readonly GateDecision[],
  input: DecideGateInput,
  ctx: GateContext,
): { readonly gate: ApprovalGate; readonly decision: GateDecision; readonly audit: AuditEventInput } {
  if (gate.state !== "open") {
    throw new DomainError("CONFLICT", "This approval request has already been resolved.");
  }
  if (!(GATE_DECISIONS as readonly string[]).includes(input.decision)) {
    throw new DomainError("VALIDATION", "Unknown decision.");
  }
  const actorUid = parseUid(ctx.actor.uid, "actor");
  const role = ctx.actor.role;
  if (role !== "admin" && role !== "teacher") {
    throw new AuthError("FORBIDDEN", "You are not eligible to decide this request.");
  }
  if (!gate.eligibleRoles.includes(role)) {
    throw new AuthError("FORBIDDEN", "You are not eligible to decide this request.");
  }
  if (!gate.allowSelfApproval && actorUid === gate.requestedBy) {
    throw new AuthError("FORBIDDEN", "You cannot decide a request you raised.");
  }
  for (const prior of priorDecisions) {
    if (prior.gateId !== gate.id) {
      throw new DomainError("CONFLICT", "Decision history belongs to a different request.");
    }
    if (prior.decidedBy === actorUid) {
      throw new DomainError("CONFLICT", "You have already recorded a decision on this request.");
    }
  }

  const reason = input.decision === "approve" ? optionalReason(input.reason) : requireReason(input.reason);
  const now = toIso((ctx.clock ?? systemClock)());

  const decision: GateDecision = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    gateId: gate.id,
    decidedBy: actorUid,
    decidedRole: role,
    decision: input.decision,
    reason,
    decidedAt: now,
  });

  let nextState: ApprovalGateState = "open";
  if (input.decision === "reject") {
    nextState = "rejected";
  } else if (input.decision === "request_changes") {
    nextState = "changes_requested";
  } else {
    const approvals = priorDecisions.filter((prior) => prior.decision === "approve").length + 1;
    if (approvals >= gate.requiredApprovals) nextState = "approved";
  }

  let nextGate = gate;
  if (nextState !== "open") {
    assertTransition(APPROVAL_GATE_MACHINE, gate.state, nextState);
    nextGate = Object.freeze({ ...gate, state: nextState, resolvedAt: now });
  }

  return {
    gate: nextGate,
    decision,
    audit: gateAudit(ctx, "approval_gate.decide", nextGate, {
      reason,
      metadata: {
        gateType: gate.type,
        subjectKind: gate.subject.kind,
        subjectId: gate.subject.id,
        decision: input.decision,
        requiredApprovals: gate.requiredApprovals,
      },
    }),
  };
}

export function cancelGate(
  gate: ApprovalGate,
  reason: string,
  ctx: GateContext,
): { readonly gate: ApprovalGate; readonly audit: AuditEventInput } {
  assertTransition(APPROVAL_GATE_MACHINE, gate.state, "cancelled");
  const text = requireReason(reason);
  const next = Object.freeze({ ...gate, state: "cancelled" as const, resolvedAt: toIso((ctx.clock ?? systemClock)()) });
  return { gate: next, audit: gateAudit(ctx, "approval_gate.cancel", next, { reason: text }) };
}

/** Throws APPROVAL_REQUIRED unless this exact subject/version has an approved gate. */
export function assertGateApproved(
  gate: ApprovalGate | null,
  expected: { readonly type: GateType; readonly subject: EntityRef; readonly subjectVersionId: string | null },
): void {
  const matches =
    gate !== null &&
    gate.state === "approved" &&
    gate.type === expected.type &&
    gate.subject.kind === expected.subject.kind &&
    gate.subject.id === expected.subject.id &&
    gate.subjectVersionId === expected.subjectVersionId;
  if (!matches) {
    throw new DomainError("APPROVAL_REQUIRED", "This action needs an approved review first.");
  }
}
