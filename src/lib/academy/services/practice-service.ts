/**
 * Participants' side of 2C content: the practice shelf of a class group,
 * opening and completing published content, remediation, and reports.
 *
 * Content is reachable only through an active link from a published item to
 * the class group's course. Learners receive answer-free projections;
 * results and remediation are visible to the learner, the class group's
 * teachers and administrators.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUid, parseUuid } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import { authorize, evaluateAccess, type RelationshipFacts } from "../permissions/permissions.ts";
import { parseProductionContent, projectProductionContent, SCORED_KINDS, scoredItemsOf } from "../production/content.ts";
import { matchingRules, planAssignRemediation, planPracticeResult, planResolveRemediation } from "../production/practice.ts";
import { expectRows } from "../repo/audit-repo.ts";
import { mapAssignmentRow, mapAttemptRow, selectAssignmentQuery, selectAttemptQuery } from "../repo/assessment-repo.ts";
import { countOf } from "../repo/catalog-repo.ts";
import { mapClassGroupRow, selectClassGroupQuery } from "../repo/delivery-repo.ts";
import {
  countActiveCourseLinksQuery,
  insertPracticeResultQuery,
  insertRemediationQuery,
  listActiveAssessmentRulesQuery,
  listCourseContentQuery,
  listLearnerPracticeResultsQuery,
  listLearnerRemediationQuery,
  mapItemRow,
  mapItemVersionRow,
  mapPracticeResultRow,
  mapRemediationRow,
  mapRuleRow,
  resolveRemediationQuery,
  selectClassGroupReportQuery,
  selectItemQuery,
  selectPublishedItemVersionQuery,
  selectRemediationQuery,
  storedVersionData,
} from "../repo/production-repo.ts";
import { num, numOrNull, str, strOrNull } from "../repo/rows.ts";
import type { ClassGroupRecord } from "../structure/delivery.ts";
import { audited, contextFor, loadMany, loadOptional, runGuarded, type ServiceDeps } from "./support.ts";

export interface PracticeDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
}

type Correlated = { readonly correlationId?: string | null };

export function createPracticeService(deps: PracticeDeps) {
  const { executor, facts } = deps;

  async function loadGroupFor(user: AuthUser, classGroupId: unknown): Promise<ClassGroupRecord> {
    const group = await loadOptional(executor, selectClassGroupQuery(parseUuid(classGroupId, "classGroupId")), mapClassGroupRow);
    if (!group || group.deletedAt !== null) {
      if (user.role === "admin") throw new DomainError("NOT_FOUND", "Class group not found.");
      throw new AuthError("FORBIDDEN");
    }
    return group;
  }

  async function viewGroup(user: AuthUser, classGroupId: unknown): Promise<ClassGroupRecord> {
    const group = await loadGroupFor(user, classGroupId);
    await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
    return group;
  }

  /** Teachers of the class group and administrators. */
  async function isStaffOf(user: AuthUser, group: ClassGroupRecord): Promise<boolean> {
    if (user.role === "student") return false;
    return (await evaluateAccess(user, { action: "class_group.read_roster", classGroupId: group.id }, facts)).allowed;
  }

  async function openLinkedItem(group: ClassGroupRecord, itemId: unknown) {
    const id = parseUuid(itemId, "itemId");
    if (countOf(await executor.query(countActiveCourseLinksQuery(id, group.courseId, null))) === 0) {
      throw new DomainError("NOT_FOUND", "Content not found.");
    }
    const item = await loadOptional(executor, selectItemQuery(id), mapItemRow);
    const rows = await executor.query(selectPublishedItemVersionQuery(id));
    if (!item || rows.length === 0) throw new DomainError("NOT_FOUND", "Content not found.");
    const version = mapItemVersionRow(rows[0]);
    const content = parseProductionContent(item.kind, storedVersionData(rows[0]).content);
    return { item, version, content };
  }

  return {
    async classGroupContent(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await viewGroup(user, classGroupId);
      const rows = await executor.query(listCourseContentQuery(group.courseId));
      return rows.map((row) => ({
        linkId: str(row.link_id),
        itemId: str(row.item_id),
        kind: str(row.kind),
        title: str(row.title),
        purpose: str(row.purpose),
        target: { kind: str(row.target_kind), id: str(row.target_id) },
      }));
    },

    async openContent(user: AuthUser, classGroupId: unknown, itemId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await viewGroup(user, classGroupId);
      const { item, version, content } = await openLinkedItem(group, itemId);
      const staff = await isStaffOf(user, group);
      return {
        item: { id: item.id, kind: item.kind, title: item.title },
        versionId: version.id,
        publishedAt: version.publishedAt,
        content: staff ? content : projectProductionContent(item.kind, content),
      };
    },

    async submitPractice(
      user: AuthUser,
      classGroupId: unknown,
      itemId: unknown,
      input: { readonly responses: unknown; readonly durationSeconds?: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      if (user.role !== "student") throw new AuthError("FORBIDDEN");
      const group = await viewGroup(user, classGroupId);
      const { item, version, content } = await openLinkedItem(group, itemId);
      if (!SCORED_KINDS.includes(item.kind)) throw new DomainError("VALIDATION", "This content has no answers to submit.");
      const scored = scoredItemsOf(item.kind, content);
      if (!scored) throw new DomainError("VALIDATION", "This content has no answers to submit.");
      const record = planPracticeResult(
        { itemId: item.id, itemVersionId: version.id, classGroupId: group.id, learnerUid: user.uid, scored, responses: input.responses, durationSeconds: input.durationSeconds },
        contextFor(user, deps),
      );
      await runGuarded(executor, [expectRows(insertPracticeResultQuery(record), 1)]);
      return { id: record.id, itemId: record.itemId, scorePercent: record.scorePercent, itemResults: record.itemResults, completedAt: record.completedAt };
    },

    /** Learners: their own results. Staff: a named learner's results. */
    async practiceResults(user: AuthUser, classGroupId: unknown, options: { readonly learnerUid?: unknown } = {}) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await viewGroup(user, classGroupId);
      let learnerUid = user.uid;
      if (user.role !== "student") {
        if (!(await isStaffOf(user, group))) throw new AuthError("FORBIDDEN");
        learnerUid = parseUid(options.learnerUid, "learnerUid");
      }
      return loadMany(executor, listLearnerPracticeResultsQuery(group.id, learnerUid), mapPracticeResultRow);
    },

    async remediation(user: AuthUser, classGroupId: unknown, options: { readonly learnerUid?: unknown } = {}) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await viewGroup(user, classGroupId);
      let learnerUid = user.uid;
      if (user.role !== "student") {
        if (!(await isStaffOf(user, group))) throw new AuthError("FORBIDDEN");
        learnerUid = parseUid(options.learnerUid, "learnerUid");
      }
      return loadMany(executor, listLearnerRemediationQuery(group.id, learnerUid), mapRemediationRow);
    },

    /** Applies the academy's remediation rules to a released assessment result. */
    async applyRemediationRules(user: AuthUser, attemptId: unknown, input: Correlated = {}) {
      assertAcademyCoreAvailable(deps.flags);
      const attempt = await loadOptional(executor, selectAttemptQuery(parseUuid(attemptId, "attemptId")), mapAttemptRow);
      if (!attempt) throw new DomainError("NOT_FOUND", "Attempt not found.");
      await authorize(user, { action: "assessment.grade", classGroupId: attempt.classGroupId }, facts);
      const assignment = await loadOptional(executor, selectAssignmentQuery(attempt.assignmentId), mapAssignmentRow);
      if (!assignment) throw new DomainError("NOT_FOUND", "Assignment not found.");
      const rules = matchingRules(await loadMany(executor, listActiveAssessmentRulesQuery(assignment.assessmentId), mapRuleRow), assignment.assessmentId, attempt);
      const open = (await loadMany(executor, listLearnerRemediationQuery(attempt.classGroupId, attempt.learnerUid), mapRemediationRow)).filter((a) => a.state === "assigned");
      const ctx = contextFor(user, deps, input.correlationId);
      const plans = [];
      const seenItems = new Set(open.map((a) => a.itemId));
      for (const rule of rules) {
        if (seenItems.has(rule.itemId)) continue;
        seenItems.add(rule.itemId);
        plans.push(planAssignRemediation({ classGroupId: attempt.classGroupId, learnerUid: attempt.learnerUid, itemId: rule.itemId, ruleId: rule.id, sourceAttemptId: attempt.id, openForLearner: open }, ctx));
      }
      if (plans.length > 0) {
        await runGuarded(executor, plans.map((plan) => audited(deps, insertRemediationQuery(plan.record), plan.audit)), {
          unique: "Remediation was assigned by someone else at the same time. Reload and try again.",
        });
      }
      return { assigned: plans.map((plan) => plan.record), matchedRules: rules.length };
    },

    /** A teacher assigns a remediation item linked to the course to one learner. */
    async assignRemediation(
      user: AuthUser,
      classGroupId: unknown,
      input: Correlated & { readonly learnerUid: unknown; readonly itemId: unknown; readonly note?: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadGroupFor(user, classGroupId);
      await authorize(user, { action: "feedback.write", classGroupId: group.id }, facts);
      const learnerUid = parseUid(input.learnerUid, "learnerUid");
      if (!(await facts.isActiveLearnerOfClassGroup(learnerUid, group.id))) throw new DomainError("VALIDATION", "This learner is not active in the class group.");
      const itemId = parseUuid(input.itemId, "itemId");
      if (countOf(await executor.query(countActiveCourseLinksQuery(itemId, group.courseId, "remediation"))) === 0) {
        throw new DomainError("VALIDATION", "This item is not linked to the course for remediation.");
      }
      const open = await loadMany(executor, listLearnerRemediationQuery(group.id, learnerUid), mapRemediationRow);
      const plan = planAssignRemediation(
        { classGroupId: group.id, learnerUid, itemId, ruleId: null, sourceAttemptId: null, note: input.note, openForLearner: open },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(executor, [audited(deps, insertRemediationQuery(plan.record), plan.audit)], { unique: "This learner already has this remediation assigned." });
      return plan.record;
    },

    async resolveRemediation(
      user: AuthUser,
      assignmentId: unknown,
      input: Correlated & { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      const assignment = await loadOptional(executor, selectRemediationQuery(parseUuid(assignmentId, "assignmentId")), mapRemediationRow);
      if (!assignment) throw new DomainError("NOT_FOUND", "Remediation not found.");
      const actingAsLearner = user.role === "student";
      if (actingAsLearner) {
        if (assignment.learnerUid !== user.uid) throw new DomainError("NOT_FOUND", "Remediation not found.");
      } else {
        await authorize(user, { action: "feedback.write", classGroupId: assignment.classGroupId }, facts);
      }
      const plan = planResolveRemediation(assignment, input, { actingAsLearner }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, resolveRemediationQuery(plan.record, assignment.revision), plan.audit)]);
      return plan.record;
    },

    /** Class group report for its teachers and administrators. */
    async classGroupReport(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadGroupFor(user, classGroupId);
      await authorize(user, { action: "class_group.read_roster", classGroupId: group.id }, facts);
      const rows = await executor.query(selectClassGroupReportQuery(group.id));
      return rows.map((row) => {
        const recorded = num(row.attendance_recorded ?? 0);
        const attended = num(row.attendance_attended ?? 0);
        return {
          learnerUid: str(row.learner_uid),
          displayName: strOrNull(row.full_name),
          enrollmentState: str(row.enrollment_state),
          attendance: { recordedSessions: recorded, attendedSessions: attended, attendedRatio: recorded === 0 ? null : attended / recorded },
          assessmentAveragePercent: numOrNull(row.assessment_average),
          practiceItemsCompleted: num(row.practice_items ?? 0),
          openRemediation: num(row.open_remediation ?? 0),
        };
      });
    },
  };
}

export type PracticeService = ReturnType<typeof createPracticeService>;
