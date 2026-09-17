/**
 * Assessment delivery: assessments, assignments to class groups, and the
 * attempt lifecycle (start, save, submit, review, release, return).
 *
 * Academic rules come from policies resolved for the course, never from
 * constants here:
 *   - assessment.attempt_limit   how many attempts a learner may start
 *   - learning.late_work         whether and how late work is accepted
 *   - assessment.result_release  when learners see results
 *   - learning.revision          whether graded work can be returned for revision
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { ATTEMPT_MACHINE, assertTransition, type AttemptState } from "../domain/states.ts";
import { assertRevision, parseInstant, parseOptionalText, parseRequiredRevision, parseTitle } from "../domain/text.ts";
import { isAssessmentMode, type AssessmentMode } from "../domain/vocabulary.ts";
import { assertVisible } from "../governance/soft-delete.ts";
import type { VersionRecord } from "../governance/versioning.ts";
import type { AttemptLimitPolicy, LateWorkPolicy, ResultReleaseMode, RevisionPolicy } from "../policies/registry.ts";
import type { CourseRecord, Planned, StructureContext } from "../structure/catalog.ts";
import type { ClassGroupRecord } from "../structure/delivery.ts";
import { maxPoints, type AssessmentContent } from "./content.ts";
import { applyReview, autoGrade, parseResponses, scoreOf, type ItemResult, type Responses } from "./grading.ts";

export interface AssessmentRecord {
  readonly id: string;
  readonly courseId: string;
  readonly mode: AssessmentMode;
  readonly title: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface AssessmentVersionRecord extends VersionRecord {
  readonly revision: number;
}

export const ASSIGNMENT_STATES = ["active", "cancelled"] as const;
export type AssignmentState = (typeof ASSIGNMENT_STATES)[number];

export interface AssignmentRecord {
  readonly id: string;
  readonly classGroupId: string;
  readonly courseId: string;
  readonly assessmentId: string;
  readonly assessmentVersionId: string;
  readonly mode: AssessmentMode;
  readonly title: string;
  readonly opensAt: string;
  readonly dueAt: string | null;
  readonly state: AssignmentState;
  readonly cancelReason: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export type AttemptKind = "attempt" | "revision";

export interface AttemptRecord {
  readonly id: string;
  readonly assignmentId: string;
  readonly classGroupId: string;
  readonly learnerUid: string;
  readonly attemptNumber: number;
  readonly kind: AttemptKind;
  readonly revisionOfAttemptId: string | null;
  readonly state: AttemptState;
  readonly responses: Responses;
  readonly itemResults: readonly ItemResult[] | null;
  readonly earnedPoints: number | null;
  readonly maxPoints: number;
  readonly scorePercent: number | null;
  readonly isLate: boolean;
  readonly startedAt: string;
  readonly submittedAt: string | null;
  readonly gradedBy: string | null;
  readonly gradedAt: string | null;
  readonly feedback: string | null;
  readonly releasedAt: string | null;
  readonly revision: number;
  readonly updatedAt: string;
}

function now(ctx: StructureContext): Date {
  return (ctx.clock ?? systemClock)();
}

// ---------------------------------------------------------------------------
// Assessments and assignments
// ---------------------------------------------------------------------------

export function planCreateAssessment(
  input: { readonly course: CourseRecord; readonly mode: unknown; readonly title: unknown },
  ctx: StructureContext,
): Planned<AssessmentRecord> {
  assertVisible(input.course);
  if (!isAssessmentMode(input.mode)) throw new DomainError("VALIDATION", "Unknown assessment mode.");
  const record: AssessmentRecord = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    courseId: input.course.id,
    mode: input.mode,
    title: parseTitle(input.title, "title"),
    createdBy: parseUid(ctx.actor.uid, "actor"),
    createdAt: toIso(now(ctx)),
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "assessment.create",
      object: { kind: "assessment", id: record.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [{ change: "linked", relationship: "course_assessments", from: { kind: "course", id: record.courseId }, to: { kind: "assessment", id: record.id } }],
      metadata: { mode: record.mode, title: record.title },
    },
  };
}

export function planCreateAssignment(
  input: {
    readonly classGroup: ClassGroupRecord;
    readonly assessment: AssessmentRecord;
    readonly version: AssessmentVersionRecord;
    readonly opensAt: unknown;
    readonly dueAt?: unknown;
  },
  ctx: StructureContext,
): Planned<AssignmentRecord> {
  assertVisible(input.classGroup);
  if (input.classGroup.status !== "planned" && input.classGroup.status !== "active") {
    throw new DomainError("CONFLICT", "Assessments can only be assigned to a planned or active class group.");
  }
  if (input.assessment.courseId !== input.classGroup.courseId) {
    throw new DomainError("VALIDATION", "This assessment belongs to a different course.");
  }
  if (input.version.parentId !== input.assessment.id || input.version.state !== "published") {
    throw new DomainError("CONFLICT", "Only a published version of this assessment can be assigned.");
  }
  const opensAt = parseInstant(input.opensAt, "opensAt");
  const dueAt = input.dueAt === undefined || input.dueAt === null || input.dueAt === "" ? null : parseInstant(input.dueAt, "dueAt");
  if (dueAt !== null && Date.parse(dueAt) <= Date.parse(opensAt)) {
    throw new DomainError("VALIDATION", "The due time must be after the opening time.");
  }
  const uid = parseUid(ctx.actor.uid, "actor");
  const at = toIso(now(ctx));
  const record: AssignmentRecord = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    classGroupId: input.classGroup.id,
    courseId: input.classGroup.courseId,
    assessmentId: input.assessment.id,
    assessmentVersionId: input.version.id,
    mode: input.assessment.mode,
    title: input.assessment.title,
    opensAt,
    dueAt,
    state: "active",
    cancelReason: null,
    revision: 1,
    createdBy: uid,
    createdAt: at,
    updatedBy: uid,
    updatedAt: at,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "assessment_assignment.create",
      object: { kind: "assessment_assignment", id: record.id },
      newVersionId: input.version.id,
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [
        { change: "linked", relationship: "class_group_assignments", from: { kind: "class_group", id: record.classGroupId }, to: { kind: "assessment_assignment", id: record.id } },
      ],
      metadata: { assessmentId: record.assessmentId, mode: record.mode, opensAt, dueAt },
    },
  };
}

export function planCancelAssignment(
  assignment: AssignmentRecord,
  input: { readonly reason: unknown; readonly expectedRevision: unknown },
  ctx: StructureContext,
): Planned<AssignmentRecord> {
  assertRevision(assignment.revision, parseRequiredRevision(input.expectedRevision));
  if (assignment.state !== "active") throw new DomainError("CONFLICT", "This assignment is already cancelled.");
  const reason = requireReason(input.reason);
  const record: AssignmentRecord = Object.freeze({
    ...assignment,
    state: "cancelled",
    cancelReason: reason,
    revision: assignment.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: toIso(now(ctx)),
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "assessment_assignment.cancel",
      object: { kind: "assessment_assignment", id: assignment.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { classGroupId: assignment.classGroupId, revision: record.revision },
    },
  };
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

/** Whether work may still be handed in, and whether it counts as late. */
export function lateness(assignment: AssignmentRecord, policy: LateWorkPolicy, at: Date): { readonly open: boolean; readonly late: boolean } {
  if (assignment.dueAt === null) return { open: true, late: false };
  const due = Date.parse(assignment.dueAt);
  if (at.getTime() <= due) return { open: true, late: false };
  if (!policy.acceptLateSubmissions) return { open: false, late: true };
  if (policy.latestHoursAfterDue !== null && at.getTime() > due + policy.latestHoursAfterDue * 3_600_000) {
    return { open: false, late: true };
  }
  return { open: true, late: policy.markAsLate };
}

function assertOpenAssignment(assignment: AssignmentRecord, at: Date): void {
  if (assignment.state !== "active") throw new DomainError("CONFLICT", "This assignment has been cancelled.");
  if (at.getTime() < Date.parse(assignment.opensAt)) throw new DomainError("NOT_YET_AVAILABLE", "This assessment is not open yet.");
}

export interface StartAttemptInput {
  readonly assignment: AssignmentRecord;
  readonly content: AssessmentContent;
  readonly learnerUid: string;
  /** This learner's attempts on this assignment. */
  readonly existing: readonly AttemptRecord[];
  readonly attemptLimit: AttemptLimitPolicy;
  readonly revisionPolicy: RevisionPolicy;
  readonly lateWork: LateWorkPolicy;
}

export function planStartAttempt(input: StartAttemptInput, ctx: StructureContext): AttemptRecord {
  const learnerUid = parseUid(input.learnerUid, "learner");
  const at = now(ctx);
  assertOpenAssignment(input.assignment, at);
  if (!lateness(input.assignment, input.lateWork, at).open) {
    throw new DomainError("CONFLICT", "The deadline for this assessment has passed.");
  }
  const mine = input.existing.filter((a) => a.learnerUid === learnerUid && a.assignmentId === input.assignment.id);
  if (mine.some((a) => a.state === "in_progress")) {
    throw new DomainError("CONFLICT", "You already have an attempt in progress.");
  }
  const latest = [...mine].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

  let kind: AttemptKind = "attempt";
  let revisionOf: string | null = null;
  if (latest && latest.state === "returned") {
    const revisionsUsed = mine.filter((a) => a.kind === "revision").length;
    if (!input.revisionPolicy.revisionAllowed || (input.revisionPolicy.maxRevisions !== null && revisionsUsed >= input.revisionPolicy.maxRevisions)) {
      throw new DomainError("CONFLICT", "No revisions are left for this assessment.");
    }
    kind = "revision";
    revisionOf = latest.id;
  } else {
    const attemptsUsed = mine.filter((a) => a.kind === "attempt").length;
    if (input.attemptLimit.maxAttempts !== null && attemptsUsed >= input.attemptLimit.maxAttempts) {
      throw new DomainError("CONFLICT", "No attempts are left for this assessment.");
    }
  }

  const stamp = toIso(at);
  return Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    assignmentId: input.assignment.id,
    classGroupId: input.assignment.classGroupId,
    learnerUid,
    attemptNumber: (latest?.attemptNumber ?? 0) + 1,
    kind,
    revisionOfAttemptId: revisionOf,
    state: ATTEMPT_MACHINE.initial,
    responses: {},
    itemResults: null,
    earnedPoints: null,
    maxPoints: maxPoints(input.content),
    scorePercent: null,
    isLate: false,
    startedAt: stamp,
    submittedAt: null,
    gradedBy: null,
    gradedAt: null,
    feedback: null,
    releasedAt: null,
    revision: 1,
    updatedAt: stamp,
  });
}

function assertOwnInProgress(attempt: AttemptRecord, learnerUid: string, expectedRevision: unknown): void {
  // Someone else's attempt is reported exactly like a missing one.
  if (attempt.learnerUid !== learnerUid) throw new DomainError("NOT_FOUND", "Attempt not found.");
  assertRevision(attempt.revision, parseRequiredRevision(expectedRevision));
  if (attempt.state !== "in_progress") throw new DomainError("CONFLICT", "This attempt has already been submitted.");
}

export function planSaveResponses(
  attempt: AttemptRecord,
  input: { readonly responses: unknown; readonly expectedRevision: unknown },
  context: { readonly content: AssessmentContent; readonly learnerUid: string },
  ctx: StructureContext,
): AttemptRecord {
  assertOwnInProgress(attempt, context.learnerUid, input.expectedRevision);
  return Object.freeze({
    ...attempt,
    responses: parseResponses(context.content, input.responses),
    revision: attempt.revision + 1,
    updatedAt: toIso(now(ctx)),
  });
}

export interface SubmitContext {
  readonly learnerUid: string;
  readonly assignment: AssignmentRecord;
  readonly content: AssessmentContent;
  readonly lateWork: LateWorkPolicy;
  readonly releaseMode: ResultReleaseMode;
}

export function planSubmitAttempt(
  attempt: AttemptRecord,
  input: { readonly responses?: unknown; readonly expectedRevision: unknown },
  context: SubmitContext,
  ctx: StructureContext,
): { readonly record: AttemptRecord; readonly audit: AuditEventInput } {
  assertOwnInProgress(attempt, context.learnerUid, input.expectedRevision);
  const at = now(ctx);
  if (context.assignment.state !== "active") throw new DomainError("CONFLICT", "This assignment has been cancelled.");
  const timing = lateness(context.assignment, context.lateWork, at);
  if (!timing.open) throw new DomainError("CONFLICT", "The deadline for this assessment has passed.");

  const responses = input.responses === undefined ? attempt.responses : parseResponses(context.content, input.responses);
  const grade = autoGrade(context.content, responses);
  const needsPerson = grade.pendingReview || context.releaseMode === "after_teacher_review";
  const state: AttemptState = needsPerson ? "needs_review" : "graded";
  assertTransition(ATTEMPT_MACHINE, attempt.state, state);
  const stamp = toIso(at);
  const score = needsPerson ? null : scoreOf(grade.items);

  const record: AttemptRecord = Object.freeze({
    ...attempt,
    state,
    responses,
    itemResults: grade.items,
    earnedPoints: score?.earnedPoints ?? null,
    maxPoints: grade.maxPoints,
    scorePercent: score?.scorePercent ?? null,
    isLate: timing.late,
    submittedAt: stamp,
    gradedAt: needsPerson ? null : stamp,
    releasedAt: !needsPerson && context.releaseMode === "immediate" ? stamp : null,
    revision: attempt.revision + 1,
    updatedAt: stamp,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "assessment_attempt.submit",
      object: { kind: "assessment_attempt", id: attempt.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { assignmentId: attempt.assignmentId, attemptNumber: attempt.attemptNumber, kind: attempt.kind, state, isLate: timing.late },
    },
  };
}

export function planGradeAttempt(
  attempt: AttemptRecord,
  input: { readonly scores?: unknown; readonly feedback?: unknown; readonly expectedRevision: unknown },
  context: { readonly releaseMode: ResultReleaseMode },
  ctx: StructureContext,
): { readonly record: AttemptRecord; readonly audit: AuditEventInput } {
  assertRevision(attempt.revision, parseRequiredRevision(input.expectedRevision));
  assertTransition(ATTEMPT_MACHINE, attempt.state, "graded");
  if (!attempt.itemResults) throw new DomainError("CONFLICT", "This attempt has no answers to grade.");
  const results = applyReview(attempt.itemResults, input.scores ?? {});
  const score = scoreOf(results);
  const stamp = toIso(now(ctx));
  const record: AttemptRecord = Object.freeze({
    ...attempt,
    state: "graded",
    itemResults: results,
    earnedPoints: score.earnedPoints,
    scorePercent: score.scorePercent,
    feedback: parseOptionalText(input.feedback, "feedback", 10_000),
    gradedBy: parseUid(ctx.actor.uid, "actor"),
    gradedAt: stamp,
    releasedAt: context.releaseMode === "manual_release" ? null : stamp,
    revision: attempt.revision + 1,
    updatedAt: stamp,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "assessment_attempt.grade",
      object: { kind: "assessment_attempt", id: attempt.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { assignmentId: attempt.assignmentId, learnerUid: attempt.learnerUid, scorePercent: score.scorePercent, released: record.releasedAt !== null },
    },
  };
}

export function planReleaseAttempt(
  attempt: AttemptRecord,
  input: { readonly expectedRevision: unknown },
  ctx: StructureContext,
): { readonly record: AttemptRecord; readonly audit: AuditEventInput } {
  assertRevision(attempt.revision, parseRequiredRevision(input.expectedRevision));
  if (attempt.state !== "graded") throw new DomainError("CONFLICT", "Only graded work can be released.");
  if (attempt.releasedAt !== null) throw new DomainError("CONFLICT", "This result has already been released.");
  const stamp = toIso(now(ctx));
  const record: AttemptRecord = Object.freeze({ ...attempt, releasedAt: stamp, revision: attempt.revision + 1, updatedAt: stamp });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "assessment_attempt.release",
      object: { kind: "assessment_attempt", id: attempt.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { assignmentId: attempt.assignmentId, learnerUid: attempt.learnerUid },
    },
  };
}

export function planReturnAttempt(
  attempt: AttemptRecord,
  input: { readonly feedback: unknown; readonly expectedRevision: unknown },
  context: { readonly revisionPolicy: RevisionPolicy; readonly revisionsUsed: number },
  ctx: StructureContext,
): { readonly record: AttemptRecord; readonly audit: AuditEventInput } {
  assertRevision(attempt.revision, parseRequiredRevision(input.expectedRevision));
  assertTransition(ATTEMPT_MACHINE, attempt.state, "returned");
  const policy = context.revisionPolicy;
  if (!policy.revisionAllowed || (policy.maxRevisions !== null && context.revisionsUsed >= policy.maxRevisions)) {
    throw new DomainError("CONFLICT", "Revision is not available for this assessment.");
  }
  const feedback = parseOptionalText(input.feedback, "feedback", 10_000);
  if (!feedback) throw new DomainError("VALIDATION", "Explain what to revise.");
  const stamp = toIso(now(ctx));
  const record: AttemptRecord = Object.freeze({
    ...attempt,
    state: "returned",
    feedback,
    releasedAt: attempt.releasedAt ?? stamp,
    revision: attempt.revision + 1,
    updatedAt: stamp,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "assessment_attempt.return",
      object: { kind: "assessment_attempt", id: attempt.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { assignmentId: attempt.assignmentId, learnerUid: attempt.learnerUid, revisionsUsed: context.revisionsUsed },
    },
  };
}

/**
 * What a learner receives about an assignment: when it opens and is due, never
 * staff identifiers, the internal version pinned to it or administrative fields.
 */
export function learnerAssignmentView(assignment: AssignmentRecord) {
  return {
    id: assignment.id,
    classGroupId: assignment.classGroupId,
    mode: assignment.mode,
    title: assignment.title,
    opensAt: assignment.opensAt,
    dueAt: assignment.dueAt,
    state: assignment.state,
  };
}

/** What a learner sees of their own attempt: results and feedback only once released. */
export function learnerAttemptView(attempt: AttemptRecord) {
  const released = attempt.releasedAt !== null;
  return {
    id: attempt.id,
    assignmentId: attempt.assignmentId,
    attemptNumber: attempt.attemptNumber,
    kind: attempt.kind,
    state: attempt.state === "needs_review" || (attempt.state === "graded" && !released) ? "submitted" : attempt.state,
    responses: attempt.responses,
    isLate: attempt.isLate,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    revision: attempt.revision,
    result: released
      ? {
          itemResults: attempt.itemResults,
          earnedPoints: attempt.earnedPoints,
          maxPoints: attempt.maxPoints,
          scorePercent: attempt.scorePercent,
          feedback: attempt.feedback,
          releasedAt: attempt.releasedAt,
        }
      : null,
  };
}

export function parseAssignmentId(value: unknown): string {
  return parseUuid(value, "assignmentId");
}
