/**
 * Practice results and remediation.
 *
 * Practice results: a learner completes a published activity or game in a
 * class group; objective items are graded with the assessment engine. Results
 * are personal learning records visible to the learner and the class group's
 * teachers and administrators.
 *
 * Remediation: administrators define explicit rules ("below N% on this
 * assessment -> this remediation item"). There are no default thresholds.
 * Teachers apply matching rules to a released result, or assign a linked
 * remediation item directly; learners complete assignments, teachers may
 * dismiss them with a reason.
 */
import { DomainError, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { assertRevision, parseOptionalInt, parseOptionalText, parseRequiredRevision } from "../domain/text.ts";
import { autoGrade, parseResponses, scoreOf, type ItemResult, type Responses } from "../assessment/grading.ts";
import type { AssessmentContent } from "../assessment/content.ts";
import type { AttemptRecord } from "../assessment/delivery.ts";
import type { Planned, StructureContext } from "../structure/catalog.ts";

function at(ctx: StructureContext): string {
  return toIso((ctx.clock ?? systemClock)());
}

// ---------------------------------------------------------------------------
// Practice results
// ---------------------------------------------------------------------------

export interface PracticeResultRecord {
  readonly id: string;
  readonly itemId: string;
  readonly itemVersionId: string;
  readonly classGroupId: string;
  readonly learnerUid: string;
  readonly responses: Responses;
  readonly itemResults: readonly ItemResult[];
  readonly scorePercent: number;
  readonly durationSeconds: number | null;
  readonly completedAt: string;
}

export function planPracticeResult(
  input: {
    readonly itemId: string;
    readonly itemVersionId: string;
    readonly classGroupId: string;
    readonly learnerUid: string;
    readonly scored: AssessmentContent;
    readonly responses: unknown;
    readonly durationSeconds?: unknown;
  },
  ctx: StructureContext,
): PracticeResultRecord {
  const responses = parseResponses(input.scored, input.responses);
  const grade = autoGrade(input.scored, responses);
  // Practice content only allows objective items, so nothing is left pending.
  const score = scoreOf(grade.items);
  return Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    itemId: input.itemId,
    itemVersionId: input.itemVersionId,
    classGroupId: input.classGroupId,
    learnerUid: parseUid(input.learnerUid, "learner"),
    responses,
    itemResults: grade.items,
    scorePercent: score.scorePercent,
    durationSeconds: parseOptionalInt(input.durationSeconds, "durationSeconds", 1, 86_400),
    completedAt: at(ctx),
  });
}

// ---------------------------------------------------------------------------
// Remediation rules
// ---------------------------------------------------------------------------

export interface RemediationRuleRecord {
  readonly id: string;
  readonly courseId: string;
  readonly assessmentId: string;
  readonly belowScorePercent: number;
  readonly itemId: string;
  readonly state: "active" | "retired";
  readonly reason: string;
  readonly retireReason: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export function planCreateRemediationRule(
  input: {
    readonly courseId: string;
    readonly assessment: { readonly id: string; readonly courseId: string } | null;
    /** Whether the item has an active remediation link to this course. */
    readonly itemLinkedForRemediation: boolean;
    readonly itemId: unknown;
    readonly belowScorePercent: unknown;
    readonly reason: unknown;
  },
  ctx: StructureContext,
): Planned<RemediationRuleRecord> {
  if (!input.assessment || input.assessment.courseId !== input.courseId) throw new DomainError("NOT_FOUND", "Assessment not found for this course.");
  const itemId = parseUuid(input.itemId, "itemId");
  if (!input.itemLinkedForRemediation) throw new DomainError("CONFLICT", "Link the item to this course for remediation first.");
  const below = parseOptionalInt(input.belowScorePercent, "belowScorePercent", 1, 100);
  if (below === null) throw new DomainError("VALIDATION", "belowScorePercent is required.");
  const uid = parseUid(ctx.actor.uid, "actor");
  const now = at(ctx);
  const record: RemediationRuleRecord = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    courseId: input.courseId,
    assessmentId: input.assessment.id,
    belowScorePercent: below,
    itemId,
    state: "active",
    reason: requireReason(input.reason),
    retireReason: null,
    revision: 1,
    createdBy: uid,
    createdAt: now,
    updatedBy: uid,
    updatedAt: now,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "remediation_rule.create",
      object: { kind: "remediation_rule", id: record.id },
      reason: record.reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { courseId: record.courseId, assessmentId: record.assessmentId, itemId, belowScorePercent: below },
    },
  };
}

export function planRetireRemediationRule(
  rule: RemediationRuleRecord,
  input: { readonly reason: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<RemediationRuleRecord> {
  assertRevision(rule.revision, parseRequiredRevision(input.expectedRevision));
  if (rule.state !== "active") throw new DomainError("CONFLICT", "This rule is already retired.");
  const reason = requireReason(input.reason);
  const record: RemediationRuleRecord = Object.freeze({
    ...rule,
    state: "retired",
    retireReason: reason,
    revision: rule.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: at(ctx),
  });
  return {
    record,
    audit: { actor: ctx.actor, action: "remediation_rule.retire", object: { kind: "remediation_rule", id: rule.id }, reason, correlationId: ctx.correlationId ?? null },
  };
}

/** Rules that apply to a released attempt score. */
export function matchingRules(rules: readonly RemediationRuleRecord[], assessmentId: string, attempt: Pick<AttemptRecord, "scorePercent" | "releasedAt">): RemediationRuleRecord[] {
  if (attempt.releasedAt === null || attempt.scorePercent === null) return [];
  const score = attempt.scorePercent;
  return rules.filter((rule) => rule.state === "active" && rule.assessmentId === assessmentId && score < rule.belowScorePercent);
}

// ---------------------------------------------------------------------------
// Remediation assignments
// ---------------------------------------------------------------------------

export const REMEDIATION_STATES = ["assigned", "completed", "dismissed"] as const;
export type RemediationState = (typeof REMEDIATION_STATES)[number];

export interface RemediationAssignmentRecord {
  readonly id: string;
  readonly classGroupId: string;
  readonly learnerUid: string;
  readonly itemId: string;
  readonly ruleId: string | null;
  readonly sourceAttemptId: string | null;
  readonly note: string | null;
  readonly state: RemediationState;
  readonly stateReason: string | null;
  readonly revision: number;
  readonly assignedBy: string;
  readonly assignedAt: string;
  readonly resolvedAt: string | null;
}

export function planAssignRemediation(
  input: {
    readonly classGroupId: string;
    readonly learnerUid: string;
    readonly itemId: string;
    readonly ruleId: string | null;
    readonly sourceAttemptId: string | null;
    readonly note?: unknown;
    readonly openForLearner: readonly Pick<RemediationAssignmentRecord, "itemId" | "state">[];
  },
  ctx: StructureContext,
): Planned<RemediationAssignmentRecord> {
  if (input.openForLearner.some((a) => a.itemId === input.itemId && a.state === "assigned")) {
    throw new DomainError("CONFLICT", "This learner already has this remediation assigned.");
  }
  const record: RemediationAssignmentRecord = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    classGroupId: input.classGroupId,
    learnerUid: parseUid(input.learnerUid, "learnerUid"),
    itemId: input.itemId,
    ruleId: input.ruleId,
    sourceAttemptId: input.sourceAttemptId,
    note: parseOptionalText(input.note, "note", 2000),
    state: "assigned",
    stateReason: null,
    revision: 1,
    assignedBy: parseUid(ctx.actor.uid, "actor"),
    assignedAt: at(ctx),
    resolvedAt: null,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "remediation.assign",
      object: { kind: "remediation_assignment", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { classGroupId: record.classGroupId, learnerUid: record.learnerUid, itemId: record.itemId, ruleId: record.ruleId, sourceAttemptId: record.sourceAttemptId },
    },
  };
}

export function planResolveRemediation(
  assignment: RemediationAssignmentRecord,
  input: { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
  context: { readonly actingAsLearner: boolean },
  ctx: StructureContext,
): Planned<RemediationAssignmentRecord> {
  assertRevision(assignment.revision, parseRequiredRevision(input.expectedRevision));
  if (assignment.state !== "assigned") throw new DomainError("CONFLICT", "This remediation has already been resolved.");
  if (input.to !== "completed" && input.to !== "dismissed") throw new DomainError("VALIDATION", "to must be completed or dismissed.");
  if (context.actingAsLearner && input.to !== "completed") throw new DomainError("VALIDATION", "Learners can only mark remediation as completed.");
  const reason = input.to === "dismissed" ? requireReason(input.reason) : null;
  const record: RemediationAssignmentRecord = Object.freeze({
    ...assignment,
    state: input.to,
    stateReason: reason,
    revision: assignment.revision + 1,
    resolvedAt: at(ctx),
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "remediation.resolve",
      object: { kind: "remediation_assignment", id: assignment.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { to: record.state, learnerUid: assignment.learnerUid },
    },
  };
}
