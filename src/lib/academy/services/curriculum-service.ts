/**
 * Administrative curriculum service: drafts, outline editing, review and
 * publication of curriculum versions.
 *
 * Approval by the version's own author is allowed only when the academy's
 * `publication` approval gate definition explicitly allows self-approval.
 * With no definition configured, a different administrator must approve.
 */
import type { AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { parseRequiredRevision } from "../domain/text.ts";
import { parseReviewAction, reviewTransitionFor } from "../governance/review-actions.ts";
import { createDraftVersion, publishVersion, transitionVersion } from "../governance/versioning.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import { expectRows } from "../repo/audit-repo.ts";
import { mapCourseRow, mapCurriculumRow, selectCourseQuery, selectCurriculumByCourseQuery, selectCurriculumQuery } from "../repo/catalog-repo.ts";
import {
  copyOutlineLessonsQuery,
  copyOutlineUnitsQuery,
  deleteOutlineLessonsQuery,
  deleteOutlineUnitsQuery,
  insertIdentitiesQuery,
  insertOutlineLessonsQuery,
  insertOutlineUnitsQuery,
  insertVersionQuery,
  listVersionsQuery,
  mapIdentities,
  mapOutline,
  mapVersionRow,
  selectIdentitiesQuery,
  selectOutlineLessonsQuery,
  selectOutlineUnitsQuery,
  selectPublicationGateDefinitionQuery,
  selectVersionQuery,
  updateVersionQuery,
} from "../repo/curriculum-repo.ts";
import type { CourseRecord, CurriculumRecord } from "../structure/catalog.ts";
import {
  assertOutlineReadyForReview,
  bumpRevision,
  countLessons,
  parseOutlineInput,
  planSaveOutline,
  withInitialRevision,
  type CurriculumVersionRecord,
  type Outline,
} from "../structure/curriculum.ts";
import { audited, contextFor, loadMany, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

export function createCurriculumService(deps: ServiceDeps) {
  const { executor } = deps;

  function guard(user: AuthUser): void {
    assertAcademyCoreAvailable(deps.flags);
    authorizeAdminAction(user, "curriculum.modify");
  }

  async function loadVersion(versionId: unknown): Promise<CurriculumVersionRecord> {
    return loadRequired(executor, selectVersionQuery(parseUuid(versionId, "versionId")), mapVersionRow, "Curriculum version not found.");
  }

  async function loadOutline(versionId: string): Promise<Outline> {
    const [units, lessons] = await Promise.all([
      executor.query(selectOutlineUnitsQuery(versionId)),
      executor.query(selectOutlineLessonsQuery(versionId)),
    ]);
    return mapOutline(units, lessons);
  }

  async function loadCurriculumForCourse(courseId: unknown): Promise<{ course: CourseRecord; curriculum: CurriculumRecord }> {
    const course = await loadRequired(executor, selectCourseQuery(parseUuid(courseId, "courseId")), mapCourseRow, "Course not found.");
    if (course.deletedAt !== null) throw new DomainError("NOT_FOUND", "Course not found.");
    const curriculum = await loadRequired(executor, selectCurriculumByCourseQuery(course.id), mapCurriculumRow, "Curriculum not found.");
    return { course, curriculum };
  }

  async function selfApprovalAllowed(): Promise<boolean> {
    const rows = await executor.query(selectPublicationGateDefinitionQuery());
    return rows.length === 1 && rows[0].allow_self_approval === true;
  }

  function writeTransition(next: CurriculumVersionRecord, previous: CurriculumVersionRecord, audit: Parameters<typeof audited>[2]): SqlQuery {
    return audited(deps, updateVersionQuery(next, { revision: previous.revision, state: previous.state }), audit);
  }

  return {
    async getCurriculum(user: AuthUser, courseId: unknown) {
      guard(user);
      const { course, curriculum } = await loadCurriculumForCourse(courseId);
      const versions = await loadMany(executor, listVersionsQuery(curriculum.id), mapVersionRow);
      return { course, curriculum, versions };
    },

    async getVersion(user: AuthUser, versionId: unknown): Promise<{ version: CurriculumVersionRecord; outline: Outline }> {
      guard(user);
      const version = await loadVersion(versionId);
      return { version, outline: await loadOutline(version.id) };
    },

    /** Opens a new draft, copying the outline of `basedOnVersionId` (default: the published version). */
    async createDraft(
      user: AuthUser,
      courseId: unknown,
      input: { readonly basedOnVersionId?: unknown; readonly correlationId?: string | null } = {},
    ): Promise<CurriculumVersionRecord> {
      guard(user);
      const { curriculum } = await loadCurriculumForCourse(courseId);
      const existing = await loadMany(executor, listVersionsQuery(curriculum.id), mapVersionRow);
      let basedOn: CurriculumVersionRecord | null = null;
      if (input.basedOnVersionId !== undefined && input.basedOnVersionId !== null && input.basedOnVersionId !== "") {
        const id = parseUuid(input.basedOnVersionId, "basedOnVersionId");
        basedOn = existing.find((v) => v.id === id) ?? null;
        if (!basedOn) throw new DomainError("VALIDATION", "A new version can only be based on a version of the same curriculum.");
      } else {
        basedOn = existing.find((v) => v.state === "published") ?? null;
      }
      const ctx = contextFor(user, deps, input.correlationId);
      const change = createDraftVersion(
        { versionKind: "curriculum_version", parentKind: "curriculum", parentId: curriculum.id, existingVersions: existing, basedOn, newId: deps.newId },
        ctx,
      );
      const version = withInitialRevision(change.version);
      const statements: SqlQuery[] = [audited(deps, insertVersionQuery(version), change.audit)];
      if (basedOn) {
        statements.push(copyOutlineUnitsQuery(version.id, basedOn.id), copyOutlineLessonsQuery(version.id, basedOn.id));
      }
      await runGuarded(executor, statements, { unique: "A version is already being prepared for this curriculum." });
      return version;
    },

    async saveOutline(
      user: AuthUser,
      versionId: unknown,
      input: { readonly outline: unknown; readonly expectedRevision: unknown; readonly correlationId?: string | null },
    ): Promise<{ version: CurriculumVersionRecord; outline: Outline }> {
      guard(user);
      const version = await loadVersion(versionId);
      const expectedRevision = parseRequiredRevision(input.expectedRevision);
      const units = parseOutlineInput(input.outline);
      const curriculum = await loadRequired(executor, selectCurriculumQuery(version.parentId), mapCurriculumRow, "Curriculum not found.");
      const identities = mapIdentities(await executor.query(selectIdentitiesQuery(curriculum.id)));
      const currentOutline = await loadOutline(version.id);
      const ctx = contextFor(user, deps, input.correlationId);
      const plan = planSaveOutline(
        {
          version,
          curriculumId: curriculum.id,
          units,
          expectedRevision,
          knownUnitIds: identities.units,
          knownLessonIds: identities.lessons,
          currentOutline,
        },
        ctx,
      );
      const at = toIso((deps.clock ?? systemClock)());
      const statements: SqlQuery[] = [writeTransition(plan.version, version, plan.audit)];
      if (plan.newUnitIds.length > 0) {
        statements.push(expectRows(insertIdentitiesQuery("academy_units", curriculum.id, plan.newUnitIds, user.uid, at), plan.newUnitIds.length));
      }
      if (plan.newLessonIds.length > 0) {
        statements.push(
          expectRows(insertIdentitiesQuery("academy_lessons", curriculum.id, plan.newLessonIds, user.uid, at), plan.newLessonIds.length),
        );
      }
      statements.push(deleteOutlineLessonsQuery(version.id), deleteOutlineUnitsQuery(version.id));
      if (plan.outline.units.length > 0) statements.push(insertOutlineUnitsQuery(version.id, curriculum.id, plan.outline));
      if (countLessons(plan.outline) > 0) statements.push(insertOutlineLessonsQuery(version.id, curriculum.id, plan.outline));
      await runGuarded(executor, statements);
      return { version: plan.version, outline: plan.outline };
    },

    async review(
      user: AuthUser,
      versionId: unknown,
      input: { readonly action: unknown; readonly reason?: unknown; readonly expectedRevision: unknown; readonly correlationId?: string | null },
    ): Promise<CurriculumVersionRecord> {
      guard(user);
      const action = parseReviewAction(input.action);
      const version = await loadVersion(versionId);
      if (version.revision !== parseRequiredRevision(input.expectedRevision)) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      const transition = reviewTransitionFor(action, version, {
        reason: input.reason,
        selfApprovalAllowed: action === "approve" ? await selfApprovalAllowed() : false,
      });
      if (action === "submit") assertOutlineReadyForReview(await loadOutline(version.id));
      const ctx = contextFor(user, deps, input.correlationId);
      const change = transitionVersion(version, transition, ctx);
      const next = bumpRevision(change.version, version.revision);
      await runGuarded(executor, [writeTransition(next, version, change.audit)]);
      return next;
    },

    async publish(
      user: AuthUser,
      versionId: unknown,
      input: { readonly expectedRevision: unknown; readonly correlationId?: string | null },
    ): Promise<{ published: CurriculumVersionRecord; superseded: CurriculumVersionRecord | null }> {
      guard(user);
      const target = await loadVersion(versionId);
      if (target.revision !== parseRequiredRevision(input.expectedRevision)) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      const versions = await loadMany(executor, listVersionsQuery(target.parentId), mapVersionRow);
      const current = versions.find((v) => v.state === "published") ?? null;
      const ctx = contextFor(user, deps, input.correlationId);
      const result = publishVersion(target, current, ctx);
      const published = bumpRevision(result.published, target.revision);
      const statements: SqlQuery[] = [];
      if (result.superseded && current) {
        const superseded = bumpRevision(result.superseded, current.revision);
        // Supersede first: at most one published version may exist at any moment.
        statements.push(writeTransition(superseded, current, result.audits[1]));
        statements.push(writeTransition(published, target, result.audits[0]));
        await runGuarded(executor, statements, { unique: "Another version was published at the same time. Reload and try again." });
        return { published, superseded };
      }
      statements.push(writeTransition(published, target, result.audits[0]));
      await runGuarded(executor, statements, { unique: "Another version was published at the same time. Reload and try again." });
      return { published, superseded: null };
    },
  };
}

export type CurriculumService = ReturnType<typeof createCurriculumService>;
