/**
 * Persistence for lesson scripts, their versions, private annotations and
 * teacher preparation.
 *
 * Privacy: annotation queries always filter by owner, and administrator
 * preparation views select status columns only (never private notes).
 */
import type { ContentVersionState, PreparationState } from "../domain/states.ts";
import { jsonParam, sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { AnnotationColor, AnnotationKind, AnnotationRecord } from "../lessons/annotations.ts";
import type { LessonContent } from "../lessons/content.ts";
import type { PreparationRecord, PreparationStatusView } from "../lessons/preparation.ts";
import type { VersionRecord } from "../governance/versioning.ts";
import { iso, isoOrNull, num, numOrNull, str, strOrNull } from "./rows.ts";

// ---------------------------------------------------------------------------
// Lessons and scripts
// ---------------------------------------------------------------------------

export interface LessonScriptRecord {
  readonly id: string;
  readonly lessonId: string;
  readonly curriculumId: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface LessonIdentity {
  readonly lessonId: string;
  readonly curriculumId: string;
  readonly courseId: string;
}

export function selectLessonIdentityQuery(lessonId: string): SqlQuery {
  return sqlQuery`SELECT l.id AS lesson_id, l.curriculum_id, c.course_id
    FROM academy_lessons l JOIN academy_curricula c ON c.id = l.curriculum_id
    WHERE l.id = ${lessonId}::uuid`;
}

export function mapLessonIdentity(row: SqlRow): LessonIdentity {
  return Object.freeze({ lessonId: str(row.lesson_id), curriculumId: str(row.curriculum_id), courseId: str(row.course_id) });
}

/** The lesson's title as taught to a class group (its pinned version first, then the newest version). */
export function selectLessonTitleQuery(lessonId: string, preferredVersionId: string): SqlQuery {
  return sqlQuery`SELECT vl.title, vl.summary FROM academy_curriculum_version_lessons vl
    JOIN academy_curriculum_versions v ON v.id = vl.curriculum_version_id
    WHERE vl.lesson_id = ${lessonId}::uuid
    ORDER BY (vl.curriculum_version_id = ${preferredVersionId}::uuid) DESC, v.version_number DESC
    LIMIT 1`;
}

export function selectScriptByLessonQuery(lessonId: string): SqlQuery {
  return sqlQuery`SELECT id, lesson_id, curriculum_id, created_by, created_at FROM academy_lesson_scripts WHERE lesson_id = ${lessonId}::uuid`;
}

export function selectScriptQuery(id: string): SqlQuery {
  return sqlQuery`SELECT id, lesson_id, curriculum_id, created_by, created_at FROM academy_lesson_scripts WHERE id = ${id}::uuid`;
}

export function insertScriptQuery(script: LessonScriptRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_lesson_scripts (id, lesson_id, curriculum_id, created_by, created_at)
    VALUES (${script.id}::uuid, ${script.lessonId}::uuid, ${script.curriculumId}::uuid, ${script.createdBy}, ${script.createdAt}::timestamptz)
    RETURNING id`;
}

export function mapScriptRow(row: SqlRow): LessonScriptRecord {
  return Object.freeze({
    id: str(row.id),
    lessonId: str(row.lesson_id),
    curriculumId: str(row.curriculum_id),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
  });
}

// ---------------------------------------------------------------------------
// Script versions
// ---------------------------------------------------------------------------

export interface LessonScriptVersionRecord extends VersionRecord {
  readonly revision: number;
}

const VERSION_META = `id, lesson_script_id, version_number, based_on_version_id, state, revision, created_by, created_at, updated_at,
  submitted_at, reviewed_by, reviewed_at, published_by, published_at, superseded_at, archived_at`;

export function selectScriptVersionQuery(id: string): SqlQuery {
  return { text: `SELECT ${VERSION_META}, content FROM academy_lesson_script_versions WHERE id = $1::uuid`, values: [id] };
}

/** Version history without content (content can be large). */
export function listScriptVersionsQuery(scriptId: string): SqlQuery {
  return {
    text: `SELECT ${VERSION_META} FROM academy_lesson_script_versions WHERE lesson_script_id = $1::uuid ORDER BY version_number DESC`,
    values: [scriptId],
  };
}

export function selectPublishedScriptVersionQuery(scriptId: string): SqlQuery {
  return {
    text: `SELECT ${VERSION_META}, content FROM academy_lesson_script_versions WHERE lesson_script_id = $1::uuid AND state = 'published'`,
    values: [scriptId],
  };
}

export function insertScriptVersionQuery(version: LessonScriptVersionRecord, content: LessonContent): SqlQuery {
  return sqlQuery`INSERT INTO academy_lesson_script_versions
      (id, lesson_script_id, version_number, based_on_version_id, state, revision, content, created_by, created_at, updated_at)
    VALUES (${version.id}::uuid, ${version.parentId}::uuid, ${version.versionNumber}, ${version.basedOnVersionId}::uuid,
      ${version.state}, ${version.revision}, ${jsonParam(content)}::jsonb, ${version.createdBy}, ${version.createdAt}::timestamptz,
      ${version.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateScriptVersionStateQuery(
  version: LessonScriptVersionRecord,
  expected: { readonly revision: number; readonly state: ContentVersionState },
): SqlQuery {
  return sqlQuery`UPDATE academy_lesson_script_versions SET
      state = ${version.state}, revision = ${version.revision}, updated_at = ${version.updatedAt}::timestamptz,
      submitted_at = ${version.submittedAt}::timestamptz, reviewed_by = ${version.reviewedBy},
      reviewed_at = ${version.reviewedAt}::timestamptz, published_by = ${version.publishedBy},
      published_at = ${version.publishedAt}::timestamptz, superseded_at = ${version.supersededAt}::timestamptz,
      archived_at = ${version.archivedAt}::timestamptz
    WHERE id = ${version.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

/** Content can only be written while the version is still held by its author. */
export function updateScriptVersionContentQuery(version: LessonScriptVersionRecord, content: LessonContent, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_lesson_script_versions SET
      content = ${jsonParam(content)}::jsonb, revision = ${version.revision}, updated_at = ${version.updatedAt}::timestamptz
    WHERE id = ${version.id}::uuid AND revision = ${expectedRevision} AND state IN ('draft', 'changes_requested')
    RETURNING id`;
}

export function mapScriptVersionRow(row: SqlRow): LessonScriptVersionRecord {
  return Object.freeze({
    id: str(row.id),
    versionKind: "lesson_script_version" as const,
    parentKind: "lesson_script" as const,
    parentId: str(row.lesson_script_id),
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

// ---------------------------------------------------------------------------
// Sessions (for the release rule)
// ---------------------------------------------------------------------------

export function selectLessonSessionsQuery(classGroupId: string, lessonId: string): SqlQuery {
  return sqlQuery`SELECT id, starts_at, state FROM academy_sessions
    WHERE class_group_id = ${classGroupId}::uuid AND lesson_id = ${lessonId}::uuid`;
}

/** Every session of a class group with its lesson title, for availability listings. */
export function selectClassGroupSheetSessionsQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT s.id, s.lesson_id, s.starts_at, s.state, vl.title AS lesson_title
    FROM academy_sessions s
    JOIN academy_curriculum_version_lessons vl
      ON vl.curriculum_version_id = s.curriculum_version_id AND vl.lesson_id = s.lesson_id
    WHERE s.class_group_id = ${classGroupId}::uuid
    ORDER BY s.starts_at ASC, s.id ASC
    LIMIT 1000`;
}

// ---------------------------------------------------------------------------
// Annotations (always owner-scoped)
// ---------------------------------------------------------------------------

const ANNOTATION_COLUMNS = `id, owner_uid, lesson_script_id, script_version_id, class_group_id, block_id, range_start, range_end, quote,
  kind, color, body, revision, created_at, updated_at, deleted_at`;

export function listOwnAnnotationsQuery(ownerUid: string, lessonScriptId: string): SqlQuery {
  return {
    text: `SELECT ${ANNOTATION_COLUMNS} FROM academy_lesson_annotations
      WHERE owner_uid = $1 AND lesson_script_id = $2::uuid AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC LIMIT 1000`,
    values: [ownerUid, lessonScriptId],
  };
}

/** Looks up one annotation for its owner only: other people's annotations are simply not found. */
export function selectOwnAnnotationQuery(ownerUid: string, annotationId: string): SqlQuery {
  return {
    text: `SELECT ${ANNOTATION_COLUMNS} FROM academy_lesson_annotations WHERE id = $1::uuid AND owner_uid = $2`,
    values: [annotationId, ownerUid],
  };
}

export function insertAnnotationQuery(record: AnnotationRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_lesson_annotations
      (id, owner_uid, lesson_script_id, script_version_id, class_group_id, block_id, range_start, range_end, quote,
       kind, color, body, revision, created_at, updated_at)
    VALUES (${record.id}::uuid, ${record.ownerUid}, ${record.lessonScriptId}::uuid, ${record.scriptVersionId}::uuid,
      ${record.classGroupId}::uuid, ${record.blockId}::uuid, ${record.range?.start ?? null}::integer, ${record.range?.end ?? null}::integer,
      ${record.quote}, ${record.kind}, ${record.color}, ${record.body}, ${record.revision},
      ${record.createdAt}::timestamptz, ${record.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateAnnotationQuery(record: AnnotationRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_lesson_annotations SET
      kind = ${record.kind}, color = ${record.color}, body = ${record.body}, revision = ${record.revision},
      updated_at = ${record.updatedAt}::timestamptz, deleted_at = ${record.deletedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND owner_uid = ${record.ownerUid} AND revision = ${expectedRevision} AND deleted_at IS NULL
    RETURNING id`;
}

export function mapAnnotationRow(row: SqlRow): AnnotationRecord {
  const start = numOrNull(row.range_start);
  const end = numOrNull(row.range_end);
  return Object.freeze({
    id: str(row.id),
    ownerUid: str(row.owner_uid),
    lessonScriptId: str(row.lesson_script_id),
    scriptVersionId: str(row.script_version_id),
    classGroupId: strOrNull(row.class_group_id),
    blockId: str(row.block_id),
    range: start === null || end === null ? null : { start, end },
    quote: strOrNull(row.quote),
    kind: str(row.kind) as AnnotationKind,
    color: str(row.color) as AnnotationColor,
    body: strOrNull(row.body),
    revision: num(row.revision),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    deletedAt: isoOrNull(row.deleted_at),
  });
}

// ---------------------------------------------------------------------------
// Preparation
// ---------------------------------------------------------------------------

export function selectOwnPreparationQuery(sessionId: string, teacherUid: string): SqlQuery {
  return sqlQuery`SELECT session_id, teacher_uid, status, private_notes, revision, created_at, updated_at, ready_at
    FROM academy_session_preparations WHERE session_id = ${sessionId}::uuid AND teacher_uid = ${teacherUid}`;
}

/** Administrative view: status only, private notes are never selected. */
export function listPreparationStatusesQuery(sessionId: string): SqlQuery {
  return sqlQuery`SELECT session_id, teacher_uid, status, updated_at, ready_at
    FROM academy_session_preparations WHERE session_id = ${sessionId}::uuid ORDER BY teacher_uid`;
}

export function insertPreparationQuery(record: PreparationRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_session_preparations
      (session_id, teacher_uid, status, private_notes, revision, created_at, updated_at, ready_at)
    VALUES (${record.sessionId}::uuid, ${record.teacherUid}, ${record.status}, ${record.privateNotes}, ${record.revision},
      ${record.createdAt}::timestamptz, ${record.updatedAt}::timestamptz, ${record.readyAt}::timestamptz)
    ON CONFLICT DO NOTHING
    RETURNING session_id`;
}

export function updatePreparationQuery(record: PreparationRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_session_preparations SET
      status = ${record.status}, private_notes = ${record.privateNotes}, revision = ${record.revision},
      updated_at = ${record.updatedAt}::timestamptz, ready_at = ${record.readyAt}::timestamptz
    WHERE session_id = ${record.sessionId}::uuid AND teacher_uid = ${record.teacherUid} AND revision = ${expectedRevision}
    RETURNING session_id`;
}

export function mapPreparationRow(row: SqlRow): PreparationRecord {
  return Object.freeze({
    sessionId: str(row.session_id),
    teacherUid: str(row.teacher_uid),
    status: str(row.status) as PreparationState,
    privateNotes: strOrNull(row.private_notes),
    revision: num(row.revision),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    readyAt: isoOrNull(row.ready_at),
  });
}

export function mapPreparationStatusRow(row: SqlRow): PreparationStatusView {
  return Object.freeze({
    sessionId: str(row.session_id),
    teacherUid: str(row.teacher_uid),
    status: str(row.status) as PreparationState,
    updatedAt: iso(row.updated_at),
    readyAt: isoOrNull(row.ready_at),
  });
}
