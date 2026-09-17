/**
 * Administrative authoring of assessments: creation, governed versions of
 * item content (with answer keys), review and publication.
 *
 * Only administrators author and publish assessments. Answer keys are only
 * ever returned by these administrative reads.
 */
import type { AuthUser } from "../../auth/core.ts";
import type { AuditEventInput } from "../audit/audit.ts";
import { parseAssessmentContent, readStoredAssessmentContent, type AssessmentContent } from "../assessment/content.ts";
import { planCreateAssessment, type AssessmentVersionRecord } from "../assessment/delivery.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid } from "../domain/ids.ts";
import { parseRequiredRevision } from "../domain/text.ts";
import { parseReviewAction, reviewTransitionFor } from "../governance/review-actions.ts";
import { assertContentMutable, createDraftVersion, publishVersion, touchDraftVersion, transitionVersion } from "../governance/versioning.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorizeAdminAction, type AdminOnlyAction } from "../permissions/permissions.ts";
import {
  insertAssessmentQuery,
  insertAssessmentVersionQuery,
  listAssessmentVersionsQuery,
  listAssessmentsQuery,
  mapAssessmentRow,
  mapAssessmentVersionRow,
  selectAssessmentQuery,
  selectAssessmentVersionQuery,
  updateAssessmentVersionContentQuery,
  updateAssessmentVersionStateQuery,
} from "../repo/assessment-repo.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import { selectPublicationGateDefinitionQuery } from "../repo/curriculum-repo.ts";
import { audited, contextFor, loadMany, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

type Correlated = { readonly correlationId?: string | null };

const EMPTY: AssessmentContent = { instructions: null, items: [] };

export function createAssessmentAuthoringService(deps: ServiceDeps) {
  const { executor } = deps;

  function guard(user: AuthUser, action: AdminOnlyAction): void {
    assertAcademyCoreAvailable(deps.flags);
    authorizeAdminAction(user, action);
  }

  async function loadVersion(versionId: unknown): Promise<{ version: AssessmentVersionRecord; content: AssessmentContent }> {
    const rows = await executor.query(selectAssessmentVersionQuery(parseUuid(versionId, "versionId")));
    if (rows.length === 0) throw new DomainError("NOT_FOUND", "Assessment version not found.");
    return { version: mapAssessmentVersionRow(rows[0]), content: readStoredAssessmentContent(rows[0].content) };
  }

  function writeState(next: AssessmentVersionRecord, previous: AssessmentVersionRecord, audit: AuditEventInput): SqlQuery {
    return audited(deps, updateAssessmentVersionStateQuery(next, { revision: previous.revision, state: previous.state }), audit);
  }

  function bump(version: AssessmentVersionRecord, previousRevision: number): AssessmentVersionRecord {
    return Object.freeze({ ...version, revision: previousRevision + 1 });
  }

  return {
    async listAssessments(user: AuthUser, options: { readonly courseId?: unknown } = {}) {
      guard(user, "assessment.author");
      const courseId = options.courseId === undefined || options.courseId === null || options.courseId === "" ? null : parseUuid(options.courseId, "courseId");
      return loadMany(executor, listAssessmentsQuery(courseId), mapAssessmentRow);
    },

    async createAssessment(user: AuthUser, input: Correlated & { readonly courseId: unknown; readonly mode: unknown; readonly title: unknown }) {
      guard(user, "assessment.author");
      const course = await loadRequired(executor, selectCourseQuery(parseUuid(input.courseId, "courseId")), mapCourseRow, "Course not found.");
      const plan = planCreateAssessment({ course, mode: input.mode, title: input.title }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertAssessmentQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    async getAssessment(user: AuthUser, assessmentId: unknown) {
      guard(user, "assessment.author");
      const assessment = await loadRequired(executor, selectAssessmentQuery(parseUuid(assessmentId, "assessmentId")), mapAssessmentRow, "Assessment not found.");
      const versions = await loadMany(executor, listAssessmentVersionsQuery(assessment.id), mapAssessmentVersionRow);
      return { assessment, versions };
    },

    async getVersion(user: AuthUser, versionId: unknown) {
      guard(user, "assessment.author");
      return loadVersion(versionId);
    },

    async createDraft(user: AuthUser, assessmentId: unknown, input: Correlated & { readonly basedOnVersionId?: unknown } = {}) {
      guard(user, "assessment.author");
      const assessment = await loadRequired(executor, selectAssessmentQuery(parseUuid(assessmentId, "assessmentId")), mapAssessmentRow, "Assessment not found.");
      const existing = await loadMany(executor, listAssessmentVersionsQuery(assessment.id), mapAssessmentVersionRow);
      let basedOn: AssessmentVersionRecord | null;
      if (input.basedOnVersionId !== undefined && input.basedOnVersionId !== null && input.basedOnVersionId !== "") {
        const id = parseUuid(input.basedOnVersionId, "basedOnVersionId");
        basedOn = existing.find((v) => v.id === id) ?? null;
        if (!basedOn) throw new DomainError("VALIDATION", "A new version can only be based on a version of the same assessment.");
      } else {
        basedOn = existing.find((v) => v.state === "published") ?? null;
      }
      const content = basedOn ? (await loadVersion(basedOn.id)).content : EMPTY;
      const ctx = contextFor(user, deps, input.correlationId);
      const change = createDraftVersion(
        { versionKind: "assessment_version", parentKind: "assessment", parentId: assessment.id, existingVersions: existing, basedOn, newId: deps.newId },
        ctx,
      );
      const version: AssessmentVersionRecord = Object.freeze({ ...change.version, revision: 1 });
      await runGuarded(executor, [audited(deps, insertAssessmentVersionQuery(version, content), change.audit)], {
        unique: "A version is already being prepared for this assessment.",
      });
      return version;
    },

    async saveContent(user: AuthUser, versionId: unknown, input: Correlated & { readonly content: unknown; readonly expectedRevision: unknown }) {
      guard(user, "assessment.author");
      const { version } = await loadVersion(versionId);
      const expectedRevision = parseRequiredRevision(input.expectedRevision);
      assertContentMutable(version);
      if (version.revision !== expectedRevision) throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      const content = parseAssessmentContent(input.content);
      const ctx = contextFor(user, deps, input.correlationId);
      const next: AssessmentVersionRecord = Object.freeze({ ...touchDraftVersion(version, ctx), revision: version.revision + 1 });
      await runGuarded(executor, [
        audited(deps, updateAssessmentVersionContentQuery(next, content, expectedRevision), {
          actor: ctx.actor,
          action: "assessment_version.save_content",
          object: { kind: "assessment_version", id: version.id },
          newVersionId: version.id,
          correlationId: ctx.correlationId,
          metadata: { items: content.items.length, revision: next.revision },
        }),
      ]);
      return { version: next, content };
    },

    async review(user: AuthUser, versionId: unknown, input: Correlated & { readonly action: unknown; readonly reason?: unknown; readonly expectedRevision: unknown }) {
      guard(user, "assessment.author");
      const action = parseReviewAction(input.action);
      if (action === "approve") authorizeAdminAction(user, "assessment.publish");
      const { version, content } = await loadVersion(versionId);
      if (version.revision !== parseRequiredRevision(input.expectedRevision)) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      let selfApprovalAllowed = false;
      if (action === "approve") {
        const rows = await executor.query(selectPublicationGateDefinitionQuery());
        selfApprovalAllowed = rows.length === 1 && rows[0].allow_self_approval === true;
      }
      const transition = reviewTransitionFor(action, version, { reason: input.reason, selfApprovalAllowed });
      if (action === "submit" && content.items.length === 0) {
        throw new DomainError("CONFLICT", "Add at least one item before submitting this assessment for review.");
      }
      const change = transitionVersion(version, transition, contextFor(user, deps, input.correlationId));
      const next = bump(change.version, version.revision);
      await runGuarded(executor, [writeState(next, version, change.audit)]);
      return next;
    },

    async publish(user: AuthUser, versionId: unknown, input: Correlated & { readonly expectedRevision: unknown }) {
      guard(user, "assessment.publish");
      const { version: target } = await loadVersion(versionId);
      if (target.revision !== parseRequiredRevision(input.expectedRevision)) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      const versions = await loadMany(executor, listAssessmentVersionsQuery(target.parentId), mapAssessmentVersionRow);
      const current = versions.find((v) => v.state === "published") ?? null;
      const result = publishVersion(target, current, contextFor(user, deps, input.correlationId));
      const published = bump(result.published, target.revision);
      const statements: SqlQuery[] = [];
      let superseded: AssessmentVersionRecord | null = null;
      if (result.superseded && current) {
        superseded = bump(result.superseded, current.revision);
        statements.push(writeState(superseded, current, result.audits[1]));
      }
      statements.push(writeState(published, target, result.audits[0]));
      await runGuarded(executor, statements, { unique: "Another version was published at the same time. Reload and try again." });
      return { published, superseded };
    },
  };
}

export type AssessmentAuthoringService = ReturnType<typeof createAssessmentAuthoringService>;
