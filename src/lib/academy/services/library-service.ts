/**
 * Library and reading for the academy.
 *
 * Administrators link library books to courses. Readers open books and pages
 * through one server-side access decision (library/access.ts); page-range
 * access never returns pages outside the granted ranges or the whole-book
 * file. Reading position is private to each reader.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import { expectRows } from "../repo/audit-repo.ts";
import {
  isPageAllowed,
  parsePageNumber,
  readerBookView,
  resolveReadingAccess,
  type BookRecord,
  type ReadingFacts,
} from "../library/access.ts";
import { planAddCourseResource, planReadingProgress, planRemoveCourseResource } from "../library/resources.ts";
import { authorize, authorizeAdminAction, type RelationshipFacts } from "../permissions/permissions.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import { mapClassGroupRow, selectClassGroupQuery } from "../repo/delivery-repo.ts";
import {
  insertCourseResourceQuery,
  listCourseResourcesQuery,
  mapBookRow,
  mapCourseResourceRow,
  mapReadingProgressRow,
  removeCourseResourceQuery,
  selectBookPageQuery,
  selectBookPagesQuery,
  selectBookQuery,
  selectBookSummariesQuery,
  selectCourseLessonIdsQuery,
  selectCourseResourceQuery,
  selectReadingProgressQuery,
  upsertReadingProgressQuery,
} from "../repo/library-repo.ts";
import { num, numOrNull, str, strOrNull } from "../repo/rows.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

export interface LibraryDeps extends ServiceDeps {
  readonly facts: RelationshipFacts;
  readonly readingFacts: ReadingFacts;
}

type Correlated = { readonly correlationId?: string | null };

export function createLibraryService(deps: LibraryDeps) {
  const { executor, facts, readingFacts } = deps;

  async function openBook(user: AuthUser, bookId: unknown) {
    const id = parseUuid(bookId, "bookId");
    const book = await loadOptional(executor, selectBookQuery(id), mapBookRow);
    // resolveReadingAccess refuses a missing book, so `book` is present below.
    const access = await resolveReadingAccess(user, book, readingFacts);
    return { book: book as BookRecord, access };
  }

  return {
    // -- Administration --------------------------------------------------------

    async listCourseResources(user: AuthUser, courseId: unknown, options: { readonly includeRemoved?: boolean } = {}) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "curriculum.modify");
      const course = await loadRequired(executor, selectCourseQuery(parseUuid(courseId, "courseId")), mapCourseRow, "Course not found.");
      return loadMany(executor, listCourseResourcesQuery(course.id, options.includeRemoved === true), mapCourseResourceRow);
    },

    async addCourseResource(
      user: AuthUser,
      courseId: unknown,
      input: Correlated & {
        readonly libraryBookId: unknown;
        readonly lessonId?: unknown;
        readonly purpose: unknown;
        readonly pagesFrom?: unknown;
        readonly pagesTo?: unknown;
        readonly note?: unknown;
      },
    ) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "curriculum.modify");
      const course = await loadRequired(executor, selectCourseQuery(parseUuid(courseId, "courseId")), mapCourseRow, "Course not found.");
      const book = await loadOptional(executor, selectBookQuery(parseUuid(input.libraryBookId, "libraryBookId")), mapBookRow);
      const [lessonRows, existing] = await Promise.all([
        executor.query(selectCourseLessonIdsQuery(course.id)),
        loadMany(executor, listCourseResourcesQuery(course.id, false), mapCourseResourceRow),
      ]);
      const plan = planAddCourseResource(
        { ...input, course, book, existing, courseLessonIds: new Set(lessonRows.map((row) => str(row.lesson_id))) },
        contextFor(user, deps, input.correlationId),
      );
      await runGuarded(executor, [audited(deps, insertCourseResourceQuery(plan.record), plan.audit)]);
      return plan.record;
    },

    async removeCourseResource(user: AuthUser, resourceId: unknown, input: Correlated & { readonly reason: unknown; readonly expectedRevision: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "curriculum.modify");
      const resource = await loadRequired(executor, selectCourseResourceQuery(parseUuid(resourceId, "resourceId")), mapCourseResourceRow, "Reading not found.");
      const plan = planRemoveCourseResource(resource, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, removeCourseResourceQuery(plan.record, resource.revision), plan.audit)]);
      return plan.record;
    },

    // -- Readers ---------------------------------------------------------------

    /** The reading list of a class group's course, for its participants. */
    async classGroupReadings(user: AuthUser, classGroupId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const group = await loadOptional(executor, selectClassGroupQuery(parseUuid(classGroupId, "classGroupId")), mapClassGroupRow);
      if (!group || group.deletedAt !== null) {
        if (user.role === "admin") throw new DomainError("NOT_FOUND", "Class group not found.");
        throw new AuthError("FORBIDDEN");
      }
      await authorize(user, { action: "class_group.view", courseId: group.courseId, classGroupId: group.id }, facts);
      const resources = await loadMany(executor, listCourseResourcesQuery(group.courseId, false), mapCourseResourceRow);
      const bookIds = [...new Set(resources.map((r) => r.libraryBookId))];
      const books = bookIds.length === 0 ? [] : await executor.query(selectBookSummariesQuery(bookIds));
      const byId = new Map(books.map((row) => [str(row.id), row]));
      return resources
        .filter((resource) => byId.has(resource.libraryBookId) && byId.get(resource.libraryBookId)?.is_published !== false)
        .map((resource) => {
          const row = byId.get(resource.libraryBookId)!;
          return {
            resourceId: resource.id,
            lessonId: resource.lessonId,
            purpose: resource.purpose,
            pages: resource.pagesFrom === null ? null : { from: resource.pagesFrom, to: resource.pagesTo },
            note: resource.note,
            book: {
              id: str(row.id),
              title: str(row.title),
              author: typeof row.author === "string" ? row.author : "",
              coverUrl: strOrNull(row.cover_url),
              pagesCount: numOrNull(row.pages_count),
            },
          };
        });
    },

    /** Book details for a reader, with the pages they may open. */
    async getBook(user: AuthUser, bookId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const { book, access } = await openBook(user, bookId);
      const pages = await executor.query(selectBookPagesQuery(book.id));
      return {
        book: readerBookView(book, access),
        pages: pages
          .map((row) => ({ pageNumber: num(row.page_number), imageUrl: str(row.image_url) }))
          .filter((page) => isPageAllowed(access, page.pageNumber)),
      };
    },

    async getPage(user: AuthUser, bookId: unknown, pageNumber: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const page = parsePageNumber(pageNumber);
      const { book, access } = await openBook(user, bookId);
      if (!isPageAllowed(access, page)) throw new AuthError("FORBIDDEN");
      const row = await loadOptional(executor, selectBookPageQuery(book.id, page), (r) => r);
      if (!row) throw new DomainError("NOT_FOUND", "Page not found.");
      return { bookId: book.id, pageNumber: page, imageUrl: str(row.image_url), text: strOrNull(row.text_content) };
    },

    async getReadingProgress(user: AuthUser, bookId: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const { book } = await openBook(user, bookId);
      return loadOptional(executor, selectReadingProgressQuery(user.uid, book.id), mapReadingProgressRow);
    },

    async saveReadingProgress(user: AuthUser, bookId: unknown, input: { readonly lastPage: unknown }) {
      assertAcademyCoreAvailable(deps.flags);
      const { book, access } = await openBook(user, bookId);
      const record = planReadingProgress(
        { userUid: user.uid, libraryBookId: book.id, lastPage: input.lastPage, pageAllowed: (page) => isPageAllowed(access, page) },
        { clock: deps.clock },
      );
      await runGuarded(executor, [expectRows(upsertReadingProgressQuery(record), 1)]);
      return record;
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
