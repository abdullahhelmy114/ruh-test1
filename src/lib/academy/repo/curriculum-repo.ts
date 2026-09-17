/**
 * Persistence for curriculum versions and their outlines.
 *
 * Version updates match both the revision and the state the planner started
 * from, so a concurrent review decision can never be overwritten. Outline
 * rows are replaced as a whole inside one transaction while the version is
 * still mutable; published outlines are never written again.
 */
import type { ContentVersionState } from "../domain/states.ts";
import { jsonParam, sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { CurriculumVersionRecord, Outline, OutlineLesson, OutlineUnit } from "../structure/curriculum.ts";
import { iso, isoOrNull, num, numOrNull, str, strOrNull } from "./rows.ts";

const VERSION_COLUMNS = `id, curriculum_id, version_number, based_on_version_id, state, revision, created_by, created_at,
  updated_at, submitted_at, reviewed_by, reviewed_at, published_by, published_at, superseded_at, archived_at`;

export function selectVersionQuery(id: string): SqlQuery {
  return { text: `SELECT ${VERSION_COLUMNS} FROM academy_curriculum_versions WHERE id = $1::uuid`, values: [id] };
}

export function listVersionsQuery(curriculumId: string): SqlQuery {
  return {
    text: `SELECT ${VERSION_COLUMNS} FROM academy_curriculum_versions WHERE curriculum_id = $1::uuid ORDER BY version_number DESC`,
    values: [curriculumId],
  };
}

export function insertVersionQuery(version: CurriculumVersionRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_curriculum_versions
      (id, curriculum_id, version_number, based_on_version_id, state, revision, created_by, created_at, updated_at)
    VALUES (${version.id}::uuid, ${version.parentId}::uuid, ${version.versionNumber}, ${version.basedOnVersionId}::uuid,
      ${version.state}, ${version.revision}, ${version.createdBy}, ${version.createdAt}::timestamptz, ${version.updatedAt}::timestamptz)
    RETURNING id`;
}

/** Writes a planned transition. Matches the revision and state the plan was made from. */
export function updateVersionQuery(
  version: CurriculumVersionRecord,
  expected: { readonly revision: number; readonly state: ContentVersionState },
): SqlQuery {
  return sqlQuery`UPDATE academy_curriculum_versions SET
      state = ${version.state}, revision = ${version.revision}, updated_at = ${version.updatedAt}::timestamptz,
      submitted_at = ${version.submittedAt}::timestamptz, reviewed_by = ${version.reviewedBy},
      reviewed_at = ${version.reviewedAt}::timestamptz, published_by = ${version.publishedBy},
      published_at = ${version.publishedAt}::timestamptz, superseded_at = ${version.supersededAt}::timestamptz,
      archived_at = ${version.archivedAt}::timestamptz
    WHERE id = ${version.id}::uuid AND revision = ${expected.revision} AND state = ${expected.state}
    RETURNING id`;
}

export function mapVersionRow(row: SqlRow): CurriculumVersionRecord {
  return Object.freeze({
    id: str(row.id),
    versionKind: "curriculum_version" as const,
    parentKind: "curriculum" as const,
    parentId: str(row.curriculum_id),
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
// Stable identities
// ---------------------------------------------------------------------------

export function selectIdentitiesQuery(curriculumId: string): SqlQuery {
  return sqlQuery`SELECT 'unit' AS kind, id FROM academy_units WHERE curriculum_id = ${curriculumId}::uuid
    UNION ALL
    SELECT 'lesson' AS kind, id FROM academy_lessons WHERE curriculum_id = ${curriculumId}::uuid`;
}

export function mapIdentities(rows: readonly SqlRow[]): { units: Set<string>; lessons: Set<string> } {
  const units = new Set<string>();
  const lessons = new Set<string>();
  for (const row of rows) {
    (row.kind === "unit" ? units : lessons).add(str(row.id));
  }
  return { units, lessons };
}

export function insertIdentitiesQuery(
  table: "academy_units" | "academy_lessons",
  curriculumId: string,
  ids: readonly string[],
  createdBy: string,
  createdAt: string,
): SqlQuery {
  const target = table === "academy_units" ? "academy_units" : "academy_lessons";
  return {
    text: `INSERT INTO ${target} (id, curriculum_id, created_by, created_at)
      SELECT new_id, $2::uuid, $3::text, $4::timestamptz FROM unnest($1::uuid[]) AS new_id
      RETURNING id`,
    values: [[...ids], curriculumId, createdBy, createdAt],
  };
}

// ---------------------------------------------------------------------------
// Outlines
// ---------------------------------------------------------------------------

export function selectOutlineUnitsQuery(versionId: string): SqlQuery {
  return sqlQuery`SELECT unit_id, position, title, summary FROM academy_curriculum_version_units
    WHERE curriculum_version_id = ${versionId}::uuid ORDER BY position`;
}

export function selectOutlineLessonsQuery(versionId: string): SqlQuery {
  return sqlQuery`SELECT lesson_id, unit_id, position, title, summary, planned_minutes FROM academy_curriculum_version_lessons
    WHERE curriculum_version_id = ${versionId}::uuid ORDER BY unit_id, position`;
}

export function mapOutline(unitRows: readonly SqlRow[], lessonRows: readonly SqlRow[]): Outline {
  const lessonsByUnit = new Map<string, OutlineLesson[]>();
  for (const row of lessonRows) {
    const lesson: OutlineLesson = Object.freeze({
      lessonId: str(row.lesson_id),
      unitId: str(row.unit_id),
      position: num(row.position),
      title: str(row.title),
      summary: strOrNull(row.summary),
      plannedMinutes: numOrNull(row.planned_minutes),
    });
    const list = lessonsByUnit.get(lesson.unitId) ?? [];
    list.push(lesson);
    lessonsByUnit.set(lesson.unitId, list);
  }
  const units: OutlineUnit[] = [...unitRows]
    .map((row) => {
      const unitId = str(row.unit_id);
      const lessons = (lessonsByUnit.get(unitId) ?? []).sort((a, b) => a.position - b.position);
      return Object.freeze({
        unitId,
        position: num(row.position),
        title: str(row.title),
        summary: strOrNull(row.summary),
        lessons: Object.freeze(lessons),
      });
    })
    .sort((a, b) => a.position - b.position);
  return Object.freeze({ units: Object.freeze(units) });
}

export function deleteOutlineLessonsQuery(versionId: string): SqlQuery {
  return sqlQuery`DELETE FROM academy_curriculum_version_lessons WHERE curriculum_version_id = ${versionId}::uuid`;
}

export function deleteOutlineUnitsQuery(versionId: string): SqlQuery {
  return sqlQuery`DELETE FROM academy_curriculum_version_units WHERE curriculum_version_id = ${versionId}::uuid`;
}

export function insertOutlineUnitsQuery(versionId: string, curriculumId: string, outline: Outline): SqlQuery {
  const rows = outline.units.map((unit) => ({ unit_id: unit.unitId, position: unit.position, title: unit.title, summary: unit.summary }));
  return sqlQuery`INSERT INTO academy_curriculum_version_units (curriculum_version_id, curriculum_id, unit_id, position, title, summary)
    SELECT ${versionId}::uuid, ${curriculumId}::uuid, x.unit_id, x.position, x.title, x.summary
    FROM jsonb_to_recordset(${jsonParam(rows)}::jsonb) AS x(unit_id uuid, position integer, title text, summary text)`;
}

export function insertOutlineLessonsQuery(versionId: string, curriculumId: string, outline: Outline): SqlQuery {
  const rows = outline.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({
      lesson_id: lesson.lessonId,
      unit_id: unit.unitId,
      position: lesson.position,
      title: lesson.title,
      summary: lesson.summary,
      planned_minutes: lesson.plannedMinutes,
    })),
  );
  return sqlQuery`INSERT INTO academy_curriculum_version_lessons
      (curriculum_version_id, curriculum_id, lesson_id, unit_id, position, title, summary, planned_minutes)
    SELECT ${versionId}::uuid, ${curriculumId}::uuid, x.lesson_id, x.unit_id, x.position, x.title, x.summary, x.planned_minutes
    FROM jsonb_to_recordset(${jsonParam(rows)}::jsonb)
      AS x(lesson_id uuid, unit_id uuid, position integer, title text, summary text, planned_minutes integer)`;
}

/** Copies the outline of `baseVersionId` into a freshly created draft. */
export function copyOutlineUnitsQuery(newVersionId: string, baseVersionId: string): SqlQuery {
  return sqlQuery`INSERT INTO academy_curriculum_version_units (curriculum_version_id, curriculum_id, unit_id, position, title, summary)
    SELECT ${newVersionId}::uuid, curriculum_id, unit_id, position, title, summary
    FROM academy_curriculum_version_units WHERE curriculum_version_id = ${baseVersionId}::uuid`;
}

export function copyOutlineLessonsQuery(newVersionId: string, baseVersionId: string): SqlQuery {
  return sqlQuery`INSERT INTO academy_curriculum_version_lessons
      (curriculum_version_id, curriculum_id, lesson_id, unit_id, position, title, summary, planned_minutes)
    SELECT ${newVersionId}::uuid, curriculum_id, lesson_id, unit_id, position, title, summary, planned_minutes
    FROM academy_curriculum_version_lessons WHERE curriculum_version_id = ${baseVersionId}::uuid`;
}

export function selectLessonIdsInVersionQuery(versionId: string): SqlQuery {
  return sqlQuery`SELECT lesson_id FROM academy_curriculum_version_lessons WHERE curriculum_version_id = ${versionId}::uuid`;
}

export function mapLessonIdSet(rows: readonly SqlRow[]): Set<string> {
  return new Set(rows.map((row) => str(row.lesson_id)));
}

/** The academy's publication gate definition decides whether a reviewer may approve their own work. */
export function selectPublicationGateDefinitionQuery(): SqlQuery {
  return sqlQuery`SELECT gate_type, required_approvals, eligible_roles, allow_self_approval
    FROM academy_approval_gate_definitions WHERE gate_type = 'publication'`;
}
