/**
 * Persistence for 2C production: libraries, factories, runs, content items
 * and versions, links, practice results and remediation.
 *
 * JSON columns are selected as text and parsed exactly once.
 */
import type { ContentVersionState, ProductionRunState } from "../domain/states.ts";
import { jsonParam, sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { ContentKind, Provenance } from "../production/content.ts";
import type {
  ContentItemRecord,
  ContentItemVersionRecord,
  ContentLibraryRecord,
  ContentLinkRecord,
  FactoryRecord,
  LibraryScope,
  LinkPurpose,
  LinkTarget,
  ProductionRunRecord,
} from "../production/production.ts";
import type { PracticeResultRecord, RemediationAssignmentRecord, RemediationRuleRecord, RemediationState } from "../production/practice.ts";
import { iso, isoOrNull, num, numOrNull, str, strOrNull } from "./rows.ts";

function json(value: unknown): unknown {
  return value === null || value === undefined ? null : JSON.parse(String(value));
}

// ---------------------------------------------------------------------------
// Libraries
// ---------------------------------------------------------------------------

const LIBRARY_COLUMNS = `id, slug, title, description, scope, program_id, course_id, state, state_reason, revision, created_by, created_at, updated_by, updated_at`;

export function selectLibraryQuery(id: string): SqlQuery {
  return { text: `SELECT ${LIBRARY_COLUMNS} FROM academy_content_libraries WHERE id = $1::uuid`, values: [id] };
}

export function listLibrariesQuery(): SqlQuery {
  return { text: `SELECT ${LIBRARY_COLUMNS} FROM academy_content_libraries ORDER BY title ASC, id ASC LIMIT 500`, values: [] };
}

export function insertLibraryQuery(r: ContentLibraryRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_content_libraries
      (id, slug, title, description, scope, program_id, course_id, state, state_reason, revision, created_by, created_at, updated_by, updated_at)
    VALUES (${r.id}::uuid, ${r.slug}, ${r.title}, ${r.description}, ${r.scope}, ${r.programId}::uuid, ${r.courseId}::uuid, ${r.state},
      ${r.stateReason}, ${r.revision}, ${r.createdBy}, ${r.createdAt}::timestamptz, ${r.updatedBy}, ${r.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateLibraryStateQuery(r: ContentLibraryRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_content_libraries SET state = ${r.state}, state_reason = ${r.stateReason}, revision = ${r.revision},
      updated_by = ${r.updatedBy}, updated_at = ${r.updatedAt}::timestamptz
    WHERE id = ${r.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
}

export function mapLibraryRow(row: SqlRow): ContentLibraryRecord {
  return Object.freeze({
    id: str(row.id),
    slug: str(row.slug),
    title: str(row.title),
    description: strOrNull(row.description),
    scope: str(row.scope) as LibraryScope,
    programId: strOrNull(row.program_id),
    courseId: strOrNull(row.course_id),
    state: str(row.state) as ContentLibraryRecord["state"],
    stateReason: strOrNull(row.state_reason),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
  });
}

// ---------------------------------------------------------------------------
// Factories and runs
// ---------------------------------------------------------------------------

const FACTORY_COLUMNS = `id, key, title, description, output_kind, state, created_by, created_at`;

export function selectFactoryQuery(id: string): SqlQuery {
  return { text: `SELECT ${FACTORY_COLUMNS} FROM academy_production_factories WHERE id = $1::uuid`, values: [id] };
}

export function listFactoriesQuery(): SqlQuery {
  return { text: `SELECT ${FACTORY_COLUMNS} FROM academy_production_factories ORDER BY title ASC LIMIT 500`, values: [] };
}

export function insertFactoryQuery(r: FactoryRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_production_factories (id, key, title, description, output_kind, state, created_by, created_at)
    VALUES (${r.id}::uuid, ${r.key}, ${r.title}, ${r.description}, ${r.outputKind}, ${r.state}, ${r.createdBy}, ${r.createdAt}::timestamptz)
    RETURNING id`;
}

export function mapFactoryRow(row: SqlRow): FactoryRecord {
  return Object.freeze({
    id: str(row.id),
    key: str(row.key),
    title: str(row.title),
    description: strOrNull(row.description),
    outputKind: str(row.output_kind) as ContentKind,
    state: str(row.state) as FactoryRecord["state"],
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
  });
}

const RUN_COLUMNS = `id, factory_id, library_id, title, brief, state, state_reason, revision, created_by, created_at, updated_by, updated_at`;

export function selectRunQuery(id: string): SqlQuery {
  return { text: `SELECT ${RUN_COLUMNS} FROM academy_production_runs WHERE id = $1::uuid`, values: [id] };
}

export function listRunsQuery(state: ProductionRunState | null): SqlQuery {
  return {
    text: `SELECT ${RUN_COLUMNS} FROM academy_production_runs WHERE ($1::text IS NULL OR state = $1::text) ORDER BY updated_at DESC, id DESC LIMIT 500`,
    values: [state],
  };
}

export function insertRunQuery(r: ProductionRunRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_production_runs
      (id, factory_id, library_id, title, brief, state, state_reason, revision, created_by, created_at, updated_by, updated_at)
    VALUES (${r.id}::uuid, ${r.factoryId}::uuid, ${r.libraryId}::uuid, ${r.title}, ${r.brief}, ${r.state}, ${r.stateReason}, ${r.revision},
      ${r.createdBy}, ${r.createdAt}::timestamptz, ${r.updatedBy}, ${r.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateRunQuery(r: ProductionRunRecord, expected: { readonly revision: number; readonly state: ProductionRunState }): SqlQuery {
  return sqlQuery`UPDATE academy_production_runs SET state = ${r.state}, state_reason = ${r.stateReason}, revision = ${r.revision},
      updated_by = ${r.updatedBy}, updated_at = ${r.updatedAt}::timestamptz
    WHERE id = ${r.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

/** Items of a run, and how many still have a version being worked on. */
export function selectRunItemCountsQuery(runId: string): SqlQuery {
  return sqlQuery`SELECT count(*) AS items,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM academy_content_item_versions v
        WHERE v.item_id = i.id AND v.state IN ('draft', 'in_review', 'changes_requested', 'approved'))) AS unresolved
    FROM academy_content_items i WHERE i.production_run_id = ${runId}::uuid`;
}

export function mapRunRow(row: SqlRow): ProductionRunRecord {
  return Object.freeze({
    id: str(row.id),
    factoryId: str(row.factory_id),
    libraryId: str(row.library_id),
    title: str(row.title),
    brief: strOrNull(row.brief),
    state: str(row.state) as ProductionRunState,
    stateReason: strOrNull(row.state_reason),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
  });
}

// ---------------------------------------------------------------------------
// Items and versions
// ---------------------------------------------------------------------------

const ITEM_COLUMNS = `id, library_id, kind, title, production_run_id, created_by, created_at`;

export function selectItemQuery(id: string): SqlQuery {
  return { text: `SELECT ${ITEM_COLUMNS} FROM academy_content_items WHERE id = $1::uuid`, values: [id] };
}

export function listItemsQuery(filter: { readonly libraryId: string | null; readonly runId: string | null }): SqlQuery {
  return {
    text: `SELECT i.id, i.library_id, i.kind, i.title, i.production_run_id, i.created_by, i.created_at,
        (SELECT v.state FROM academy_content_item_versions v WHERE v.item_id = i.id ORDER BY v.version_number DESC LIMIT 1) AS latest_state,
        EXISTS (SELECT 1 FROM academy_content_item_versions v WHERE v.item_id = i.id AND v.state = 'published') AS has_published
      FROM academy_content_items i
      WHERE ($1::uuid IS NULL OR i.library_id = $1::uuid) AND ($2::uuid IS NULL OR i.production_run_id = $2::uuid)
      ORDER BY i.created_at DESC, i.id DESC LIMIT 1000`,
    values: [filter.libraryId, filter.runId],
  };
}

export function insertItemQuery(r: ContentItemRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_content_items (id, library_id, kind, title, production_run_id, created_by, created_at)
    VALUES (${r.id}::uuid, ${r.libraryId}::uuid, ${r.kind}, ${r.title}, ${r.productionRunId}::uuid, ${r.createdBy}, ${r.createdAt}::timestamptz)
    RETURNING id`;
}

export function mapItemRow(row: SqlRow): ContentItemRecord {
  return Object.freeze({
    id: str(row.id),
    libraryId: str(row.library_id),
    kind: str(row.kind) as ContentKind,
    title: str(row.title),
    productionRunId: strOrNull(row.production_run_id),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
  });
}

const VERSION_META = `id, item_id, version_number, based_on_version_id, state, revision, created_by, created_at, updated_at, submitted_at,
  reviewed_by, reviewed_at, published_by, published_at, superseded_at, archived_at`;

export function selectItemVersionQuery(id: string): SqlQuery {
  return {
    text: `SELECT ${VERSION_META}, content::text AS content, provenance::text AS provenance FROM academy_content_item_versions WHERE id = $1::uuid`,
    values: [id],
  };
}

export function selectPublishedItemVersionQuery(itemId: string): SqlQuery {
  return {
    text: `SELECT ${VERSION_META}, content::text AS content, provenance::text AS provenance FROM academy_content_item_versions
      WHERE item_id = $1::uuid AND state = 'published'`,
    values: [itemId],
  };
}

export function listItemVersionsQuery(itemId: string): SqlQuery {
  return { text: `SELECT ${VERSION_META} FROM academy_content_item_versions WHERE item_id = $1::uuid ORDER BY version_number DESC`, values: [itemId] };
}

export function insertItemVersionQuery(v: ContentItemVersionRecord, content: unknown, provenance: Provenance | null): SqlQuery {
  return sqlQuery`INSERT INTO academy_content_item_versions
      (id, item_id, version_number, based_on_version_id, state, revision, content, provenance, created_by, created_at, updated_at)
    VALUES (${v.id}::uuid, ${v.parentId}::uuid, ${v.versionNumber}, ${v.basedOnVersionId}::uuid, ${v.state}, ${v.revision},
      ${content === null ? null : jsonParam(content)}::jsonb, ${provenance === null ? null : jsonParam(provenance)}::jsonb,
      ${v.createdBy}, ${v.createdAt}::timestamptz, ${v.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateItemVersionStateQuery(v: ContentItemVersionRecord, expected: { readonly revision: number; readonly state: ContentVersionState }): SqlQuery {
  return sqlQuery`UPDATE academy_content_item_versions SET
      state = ${v.state}, revision = ${v.revision}, updated_at = ${v.updatedAt}::timestamptz, submitted_at = ${v.submittedAt}::timestamptz,
      reviewed_by = ${v.reviewedBy}, reviewed_at = ${v.reviewedAt}::timestamptz, published_by = ${v.publishedBy},
      published_at = ${v.publishedAt}::timestamptz, superseded_at = ${v.supersededAt}::timestamptz, archived_at = ${v.archivedAt}::timestamptz
    WHERE id = ${v.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

/** Content and provenance change only while the author holds the version. */
export function updateItemVersionContentQuery(v: ContentItemVersionRecord, content: unknown, provenance: Provenance | null, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_content_item_versions SET
      content = ${content === null ? null : jsonParam(content)}::jsonb, provenance = ${provenance === null ? null : jsonParam(provenance)}::jsonb,
      revision = ${v.revision}, updated_at = ${v.updatedAt}::timestamptz
    WHERE id = ${v.id}::uuid AND revision = ${expectedRevision} AND state IN ('draft', 'changes_requested')
    RETURNING id`;
}

export function mapItemVersionRow(row: SqlRow): ContentItemVersionRecord {
  return Object.freeze({
    id: str(row.id),
    versionKind: "content_item_version" as const,
    parentKind: "content_item" as const,
    parentId: str(row.item_id),
    versionNumber: num(row.version_number),
    basedOnVersionId: strOrNull(row.based_on_version_id),
    state: str(row.state) as ContentVersionState,
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    submittedAt: isoOrNull(row.submitted_at),
    reviewedBy: strOrNull(row.reviewed_by),
    reviewedAt: isoOrNull(row.reviewed_at),
    publishedBy: strOrNull(row.published_by),
    publishedAt: isoOrNull(row.published_at),
    supersededAt: isoOrNull(row.superseded_at),
    archivedAt: isoOrNull(row.archived_at),
  });
}

export function storedVersionData(row: SqlRow): { content: unknown; provenance: Provenance | null } {
  return { content: json(row.content), provenance: json(row.provenance) as Provenance | null };
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

const LINK_COLUMNS = `id, item_id, course_id, target_kind, target_id, purpose, revision, created_by, created_at, removed_at, removed_by, remove_reason`;

export function selectLinkQuery(id: string): SqlQuery {
  return { text: `SELECT ${LINK_COLUMNS} FROM academy_content_links WHERE id = $1::uuid`, values: [id] };
}

export function listItemLinksQuery(itemId: string): SqlQuery {
  return { text: `SELECT ${LINK_COLUMNS} FROM academy_content_links WHERE item_id = $1::uuid ORDER BY created_at DESC`, values: [itemId] };
}

export function insertLinkQuery(r: ContentLinkRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_content_links (id, item_id, course_id, target_kind, target_id, purpose, revision, created_by, created_at)
    VALUES (${r.id}::uuid, ${r.itemId}::uuid, ${r.courseId}::uuid, ${r.targetKind}, ${r.targetId}::uuid, ${r.purpose}, ${r.revision},
      ${r.createdBy}, ${r.createdAt}::timestamptz)
    RETURNING id`;
}

export function removeLinkQuery(r: ContentLinkRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_content_links SET revision = ${r.revision}, removed_at = ${r.removedAt}::timestamptz,
      removed_by = ${r.removedBy}, remove_reason = ${r.removeReason}
    WHERE id = ${r.id}::uuid AND revision = ${expectedRevision} AND removed_at IS NULL
    RETURNING id`;
}

export function mapLinkRow(row: SqlRow): ContentLinkRecord {
  return Object.freeze({
    id: str(row.id),
    itemId: str(row.item_id),
    courseId: str(row.course_id),
    targetKind: str(row.target_kind) as LinkTarget,
    targetId: str(row.target_id),
    purpose: str(row.purpose) as LinkPurpose,
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    removedAt: isoOrNull(row.removed_at),
    removedBy: strOrNull(row.removed_by),
    removeReason: strOrNull(row.remove_reason),
  });
}

/** Published items linked to a course (the practice shelf of a class group). */
export function listCourseContentQuery(courseId: string): SqlQuery {
  return sqlQuery`SELECT l.id AS link_id, l.target_kind, l.target_id, l.purpose, i.id AS item_id, i.kind, i.title, v.id AS version_id
    FROM academy_content_links l
    JOIN academy_content_items i ON i.id = l.item_id
    JOIN academy_content_item_versions v ON v.item_id = i.id AND v.state = 'published'
    WHERE l.course_id = ${courseId}::uuid AND l.removed_at IS NULL
    ORDER BY l.purpose ASC, i.title ASC
    LIMIT 1000`;
}

export function countActiveCourseLinksQuery(itemId: string, courseId: string, purpose: LinkPurpose | null): SqlQuery {
  return sqlQuery`SELECT count(*) AS n FROM academy_content_links
    WHERE item_id = ${itemId}::uuid AND course_id = ${courseId}::uuid AND removed_at IS NULL AND (${purpose}::text IS NULL OR purpose = ${purpose}::text)`;
}

// ---------------------------------------------------------------------------
// Practice results
// ---------------------------------------------------------------------------

const RESULT_COLUMNS = `id, item_id, item_version_id, class_group_id, learner_uid, responses::text AS responses, item_results::text AS item_results,
  score_percent, duration_seconds, completed_at`;

export function insertPracticeResultQuery(r: PracticeResultRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_practice_results
      (id, item_id, item_version_id, class_group_id, learner_uid, responses, item_results, score_percent, duration_seconds, completed_at)
    VALUES (${r.id}::uuid, ${r.itemId}::uuid, ${r.itemVersionId}::uuid, ${r.classGroupId}::uuid, ${r.learnerUid}, ${jsonParam(r.responses)}::jsonb,
      ${jsonParam(r.itemResults)}::jsonb, ${r.scorePercent}, ${r.durationSeconds}::integer, ${r.completedAt}::timestamptz)
    RETURNING id`;
}

export function listLearnerPracticeResultsQuery(classGroupId: string, learnerUid: string): SqlQuery {
  return {
    text: `SELECT ${RESULT_COLUMNS} FROM academy_practice_results WHERE class_group_id = $1::uuid AND learner_uid = $2
      ORDER BY completed_at DESC LIMIT 500`,
    values: [classGroupId, learnerUid],
  };
}

export function mapPracticeResultRow(row: SqlRow): PracticeResultRecord {
  return Object.freeze({
    id: str(row.id),
    itemId: str(row.item_id),
    itemVersionId: str(row.item_version_id),
    classGroupId: str(row.class_group_id),
    learnerUid: str(row.learner_uid),
    responses: (json(row.responses) ?? {}) as PracticeResultRecord["responses"],
    itemResults: (json(row.item_results) ?? []) as PracticeResultRecord["itemResults"],
    scorePercent: num(row.score_percent),
    durationSeconds: numOrNull(row.duration_seconds),
    completedAt: iso(row.completed_at),
  });
}

// ---------------------------------------------------------------------------
// Remediation
// ---------------------------------------------------------------------------

const RULE_COLUMNS = `id, course_id, assessment_id, below_score_percent, item_id, state, reason, retire_reason, revision, created_by, created_at, updated_by, updated_at`;

export function selectRuleQuery(id: string): SqlQuery {
  return { text: `SELECT ${RULE_COLUMNS} FROM academy_remediation_rules WHERE id = $1::uuid`, values: [id] };
}

export function listCourseRulesQuery(courseId: string): SqlQuery {
  return { text: `SELECT ${RULE_COLUMNS} FROM academy_remediation_rules WHERE course_id = $1::uuid ORDER BY created_at DESC LIMIT 500`, values: [courseId] };
}

export function listActiveAssessmentRulesQuery(assessmentId: string): SqlQuery {
  return { text: `SELECT ${RULE_COLUMNS} FROM academy_remediation_rules WHERE assessment_id = $1::uuid AND state = 'active'`, values: [assessmentId] };
}

export function insertRuleQuery(r: RemediationRuleRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_remediation_rules
      (id, course_id, assessment_id, below_score_percent, item_id, state, reason, retire_reason, revision, created_by, created_at, updated_by, updated_at)
    VALUES (${r.id}::uuid, ${r.courseId}::uuid, ${r.assessmentId}::uuid, ${r.belowScorePercent}, ${r.itemId}::uuid, ${r.state}, ${r.reason},
      ${r.retireReason}, ${r.revision}, ${r.createdBy}, ${r.createdAt}::timestamptz, ${r.updatedBy}, ${r.updatedAt}::timestamptz)
    RETURNING id`;
}

export function retireRuleQuery(r: RemediationRuleRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_remediation_rules SET state = ${r.state}, retire_reason = ${r.retireReason}, revision = ${r.revision},
      updated_by = ${r.updatedBy}, updated_at = ${r.updatedAt}::timestamptz
    WHERE id = ${r.id}::uuid AND revision = ${expectedRevision} AND state = 'active'
    RETURNING id`;
}

export function mapRuleRow(row: SqlRow): RemediationRuleRecord {
  return Object.freeze({
    id: str(row.id),
    courseId: str(row.course_id),
    assessmentId: str(row.assessment_id),
    belowScorePercent: num(row.below_score_percent),
    itemId: str(row.item_id),
    state: str(row.state) as RemediationRuleRecord["state"],
    reason: str(row.reason),
    retireReason: strOrNull(row.retire_reason),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
  });
}

const ASSIGNMENT_COLUMNS = `id, class_group_id, learner_uid, item_id, rule_id, source_attempt_id, note, state, state_reason, revision, assigned_by,
  assigned_at, resolved_at`;

export function selectRemediationQuery(id: string): SqlQuery {
  return { text: `SELECT ${ASSIGNMENT_COLUMNS} FROM academy_remediation_assignments WHERE id = $1::uuid`, values: [id] };
}

export function listLearnerRemediationQuery(classGroupId: string, learnerUid: string): SqlQuery {
  return {
    text: `SELECT ${ASSIGNMENT_COLUMNS} FROM academy_remediation_assignments WHERE class_group_id = $1::uuid AND learner_uid = $2
      ORDER BY assigned_at DESC LIMIT 500`,
    values: [classGroupId, learnerUid],
  };
}

export function insertRemediationQuery(r: RemediationAssignmentRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_remediation_assignments
      (id, class_group_id, learner_uid, item_id, rule_id, source_attempt_id, note, state, state_reason, revision, assigned_by, assigned_at, resolved_at)
    VALUES (${r.id}::uuid, ${r.classGroupId}::uuid, ${r.learnerUid}, ${r.itemId}::uuid, ${r.ruleId}::uuid, ${r.sourceAttemptId}::uuid, ${r.note},
      ${r.state}, ${r.stateReason}, ${r.revision}, ${r.assignedBy}, ${r.assignedAt}::timestamptz, NULL)
    ON CONFLICT DO NOTHING
    RETURNING id`;
}

export function resolveRemediationQuery(r: RemediationAssignmentRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_remediation_assignments SET state = ${r.state}, state_reason = ${r.stateReason}, revision = ${r.revision},
      resolved_at = ${r.resolvedAt}::timestamptz
    WHERE id = ${r.id}::uuid AND revision = ${expectedRevision} AND state = 'assigned'
    RETURNING id`;
}

export function mapRemediationRow(row: SqlRow): RemediationAssignmentRecord {
  return Object.freeze({
    id: str(row.id),
    classGroupId: str(row.class_group_id),
    learnerUid: str(row.learner_uid),
    itemId: str(row.item_id),
    ruleId: strOrNull(row.rule_id),
    sourceAttemptId: strOrNull(row.source_attempt_id),
    note: strOrNull(row.note),
    state: str(row.state) as RemediationState,
    stateReason: strOrNull(row.state_reason),
    revision: num(row.revision),
    assignedBy: str(row.assigned_by),
    assignedAt: iso(row.assigned_at),
    resolvedAt: isoOrNull(row.resolved_at),
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** One row per learner with an open or completed enrollment in the class group. */
export function selectClassGroupReportQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT e.learner_uid, e.state AS enrollment_state, p.full_name,
      (SELECT count(*) FROM academy_attendance_records a WHERE a.class_group_id = e.class_group_id AND a.learner_uid = e.learner_uid) AS attendance_recorded,
      (SELECT count(*) FROM academy_attendance_records a WHERE a.class_group_id = e.class_group_id AND a.learner_uid = e.learner_uid AND a.counts_as_attended) AS attendance_attended,
      (SELECT round(avg(best)) FROM (
         SELECT max(t.score_percent) AS best FROM academy_assessment_attempts t
         WHERE t.class_group_id = e.class_group_id AND t.learner_uid = e.learner_uid AND t.released_at IS NOT NULL AND t.score_percent IS NOT NULL
         GROUP BY t.assignment_id) s) AS assessment_average,
      (SELECT count(DISTINCT r.item_id) FROM academy_practice_results r WHERE r.class_group_id = e.class_group_id AND r.learner_uid = e.learner_uid) AS practice_items,
      (SELECT count(*) FROM academy_remediation_assignments m WHERE m.class_group_id = e.class_group_id AND m.learner_uid = e.learner_uid AND m.state = 'assigned') AS open_remediation
    FROM academy_enrollments e
    LEFT JOIN profiles p ON p.firebase_uid = e.learner_uid
    WHERE e.class_group_id = ${classGroupId}::uuid AND e.state IN ('active', 'suspended', 'completed')
    ORDER BY p.full_name NULLS LAST, e.learner_uid
    LIMIT 10000`;
}

export function selectProductionReportQuery(): SqlQuery {
  return {
    text: `SELECT
        (SELECT json_object_agg(kind, n) FROM (SELECT kind, count(*) AS n FROM academy_content_items GROUP BY kind) k)::text AS items_by_kind,
        (SELECT json_object_agg(state, n) FROM (SELECT state, count(*) AS n FROM academy_production_runs GROUP BY state) r)::text AS runs_by_state,
        (SELECT count(*) FROM academy_content_item_versions WHERE state = 'in_review') AS versions_in_review,
        (SELECT count(*) FROM academy_content_item_versions
           WHERE state IN ('draft', 'in_review', 'changes_requested', 'approved')
             AND (provenance IS NULL OR provenance ->> 'rightsStatus' <> 'cleared')) AS versions_awaiting_rights,
        (SELECT count(*) FROM academy_remediation_assignments WHERE state = 'assigned') AS open_remediation`,
    values: [],
  };
}
