/**
 * Learner progress and course completion.
 *
 * Progress is academic, not gamified: lessons taught and attended,
 * attendance, and released assessment results. There are no points, XP or
 * streaks here.
 *
 * A lesson counts as completed for a learner when a session teaching it has
 * been completed and the learner's attendance for it counts as attended.
 * (Watching a recording as an alternative is decided with recordings.)
 *
 * Completion eligibility applies the academy's `completion.criteria` policy
 * for the course. Recording a completion without meeting every criterion is
 * possible only as an explicit, reasoned, audited override.
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, parseUid, systemClock, toIso } from "../domain/ids.ts";
import { ENROLLMENT_MACHINE, assertTransition } from "../domain/states.ts";
import type { AssessmentMode } from "../domain/vocabulary.ts";
import type { CompletionCriteriaPolicy } from "../policies/registry.ts";
import type { StructureContext } from "../structure/catalog.ts";
import type { EnrollmentRecord } from "../structure/delivery.ts";
import type { AttendanceSummary } from "./attendance.ts";

export type AssessmentStatus = "not_started" | "in_progress" | "awaiting_result" | "graded" | "returned";

export interface AssessmentProgress {
  readonly assignmentId: string;
  readonly mode: AssessmentMode;
  readonly title: string;
  readonly status: AssessmentStatus;
  /** Best released score, if any. */
  readonly bestScorePercent: number | null;
}

export interface ProgressSnapshot {
  readonly lessons: { readonly total: number; readonly completed: number };
  readonly attendance: AttendanceSummary;
  readonly assessments: readonly AssessmentProgress[];
}

export interface CriterionCheck {
  readonly criterion: "all_lessons_completed" | "minimum_attendance" | "required_assessment" | "minimum_assessment_score";
  readonly met: boolean;
  readonly detail: Record<string, unknown>;
}

export interface CompletionEvaluation {
  readonly eligible: boolean;
  readonly checks: readonly CriterionCheck[];
}

function bestScoreForMode(progress: ProgressSnapshot, mode: AssessmentMode): number | null {
  const scores = progress.assessments.filter((a) => a.mode === mode && a.bestScorePercent !== null).map((a) => a.bestScorePercent as number);
  return scores.length === 0 ? null : Math.max(...scores);
}

export function evaluateCompletion(progress: ProgressSnapshot, criteria: CompletionCriteriaPolicy): CompletionEvaluation {
  const checks: CriterionCheck[] = [];

  if (criteria.requireAllLessonsCompleted) {
    checks.push({
      criterion: "all_lessons_completed",
      met: progress.lessons.total > 0 && progress.lessons.completed >= progress.lessons.total,
      detail: { completed: progress.lessons.completed, total: progress.lessons.total },
    });
  }

  if (criteria.minimumAttendedRatio !== null) {
    const ratio = progress.attendance.attendedRatio;
    checks.push({
      criterion: "minimum_attendance",
      met: ratio !== null && ratio >= criteria.minimumAttendedRatio,
      detail: { attendedRatio: ratio, minimum: criteria.minimumAttendedRatio },
    });
  }

  for (const mode of criteria.requiredAssessmentModes) {
    const best = bestScoreForMode(progress, mode);
    checks.push({ criterion: "required_assessment", met: best !== null, detail: { mode, bestScorePercent: best } });
    if (criteria.minimumAssessmentScorePercent !== null) {
      checks.push({
        criterion: "minimum_assessment_score",
        met: best !== null && best >= criteria.minimumAssessmentScorePercent,
        detail: { mode, bestScorePercent: best, minimum: criteria.minimumAssessmentScorePercent },
      });
    }
  }

  return { eligible: checks.every((check) => check.met), checks };
}

export interface CompletionRecord {
  readonly id: string;
  readonly enrollmentId: string;
  readonly classGroupId: string;
  readonly courseId: string;
  readonly learnerUid: string;
  readonly completedAt: string;
  readonly decidedBy: string;
  readonly metAllCriteria: boolean;
  readonly criteriaSnapshot: { readonly criteria: CompletionCriteriaPolicy; readonly evaluation: CompletionEvaluation };
  readonly overrideReason: string | null;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
}

export interface RecordCompletionPlan {
  readonly completion: CompletionRecord;
  readonly enrollment: EnrollmentRecord;
  readonly audits: readonly AuditEventInput[];
}

export function planRecordCompletion(
  input: {
    readonly enrollment: EnrollmentRecord;
    readonly criteria: CompletionCriteriaPolicy;
    readonly evaluation: CompletionEvaluation;
    readonly overrideReason?: unknown;
    readonly expectedRevision: unknown;
  },
  ctx: StructureContext,
): RecordCompletionPlan {
  const enrollment = input.enrollment;
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== enrollment.revision) {
    throw new DomainError("CONFLICT", "This enrollment was changed by someone else. Reload and try again.");
  }
  assertTransition(ENROLLMENT_MACHINE, enrollment.state, "completed");
  let overrideReason: string | null = null;
  if (!input.evaluation.eligible) {
    if (input.overrideReason === undefined || input.overrideReason === null || input.overrideReason === "") {
      throw new DomainError("CONFLICT", "The completion criteria are not met. Give a reason to record completion anyway.");
    }
    overrideReason = requireReason(input.overrideReason);
  }
  const uid = parseUid(ctx.actor.uid, "actor");
  const stamp = toIso((ctx.clock ?? systemClock)());
  const completion: CompletionRecord = Object.freeze({
    id: (ctx.newId ?? defaultIdGenerator)(),
    enrollmentId: enrollment.id,
    classGroupId: enrollment.classGroupId,
    courseId: enrollment.courseId,
    learnerUid: enrollment.learnerUid,
    completedAt: stamp,
    decidedBy: uid,
    metAllCriteria: input.evaluation.eligible,
    criteriaSnapshot: { criteria: input.criteria, evaluation: input.evaluation },
    overrideReason,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
  });
  const nextEnrollment: EnrollmentRecord = Object.freeze({
    ...enrollment,
    state: "completed",
    stateReason: overrideReason,
    revision: enrollment.revision + 1,
    updatedBy: uid,
    updatedAt: stamp,
    endedAt: stamp,
  });
  return {
    completion,
    enrollment: nextEnrollment,
    audits: [
      {
        actor: ctx.actor,
        action: "completion.record",
        object: { kind: "completion", id: completion.id },
        reason: overrideReason,
        correlationId: ctx.correlationId ?? null,
        metadata: { enrollmentId: enrollment.id, learnerUid: enrollment.learnerUid, metAllCriteria: completion.metAllCriteria, override: overrideReason !== null },
      },
      {
        actor: ctx.actor,
        action: "enrollment.change_status",
        object: { kind: "enrollment", id: enrollment.id },
        reason: overrideReason,
        correlationId: ctx.correlationId ?? null,
        metadata: { from: enrollment.state, to: "completed", learnerUid: enrollment.learnerUid, classGroupId: enrollment.classGroupId, revision: nextEnrollment.revision },
      },
    ],
  };
}

export function planRevokeCompletion(
  completion: CompletionRecord,
  input: { readonly reason: unknown },
  ctx: StructureContext,
): { readonly record: CompletionRecord; readonly audit: AuditEventInput } {
  if (completion.revokedAt !== null) throw new DomainError("CONFLICT", "This completion is already revoked.");
  const reason = requireReason(input.reason);
  const record: CompletionRecord = Object.freeze({
    ...completion,
    revokedAt: toIso((ctx.clock ?? systemClock)()),
    revokedBy: parseUid(ctx.actor.uid, "actor"),
    revokeReason: reason,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "completion.revoke",
      object: { kind: "completion", id: completion.id },
      reason,
      correlationId: ctx.correlationId ?? null,
      metadata: { enrollmentId: completion.enrollmentId, learnerUid: completion.learnerUid },
    },
  };
}
