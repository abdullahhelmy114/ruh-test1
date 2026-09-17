/**
 * Administrative 2C production: libraries, factories, runs, content items,
 * versions (with provenance), human-gated publication, links and
 * remediation rules.
 */
import type { AuthUser } from "../../auth/core.ts";
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError } from "../domain/errors.ts";
import { parseOptionalUuid, parseUuid } from "../domain/ids.ts";
import { parseRequiredRevision } from "../domain/text.ts";
import { parseReviewAction, reviewTransitionFor } from "../governance/review-actions.ts";
import { assertContentMutable, createDraftVersion, publishVersion, touchDraftVersion, transitionVersion } from "../governance/versioning.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import { parseProductionContent, parseProvenance, type Provenance } from "../production/content.ts";
import { planCreateRemediationRule, planRetireRemediationRule } from "../production/practice.ts";
import {
  assertPublishable,
  planAddLink,
  planCreateItem,
  planCreateLibrary,
  planCreateRun,
  planLibraryState,
  planRegisterFactory,
  planRemoveLink,
  planRunStatus,
  type ContentItemVersionRecord,
} from "../production/production.ts";
import { PRODUCTION_RUN_STATES, type ProductionRunState } from "../domain/states.ts";
import { mapAssessmentRow, selectAssessmentQuery } from "../repo/assessment-repo.ts";
import { countOf, mapCourseRow, mapProgramRow, selectCourseQuery, selectProgramQuery } from "../repo/catalog-repo.ts";
import { selectPublicationGateDefinitionQuery } from "../repo/curriculum-repo.ts";
import { listSubjectGatesQuery, mapGateRow } from "../repo/gate-repo.ts";
import { mapLessonIdentity, selectLessonIdentityQuery } from "../repo/lesson-repo.ts";
import {
  countActiveCourseLinksQuery,
  insertFactoryQuery,
  insertItemQuery,
  insertItemVersionQuery,
  insertLibraryQuery,
  insertLinkQuery,
  insertRuleQuery,
  insertRunQuery,
  listCourseRulesQuery,
  listFactoriesQuery,
  listItemLinksQuery,
  listItemVersionsQuery,
  listItemsQuery,
  listLibrariesQuery,
  listRunsQuery,
  mapFactoryRow,
  mapItemRow,
  mapItemVersionRow,
  mapLibraryRow,
  mapLinkRow,
  mapRuleRow,
  mapRunRow,
  removeLinkQuery,
  retireRuleQuery,
  selectFactoryQuery,
  selectItemQuery,
  selectItemVersionQuery,
  selectLibraryQuery,
  selectLinkQuery,
  selectProductionReportQuery,
  selectRuleQuery,
  selectRunItemCountsQuery,
  selectRunQuery,
  storedVersionData,
  updateItemVersionContentQuery,
  updateItemVersionStateQuery,
  updateLibraryStateQuery,
  updateRunQuery,
} from "../repo/production-repo.ts";
import { num, str } from "../repo/rows.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

type Correlated = { readonly correlationId?: string | null };

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export function createProductionService(deps: ServiceDeps) {
  const { executor } = deps;

  function guard(user: AuthUser, action: "production.manage" | "production.publish" | "remediation.manage" = "production.manage"): void {
    assertAcademyCoreAvailable(deps.flags);
    authorizeAdminAction(user, action);
  }

  const loadLibrary = (id: unknown) => loadRequired(executor, selectLibraryQuery(parseUuid(id, "libraryId")), mapLibraryRow, "Library not found.");
  const loadItem = (id: unknown) => loadRequired(executor, selectItemQuery(parseUuid(id, "itemId")), mapItemRow, "Content item not found.");

  async function loadVersion(versionId: unknown) {
    const rows = await executor.query(selectItemVersionQuery(parseUuid(versionId, "versionId")));
    if (rows.length === 0) throw new DomainError("NOT_FOUND", "Content version not found.");
    return { version: mapItemVersionRow(rows[0]), ...storedVersionData(rows[0]) };
  }

  function writeState(next: ContentItemVersionRecord, previous: ContentItemVersionRecord, audit: AuditEventInput): SqlQuery {
    return audited(deps, updateItemVersionStateQuery(next, { revision: previous.revision, state: previous.state }), audit);
  }

  const bump = (v: ContentItemVersionRecord, previous: number): ContentItemVersionRecord => Object.freeze({ ...v, revision: previous + 1 });

  return {
    // -- Libraries ---------------------------------------------------------------

    async listLibraries(user: AuthUser) {
      guard(user);
      return loadMany(executor, listLibrariesQuery(), mapLibraryRow);
    },

    async createLibrary(
      user: AuthUser,
      input: Correlated & { readonly slug: unknown; readonly title: unknown; readonly description?: unknown; readonly scope: unknown; readonly programId?: unknown; readonly courseId?: unknown },
    ) {
      guard(user);
      const plan = planCreateLibrary(input, contextFor(user, deps, input.correlationId));
      if (plan.record.programId) {
        const program = await loadRequired(executor, selectProgramQuery(plan.record.programId), mapProgramRow, "Program not found.");
        if (program.deletedAt !== null) throw new DomainError("NOT_FOUND", "Program not found.");
      }
      if (plan.record.courseId) {
        const course = await loadRequired(executor, selectCourseQuery(plan.record.courseId), mapCourseRow, "Course not found.");
        if (course.deletedAt !== null) throw new DomainError("NOT_FOUND", "Course not found.");
      }
      await runGuarded(executor, [audited(deps, insertLibraryQuery(plan.record), plan.audit)], { unique: "A library with this slug already exists." });
      return plan.record;
    },

    async changeLibraryState(user: AuthUser, libraryId: unknown, input: Correlated & { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown }) {
      guard(user);
      const library = await loadLibrary(libraryId);
      const plan = planLibraryState(library, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateLibraryStateQuery(plan.record, library.revision), plan.audit)]);
      return plan.record;
    },

    // -- Factories and runs --------------------------------------------------------

    async listFactories(user: AuthUser) {
      guard(user);
      return loadMany(executor, listFactoriesQuery(), mapFactoryRow);
    },

    async registerFactory(user: AuthUser, input: Correlated & { readonly key: unknown; readonly title: unknown; readonly description?: unknown; readonly outputKind: unknown }) {
      guard(user);
      const plan = planRegisterFactory(input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertFactoryQuery(plan.record), plan.audit)], { unique: "A factory with this key already exists." });
      return plan.record;
    },

    async listRuns(user: AuthUser, options: { readonly state?: unknown } = {}) {
      guard(user);
      let state: ProductionRunState | null = null;
      if (!isBlank(options.state)) {
        if (typeof options.state !== "string" || !(PRODUCTION_RUN_STATES as readonly string[]).includes(options.state)) {
          throw new DomainError("VALIDATION", "Unknown run state.");
        }
        state = options.state as ProductionRunState;
      }
      return loadMany(executor, listRunsQuery(state), mapRunRow);
    },

    async createRun(user: AuthUser, input: Correlated & { readonly factoryId: unknown; readonly libraryId: unknown; readonly title: unknown; readonly brief?: unknown }) {
      guard(user);
      const factory = await loadRequired(executor, selectFactoryQuery(parseUuid(input.factoryId, "factoryId")), mapFactoryRow, "Factory not found.");
      const library = await loadLibrary(input.libraryId);
      const plan = planCreateRun({ factory, library, title: input.title, brief: input.brief }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertRunQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    async changeRunStatus(user: AuthUser, runId: unknown, input: Correlated & { readonly to: unknown; readonly reason?: unknown; readonly expectedRevision: unknown }) {
      guard(user);
      const run = await loadRequired(executor, selectRunQuery(parseUuid(runId, "runId")), mapRunRow, "Production run not found.");
      const counts = (await executor.query(selectRunItemCountsQuery(run.id)))[0] ?? {};
      const plan = planRunStatus(run, input, { items: num(counts.items ?? 0), unresolvedItems: num(counts.unresolved ?? 0) }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateRunQuery(plan.record, run), plan.audit)]);
      return plan.record;
    },

    // -- Items and versions ----------------------------------------------------------

    async listItems(user: AuthUser, filter: { readonly libraryId?: unknown; readonly runId?: unknown } = {}) {
      guard(user);
      const rows = await executor.query(listItemsQuery({ libraryId: parseOptionalUuid(filter.libraryId, "libraryId"), runId: parseOptionalUuid(filter.runId, "runId") }));
      return rows.map((row) => ({ ...mapItemRow(row), latestState: row.latest_state === null ? null : str(row.latest_state), hasPublished: row.has_published === true }));
    },

    async createItem(user: AuthUser, input: Correlated & { readonly libraryId: unknown; readonly runId?: unknown; readonly kind: unknown; readonly title: unknown }) {
      guard(user);
      const library = await loadLibrary(input.libraryId);
      const runId = parseOptionalUuid(input.runId, "runId");
      const run = runId ? await loadRequired(executor, selectRunQuery(runId), mapRunRow, "Production run not found.") : null;
      const runFactory = run ? await loadOptional(executor, selectFactoryQuery(run.factoryId), mapFactoryRow) : null;
      const ctx = contextFor(user, deps, input.correlationId);
      const plan = planCreateItem({ library, run, runFactory, kind: input.kind, title: input.title }, ctx);
      const change = createDraftVersion(
        { versionKind: "content_item_version", parentKind: "content_item", parentId: plan.record.id, existingVersions: [], newId: deps.newId },
        ctx,
      );
      const version: ContentItemVersionRecord = Object.freeze({ ...change.version, revision: 1 });
      await runGuarded(executor, [audited(deps, insertItemQuery(plan.record), plan.audit), audited(deps, insertItemVersionQuery(version, null, null), change.audit)]);
      return { item: plan.record, version };
    },

    async getItem(user: AuthUser, itemId: unknown) {
      guard(user);
      const item = await loadItem(itemId);
      const [versions, links, gates] = await Promise.all([
        loadMany(executor, listItemVersionsQuery(item.id), mapItemVersionRow),
        loadMany(executor, listItemLinksQuery(item.id), mapLinkRow),
        loadMany(executor, listSubjectGatesQuery("content_item", item.id), mapGateRow),
      ]);
      return { item, versions, links, approvalGates: gates };
    },

    async getVersion(user: AuthUser, versionId: unknown) {
      guard(user);
      return loadVersion(versionId);
    },

    async createDraft(user: AuthUser, itemId: unknown, input: Correlated & { readonly basedOnVersionId?: unknown } = {}) {
      guard(user);
      const item = await loadItem(itemId);
      const existing = await loadMany(executor, listItemVersionsQuery(item.id), mapItemVersionRow);
      let basedOn: ContentItemVersionRecord | null;
      if (!isBlank(input.basedOnVersionId)) {
        const id = parseUuid(input.basedOnVersionId, "basedOnVersionId");
        basedOn = existing.find((v) => v.id === id) ?? null;
        if (!basedOn) throw new DomainError("VALIDATION", "A new version can only be based on a version of the same item.");
      } else {
        basedOn = existing.find((v) => v.state === "published") ?? null;
      }
      const base = basedOn ? await loadVersion(basedOn.id) : { content: null, provenance: null };
      const ctx = contextFor(user, deps, input.correlationId);
      const change = createDraftVersion(
        { versionKind: "content_item_version", parentKind: "content_item", parentId: item.id, existingVersions: existing, basedOn, newId: deps.newId },
        ctx,
      );
      const version: ContentItemVersionRecord = Object.freeze({ ...change.version, revision: 1 });
      await runGuarded(executor, [audited(deps, insertItemVersionQuery(version, base.content, base.provenance), change.audit)], {
        unique: "A version is already being prepared for this item.",
      });
      return version;
    },

    async saveVersion(
      user: AuthUser,
      versionId: unknown,
      input: Correlated & { readonly content?: unknown; readonly provenance?: unknown; readonly expectedRevision: unknown },
    ) {
      guard(user);
      const stored = await loadVersion(versionId);
      const expectedRevision = parseRequiredRevision(input.expectedRevision);
      assertContentMutable(stored.version);
      if (stored.version.revision !== expectedRevision) throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      if (input.content === undefined && input.provenance === undefined) throw new DomainError("VALIDATION", "Nothing to change.");
      const item = await loadItem(stored.version.parentId);
      const content = input.content === undefined ? stored.content : parseProductionContent(item.kind, input.content);
      const provenance: Provenance | null = input.provenance === undefined ? stored.provenance : parseProvenance(input.provenance);
      const ctx = contextFor(user, deps, input.correlationId);
      const next: ContentItemVersionRecord = Object.freeze({ ...touchDraftVersion(stored.version, ctx), revision: stored.version.revision + 1 });
      await runGuarded(executor, [
        audited(deps, updateItemVersionContentQuery(next, content, provenance, expectedRevision), {
          actor: ctx.actor,
          action: "content_item_version.save",
          object: { kind: "content_item_version", id: next.id },
          newVersionId: next.id,
          correlationId: ctx.correlationId,
          metadata: {
            itemId: item.id,
            contentChanged: input.content !== undefined,
            provenanceChanged: input.provenance !== undefined,
            rightsStatus: provenance?.rightsStatus ?? null,
            origin: provenance?.origin ?? null,
            revision: next.revision,
          },
        }),
      ]);
      return { version: next, content, provenance };
    },

    async review(user: AuthUser, versionId: unknown, input: Correlated & { readonly action: unknown; readonly reason?: unknown; readonly expectedRevision: unknown }) {
      guard(user);
      const action = parseReviewAction(input.action);
      if (action === "approve") authorizeAdminAction(user, "production.publish");
      const stored = await loadVersion(versionId);
      if (stored.version.revision !== parseRequiredRevision(input.expectedRevision)) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      let selfApprovalAllowed = false;
      if (action === "approve") {
        const rows = await executor.query(selectPublicationGateDefinitionQuery());
        selfApprovalAllowed = rows.length === 1 && rows[0].allow_self_approval === true;
      }
      const transition = reviewTransitionFor(action, stored.version, { reason: input.reason, selfApprovalAllowed });
      if (action === "submit" && (stored.content === null || stored.provenance === null)) {
        throw new DomainError("CONFLICT", "Add content and provenance before submitting for review.");
      }
      const change = transitionVersion(stored.version, transition, contextFor(user, deps, input.correlationId));
      const next = bump(change.version, stored.version.revision);
      await runGuarded(executor, [writeState(next, stored.version, change.audit)]);
      return next;
    },

    async publish(user: AuthUser, versionId: unknown, input: Correlated & { readonly expectedRevision: unknown }) {
      guard(user, "production.publish");
      const stored = await loadVersion(versionId);
      if (stored.version.revision !== parseRequiredRevision(input.expectedRevision)) {
        throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
      }
      const item = await loadItem(stored.version.parentId);
      const [versions, gates] = await Promise.all([
        loadMany(executor, listItemVersionsQuery(item.id), mapItemVersionRow),
        loadMany(executor, listSubjectGatesQuery("content_item", item.id), mapGateRow),
      ]);
      assertPublishable(item, stored.version, stored, gates);
      const current = versions.find((v) => v.state === "published") ?? null;
      const result = publishVersion(stored.version, current, contextFor(user, deps, input.correlationId));
      const published = bump(result.published, stored.version.revision);
      const statements: SqlQuery[] = [];
      let superseded: ContentItemVersionRecord | null = null;
      if (result.superseded && current) {
        superseded = bump(result.superseded, current.revision);
        statements.push(writeState(superseded, current, result.audits[1]));
      }
      statements.push(writeState(published, stored.version, result.audits[0]));
      await runGuarded(executor, statements, { unique: "Another version was published at the same time. Reload and try again." });
      return { published, superseded };
    },

    // -- Links -----------------------------------------------------------------------

    async addLink(user: AuthUser, itemId: unknown, input: Correlated & { readonly targetKind: unknown; readonly targetId: unknown; readonly purpose: unknown }) {
      guard(user);
      const item = await loadItem(itemId);
      const library = await loadLibrary(item.libraryId);
      const targetId = parseUuid(input.targetId, "targetId");
      let targetCourseId: string | null = null;
      if (input.targetKind === "course") {
        targetCourseId = targetId;
      } else if (input.targetKind === "lesson") {
        targetCourseId = (await loadOptional(executor, selectLessonIdentityQuery(targetId), mapLessonIdentity))?.courseId ?? null;
      } else if (input.targetKind === "assessment") {
        targetCourseId = (await loadOptional(executor, selectAssessmentQuery(targetId), mapAssessmentRow))?.courseId ?? null;
      }
      const course = targetCourseId ? await loadOptional(executor, selectCourseQuery(targetCourseId), mapCourseRow) : null;
      const [versions, existing] = await Promise.all([
        loadMany(executor, listItemVersionsQuery(item.id), mapItemVersionRow),
        loadMany(executor, listItemLinksQuery(item.id), mapLinkRow),
      ]);
      const plan = planAddLink(
        {
          item,
          library,
          hasPublishedVersion: versions.some((v) => v.state === "published"),
          course,
          targetCourseId,
          existing,
          targetKind: input.targetKind,
          targetId,
          purpose: input.purpose,
        },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(executor, [audited(deps, insertLinkQuery(plan.record), plan.audit)], { unique: "This link already exists." });
      return plan.record;
    },

    async removeLink(user: AuthUser, linkId: unknown, input: Correlated & { readonly reason: unknown; readonly expectedRevision: unknown }) {
      guard(user);
      const link = await loadRequired(executor, selectLinkQuery(parseUuid(linkId, "linkId")), mapLinkRow, "Link not found.");
      const plan = planRemoveLink(link, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, removeLinkQuery(plan.record, link.revision), plan.audit)]);
      return plan.record;
    },

    // -- Remediation rules -------------------------------------------------------------

    async listRemediationRules(user: AuthUser, courseId: unknown) {
      guard(user, "remediation.manage");
      return loadMany(executor, listCourseRulesQuery(parseUuid(courseId, "courseId")), mapRuleRow);
    },

    async createRemediationRule(
      user: AuthUser,
      courseId: unknown,
      input: Correlated & { readonly assessmentId: unknown; readonly itemId: unknown; readonly belowScorePercent: unknown; readonly reason: unknown },
    ) {
      guard(user, "remediation.manage");
      const course = await loadRequired(executor, selectCourseQuery(parseUuid(courseId, "courseId")), mapCourseRow, "Course not found.");
      const assessment = await loadOptional(executor, selectAssessmentQuery(parseUuid(input.assessmentId, "assessmentId")), mapAssessmentRow);
      const itemId = parseUuid(input.itemId, "itemId");
      const linked = countOf(await executor.query(countActiveCourseLinksQuery(itemId, course.id, "remediation"))) > 0;
      const plan = planCreateRemediationRule(
        { courseId: course.id, assessment, itemLinkedForRemediation: linked, itemId, belowScorePercent: input.belowScorePercent, reason: input.reason },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(executor, [audited(deps, insertRuleQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    async retireRemediationRule(user: AuthUser, ruleId: unknown, input: Correlated & { readonly reason: unknown; readonly expectedRevision: unknown }) {
      guard(user, "remediation.manage");
      const rule = await loadRequired(executor, selectRuleQuery(parseUuid(ruleId, "ruleId")), mapRuleRow, "Rule not found.");
      const plan = planRetireRemediationRule(rule, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, retireRuleQuery(plan.record, rule.revision), plan.audit)]);
      return plan.record;
    },

    // -- Reports -------------------------------------------------------------------------

    async productionReport(user: AuthUser) {
      guard(user);
      const row = (await executor.query(selectProductionReportQuery()))[0] ?? {};
      const parse = (value: unknown) => (value === null || value === undefined ? {} : JSON.parse(String(value)));
      return {
        itemsByKind: parse(row.items_by_kind),
        runsByState: parse(row.runs_by_state),
        versionsInReview: num(row.versions_in_review ?? 0),
        versionsAwaitingRights: num(row.versions_awaiting_rights ?? 0),
        openRemediation: num(row.open_remediation ?? 0),
      };
    },
  };
}

export type ProductionService = ReturnType<typeof createProductionService>;
