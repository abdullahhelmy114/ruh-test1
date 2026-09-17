/**
 * Persistence for programs, courses and curricula.
 *
 * Updates are optimistic: they match `revision = expected` and return the id,
 * so callers wrap them with `withAuditExpectOne` and a stale edit aborts the
 * whole transaction.
 */
import type { CatalogState } from "../domain/states.ts";
import { sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { CourseRecord, CurriculumRecord, ProgramRecord } from "../structure/catalog.ts";
import { iso, isoOrNull, num, str, strOrNull } from "./rows.ts";

export const MAX_LIST = 200;

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(Math.trunc(limit ?? MAX_LIST), 1), MAX_LIST);
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

const PROGRAM_COLUMNS = `id, slug, title, description, status, revision, created_by, created_at, updated_by, updated_at,
  deleted_at, deleted_by, deletion_reason`;

export function selectProgramQuery(id: string): SqlQuery {
  return { text: `SELECT ${PROGRAM_COLUMNS} FROM academy_programs WHERE id = $1::uuid`, values: [id] };
}

export function listProgramsQuery(options: { readonly includeDeleted?: boolean; readonly limit?: number }): SqlQuery {
  return {
    text: `SELECT ${PROGRAM_COLUMNS} FROM academy_programs
      WHERE ($1::boolean OR deleted_at IS NULL)
      ORDER BY title ASC, id ASC LIMIT $2`,
    values: [options.includeDeleted === true, clampLimit(options.limit)],
  };
}

export function insertProgramQuery(record: ProgramRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_programs
      (id, slug, title, description, status, revision, created_by, created_at, updated_by, updated_at)
    VALUES (${record.id}::uuid, ${record.slug}, ${record.title}, ${record.description}, ${record.status}, ${record.revision},
      ${record.createdBy}, ${record.createdAt}::timestamptz, ${record.updatedBy}, ${record.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateProgramQuery(record: ProgramRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_programs SET
      title = ${record.title}, description = ${record.description}, status = ${record.status},
      revision = ${record.revision}, updated_by = ${record.updatedBy}, updated_at = ${record.updatedAt}::timestamptz,
      deleted_at = ${record.deletedAt}::timestamptz, deleted_by = ${record.deletedBy}, deletion_reason = ${record.deletionReason}
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
}

export function mapProgramRow(row: SqlRow): ProgramRecord {
  return Object.freeze({
    id: str(row.id),
    slug: str(row.slug),
    title: str(row.title),
    description: strOrNull(row.description),
    status: str(row.status) as CatalogState,
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
    deletedAt: isoOrNull(row.deleted_at),
    deletedBy: strOrNull(row.deleted_by),
    deletionReason: strOrNull(row.deletion_reason),
  });
}

/** Courses still attached to a program (deleted courses excluded). */
export function countProgramCoursesQuery(programId: string): SqlQuery {
  return sqlQuery`SELECT count(*) AS n FROM academy_courses WHERE program_id = ${programId}::uuid AND deleted_at IS NULL`;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

const COURSE_COLUMNS = `id, program_id, catalog_course_id, slug, title, description, status, revision, created_by, created_at,
  updated_by, updated_at, deleted_at, deleted_by, deletion_reason`;

export function selectCourseQuery(id: string): SqlQuery {
  return { text: `SELECT ${COURSE_COLUMNS} FROM academy_courses WHERE id = $1::uuid`, values: [id] };
}

export function listCoursesQuery(options: {
  readonly programId?: string | null;
  readonly includeDeleted?: boolean;
  readonly limit?: number;
}): SqlQuery {
  return {
    text: `SELECT ${COURSE_COLUMNS} FROM academy_courses
      WHERE ($1::boolean OR deleted_at IS NULL)
        AND ($2::uuid IS NULL OR program_id = $2::uuid)
      ORDER BY title ASC, id ASC LIMIT $3`,
    values: [options.includeDeleted === true, options.programId ?? null, clampLimit(options.limit)],
  };
}

export function insertCourseQuery(record: CourseRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_courses
      (id, program_id, catalog_course_id, slug, title, description, status, revision, created_by, created_at, updated_by, updated_at)
    VALUES (${record.id}::uuid, ${record.programId}::uuid, ${record.catalogCourseId}::uuid, ${record.slug}, ${record.title},
      ${record.description}, ${record.status}, ${record.revision}, ${record.createdBy}, ${record.createdAt}::timestamptz,
      ${record.updatedBy}, ${record.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateCourseQuery(record: CourseRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_courses SET
      program_id = ${record.programId}::uuid, title = ${record.title}, description = ${record.description},
      status = ${record.status}, revision = ${record.revision}, updated_by = ${record.updatedBy},
      updated_at = ${record.updatedAt}::timestamptz, deleted_at = ${record.deletedAt}::timestamptz,
      deleted_by = ${record.deletedBy}, deletion_reason = ${record.deletionReason}
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
}

export function mapCourseRow(row: SqlRow): CourseRecord {
  return Object.freeze({
    id: str(row.id),
    programId: strOrNull(row.program_id),
    catalogCourseId: strOrNull(row.catalog_course_id),
    slug: str(row.slug),
    title: str(row.title),
    description: strOrNull(row.description),
    status: str(row.status) as CatalogState,
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
    deletedAt: isoOrNull(row.deleted_at),
    deletedBy: strOrNull(row.deleted_by),
    deletionReason: strOrNull(row.deletion_reason),
  });
}

/** Class groups of a course that are still planned or running. */
export function countOpenClassGroupsQuery(courseId: string): SqlQuery {
  return sqlQuery`SELECT count(*) AS n FROM academy_class_groups
    WHERE course_id = ${courseId}::uuid AND deleted_at IS NULL AND status IN ('planned', 'active')`;
}

// ---------------------------------------------------------------------------
// Curricula
// ---------------------------------------------------------------------------

export function insertCurriculumQuery(curriculum: CurriculumRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_curricula (id, course_id, created_by, created_at)
    VALUES (${curriculum.id}::uuid, ${curriculum.courseId}::uuid, ${curriculum.createdBy}, ${curriculum.createdAt}::timestamptz)
    RETURNING id`;
}

export function selectCurriculumByCourseQuery(courseId: string): SqlQuery {
  return sqlQuery`SELECT id, course_id, created_by, created_at FROM academy_curricula WHERE course_id = ${courseId}::uuid`;
}

export function selectCurriculumQuery(id: string): SqlQuery {
  return sqlQuery`SELECT id, course_id, created_by, created_at FROM academy_curricula WHERE id = ${id}::uuid`;
}

export function mapCurriculumRow(row: SqlRow): CurriculumRecord {
  return Object.freeze({
    id: str(row.id),
    courseId: str(row.course_id),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
  });
}

export function countOf(rows: readonly SqlRow[]): number {
  return rows.length === 0 ? 0 : num(rows[0].n);
}
