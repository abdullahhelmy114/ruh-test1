/**
 * Library persistence for the academy.
 *
 * Books, pages and library entitlements are READ from the existing library
 * tables; the academy never writes to them. Course reading links and
 * reading progress live in academy_* tables.
 */
import { isUid, isUuid } from "../domain/ids.ts";
import { sqlQuery, type SqlExecutor, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type { BookRecord, CourseReadingGrant, ReadingFacts } from "../library/access.ts";
import type { CourseResourceRecord, ReadingProgressRecord, ResourcePurpose } from "../library/resources.ts";
import { iso, isoOrNull, num, numOrNull, str, strOrNull } from "./rows.ts";

// ---------------------------------------------------------------------------
// Existing library (read-only)
// ---------------------------------------------------------------------------

export function selectBookQuery(bookId: string): SqlQuery {
  return sqlQuery`SELECT id, title, author, description, cover_url, pdf_url, pages_count, is_published
    FROM library_books WHERE id = ${bookId}::uuid`;
}

/** Catalogue details for several books; never includes the whole-book file link. */
export function selectBookSummariesQuery(bookIds: readonly string[]): SqlQuery {
  return {
    text: `SELECT id, title, author, cover_url, pages_count, is_published FROM library_books WHERE id = ANY($1::uuid[])`,
    values: [[...bookIds]],
  };
}

export function selectBookPagesQuery(bookId: string): SqlQuery {
  return sqlQuery`SELECT page_number, image_url FROM library_pages WHERE book_id = ${bookId}::uuid ORDER BY page_number ASC`;
}

export function selectBookPageQuery(bookId: string, pageNumber: number): SqlQuery {
  return sqlQuery`SELECT page_number, image_url, text_content FROM library_pages
    WHERE book_id = ${bookId}::uuid AND page_number = ${pageNumber}::integer`;
}

export function mapBookRow(row: SqlRow): BookRecord {
  return Object.freeze({
    id: str(row.id),
    title: str(row.title),
    author: typeof row.author === "string" ? row.author : "",
    description: strOrNull(row.description),
    coverUrl: strOrNull(row.cover_url),
    pdfUrl: strOrNull(row.pdf_url),
    pagesCount: numOrNull(row.pages_count),
    // The existing column defaults to true; only an explicit false hides a book.
    isPublished: row.is_published !== false,
  });
}

/** Mirrors the existing library entitlement rule (an unexpired library_access row). */
export function selectLibraryEntitlementQuery(uid: string): SqlQuery {
  return sqlQuery`SELECT 1 FROM library_access WHERE user_uid = ${uid} AND (expires_at IS NULL OR expires_at > now()) LIMIT 1`;
}

export function selectLearnerCourseGrantsQuery(uid: string, bookId: string): SqlQuery {
  return sqlQuery`SELECT r.course_id, r.pages_from, r.pages_to FROM academy_course_resources r
    WHERE r.library_book_id = ${bookId}::uuid AND r.removed_at IS NULL
      AND EXISTS (
        SELECT 1 FROM academy_enrollments e
        JOIN academy_class_groups cg ON cg.id = e.class_group_id
        JOIN academy_courses c ON c.id = e.course_id
        WHERE e.course_id = r.course_id AND e.learner_uid = ${uid} AND e.state = 'active'
          AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active') AND c.deleted_at IS NULL)`;
}

export function selectTeacherCourseGrantsQuery(uid: string, bookId: string): SqlQuery {
  return sqlQuery`SELECT r.course_id, r.pages_from, r.pages_to FROM academy_course_resources r
    WHERE r.library_book_id = ${bookId}::uuid AND r.removed_at IS NULL
      AND EXISTS (
        SELECT 1 FROM academy_class_group_teachers t
        JOIN academy_class_groups cg ON cg.id = t.class_group_id
        WHERE cg.course_id = r.course_id AND t.teacher_uid = ${uid} AND t.unassigned_at IS NULL
          AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active', 'completed'))`;
}

export function createSqlReadingFacts(executor: SqlExecutor): ReadingFacts {
  return {
    async hasLibraryEntitlement(uid) {
      if (!isUid(uid)) return false;
      return (await executor.query(selectLibraryEntitlementQuery(uid))).length > 0;
    },
    async courseGrants(user, bookId): Promise<CourseReadingGrant[]> {
      if (!isUid(user.uid) || !isUuid(bookId)) return [];
      let query: SqlQuery;
      if (user.role === "student") query = selectLearnerCourseGrantsQuery(user.uid, bookId);
      else if (user.role === "teacher") query = selectTeacherCourseGrantsQuery(user.uid, bookId);
      else return [];
      const rows = await executor.query(query);
      return rows.map((row) => {
        const from = numOrNull(row.pages_from);
        const to = numOrNull(row.pages_to);
        return { courseId: str(row.course_id), range: from === null || to === null ? null : { from, to } };
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Course reading resources
// ---------------------------------------------------------------------------

const RESOURCE_COLUMNS = `id, course_id, lesson_id, library_book_id, purpose, pages_from, pages_to, note, revision, created_by, created_at,
  removed_at, removed_by, remove_reason`;

export function listCourseResourcesQuery(courseId: string, includeRemoved: boolean): SqlQuery {
  return {
    text: `SELECT ${RESOURCE_COLUMNS} FROM academy_course_resources
      WHERE course_id = $1::uuid AND ($2::boolean OR removed_at IS NULL)
      ORDER BY purpose ASC, created_at ASC, id ASC LIMIT 1000`,
    values: [courseId, includeRemoved],
  };
}

export function selectCourseResourceQuery(id: string): SqlQuery {
  return { text: `SELECT ${RESOURCE_COLUMNS} FROM academy_course_resources WHERE id = $1::uuid`, values: [id] };
}

export function selectCourseLessonIdsQuery(courseId: string): SqlQuery {
  return sqlQuery`SELECT l.id AS lesson_id FROM academy_lessons l JOIN academy_curricula c ON c.id = l.curriculum_id
    WHERE c.course_id = ${courseId}::uuid`;
}

export function insertCourseResourceQuery(record: CourseResourceRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_course_resources
      (id, course_id, lesson_id, library_book_id, purpose, pages_from, pages_to, note, revision, created_by, created_at)
    VALUES (${record.id}::uuid, ${record.courseId}::uuid, ${record.lessonId}::uuid, ${record.libraryBookId}::uuid, ${record.purpose},
      ${record.pagesFrom}::integer, ${record.pagesTo}::integer, ${record.note}, ${record.revision}, ${record.createdBy},
      ${record.createdAt}::timestamptz)
    RETURNING id`;
}

export function removeCourseResourceQuery(record: CourseResourceRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_course_resources SET
      revision = ${record.revision}, removed_at = ${record.removedAt}::timestamptz, removed_by = ${record.removedBy},
      remove_reason = ${record.removeReason}
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision} AND removed_at IS NULL
    RETURNING id`;
}

export function mapCourseResourceRow(row: SqlRow): CourseResourceRecord {
  return Object.freeze({
    id: str(row.id),
    courseId: str(row.course_id),
    lessonId: strOrNull(row.lesson_id),
    libraryBookId: str(row.library_book_id),
    purpose: str(row.purpose) as ResourcePurpose,
    pagesFrom: numOrNull(row.pages_from),
    pagesTo: numOrNull(row.pages_to),
    note: strOrNull(row.note),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    removedAt: isoOrNull(row.removed_at),
    removedBy: strOrNull(row.removed_by),
    removeReason: strOrNull(row.remove_reason),
  });
}

// ---------------------------------------------------------------------------
// Reading progress (owner-scoped)
// ---------------------------------------------------------------------------

export function selectReadingProgressQuery(uid: string, bookId: string): SqlQuery {
  return sqlQuery`SELECT user_uid, library_book_id, last_page, updated_at FROM academy_reading_progress
    WHERE user_uid = ${uid} AND library_book_id = ${bookId}::uuid`;
}

export function upsertReadingProgressQuery(record: ReadingProgressRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_reading_progress (user_uid, library_book_id, last_page, updated_at)
    VALUES (${record.userUid}, ${record.libraryBookId}::uuid, ${record.lastPage}, ${record.updatedAt}::timestamptz)
    ON CONFLICT (user_uid, library_book_id) DO UPDATE SET last_page = EXCLUDED.last_page, updated_at = EXCLUDED.updated_at
    RETURNING user_uid`;
}

export function mapReadingProgressRow(row: SqlRow): ReadingProgressRecord {
  return Object.freeze({
    userUid: str(row.user_uid),
    libraryBookId: str(row.library_book_id),
    lastPage: num(row.last_page),
    updatedAt: iso(row.updated_at),
  });
}
