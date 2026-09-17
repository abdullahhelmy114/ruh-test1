/**
 * Library and reading.
 *
 * Required invariants covered here: one server-side reading decision;
 * unpublished books are invisible to non-administrators; page-range access
 * never returns other pages or the whole-book file; unauthorised readers
 * get nothing, and no page is loaded before access is decided; reading
 * progress is the caller's own; only administrators link readings; and the
 * academy never writes to the existing library tables.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import { AuthError } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";
import {
  isPageAllowed,
  mergeRanges,
  parsePageNumber,
  readerBookView,
  resolveReadingAccess,
  type BookRecord,
  type ReadingFacts,
} from "../../src/lib/academy/library/access.ts";
import { planAddCourseResource, planReadingProgress, planRemoveCourseResource } from "../../src/lib/academy/library/resources.ts";
import type { RelationshipFacts } from "../../src/lib/academy/permissions/permissions.ts";
import { mapCourseRow } from "../../src/lib/academy/repo/catalog-repo.ts";
import * as libraryRepo from "../../src/lib/academy/repo/library-repo.ts";
import { createLibraryService } from "../../src/lib/academy/services/library-service.ts";
import {
  IDS,
  admin,
  assertWellFormed,
  classGroupRow,
  courseRow,
  expectDomain,
  fakeExecutor,
  fixedClock,
  rejectsDomain,
  rejectsForbidden,
  sequentialIds,
  student,
  teacher,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const BOOK = "b5000000-0000-4000-8000-000000000001";
const outsider: AuthUser = { uid: "student-2", profileId: "p-s2", role: "student", email: "s2@example.test" };

const book: BookRecord = {
  id: BOOK, title: "Al-Ajurrumiyya", author: "Ibn Ajurrum", description: null, coverUrl: "https://img.example.test/c.jpg",
  pdfUrl: "https://files.example.test/whole-book.pdf", pagesCount: 120, isPublished: true,
};

function readingFacts(options: { entitled?: string[]; grants?: Record<string, { courseId: string; range: { from: number; to: number } | null }[]> } = {}): ReadingFacts {
  return {
    async hasLibraryEntitlement(uid) {
      return (options.entitled ?? []).includes(uid);
    },
    async courseGrants(user) {
      return options.grants?.[user.uid] ?? [];
    },
  };
}

describe("reading access", () => {
  test("ranges merge when they overlap or touch", () => {
    assert.deepEqual(mergeRanges([{ from: 10, to: 20 }, { from: 1, to: 5 }, { from: 21, to: 25 }, { from: 18, to: 22 }]), [{ from: 1, to: 5 }, { from: 10, to: 25 }]);
  });

  test("administrators read everything, including unpublished books", async () => {
    assert.deepEqual(await resolveReadingAccess(admin, { ...book, isPublished: false }, readingFacts()), { kind: "full", source: "admin" });
    await assert.rejects(resolveReadingAccess(admin, null, readingFacts()), (e: unknown) => e instanceof DomainError && e.code === "NOT_FOUND");
  });

  test("unpublished and missing books look the same to everyone else", async () => {
    for (const candidate of [null, { ...book, isPublished: false }]) {
      await assert.rejects(resolveReadingAccess(student, candidate, readingFacts({ entitled: ["student-1"] })), (e: unknown) => e instanceof DomainError && e.code === "NOT_FOUND");
    }
  });

  test("library entitlement and whole-book course links give full access; page links give pages", async () => {
    assert.deepEqual(await resolveReadingAccess(student, book, readingFacts({ entitled: ["student-1"] })), { kind: "full", source: "library_entitlement" });
    assert.deepEqual(await resolveReadingAccess(student, book, readingFacts({ grants: { "student-1": [{ courseId: IDS.course, range: null }] } })), { kind: "full", source: "course" });
    const pages = await resolveReadingAccess(teacher, book, readingFacts({ grants: { "teacher-1": [{ courseId: IDS.course, range: { from: 5, to: 9 } }, { courseId: IDS.course, range: { from: 10, to: 12 } }] } }));
    assert.deepEqual(pages, { kind: "pages", source: "course", ranges: [{ from: 5, to: 12 }] });
    assert.equal(isPageAllowed(pages, 5), true);
    assert.equal(isPageAllowed(pages, 13), false);
    assert.equal(isPageAllowed(pages, 0), false);
    await assert.rejects(resolveReadingAccess(outsider, book, readingFacts()), (e: unknown) => e instanceof AuthError && e.status === 403);
  });

  test("the whole-book file is only shown with full access", () => {
    assert.equal(readerBookView(book, { kind: "full", source: "library_entitlement" }).pdfUrl, book.pdfUrl);
    const partial = readerBookView(book, { kind: "pages", source: "course", ranges: [{ from: 1, to: 3 }] });
    assert.equal(partial.pdfUrl, null);
    assert.equal(JSON.stringify(partial).includes("whole-book.pdf"), false);
  });

  test("page numbers are validated", () => {
    assert.equal(parsePageNumber("12"), 12);
    for (const bad of ["0", "-1", "1.5", "abc", "1e3", 0]) expectDomain(() => parsePageNumber(bad), "VALIDATION");
  });
});

describe("course readings", () => {
  const course = mapCourseRow(courseRow());
  const ctx = { actor: { uid: "admin-1", role: "admin" as const }, clock: fixedClock, newId: sequentialIds("d5d5d5d5") };
  const base = { course, book, courseLessonIds: new Set([IDS.lesson1]), existing: [], libraryBookId: BOOK, purpose: "required" };

  test("links are validated against the book, the course curriculum and the page count", () => {
    const plan = planAddCourseResource({ ...base, lessonId: IDS.lesson1, pagesFrom: 3, pagesTo: 10 }, ctx);
    assert.equal(plan.record.pagesTo, 10);
    assert.doesNotThrow(() => buildAuditEvent(plan.audit));
    expectDomain(() => planAddCourseResource({ ...base, book: null }, ctx), "NOT_FOUND");
    expectDomain(() => planAddCourseResource({ ...base, book: { ...book, isPublished: false } }, ctx), "CONFLICT");
    expectDomain(() => planAddCourseResource({ ...base, lessonId: IDS.lesson2 }, ctx), "VALIDATION");
    expectDomain(() => planAddCourseResource({ ...base, purpose: "optional" }, ctx), "VALIDATION");
    expectDomain(() => planAddCourseResource({ ...base, pagesFrom: 3 }, ctx), "VALIDATION");
    expectDomain(() => planAddCourseResource({ ...base, pagesFrom: 10, pagesTo: 3 }, ctx), "VALIDATION");
    expectDomain(() => planAddCourseResource({ ...base, pagesFrom: 100, pagesTo: 121 }, ctx), "VALIDATION");
    expectDomain(() => planAddCourseResource({ ...base, existing: [plan.record], lessonId: IDS.lesson1, pagesFrom: 3, pagesTo: 10 }, ctx), "CONFLICT");
  });

  test("removal is reasoned and revision-checked", () => {
    const record = planAddCourseResource(base, ctx).record;
    expectDomain(() => planRemoveCourseResource(record, { reason: "", expectedRevision: 1 }, ctx), "VALIDATION");
    expectDomain(() => planRemoveCourseResource(record, { reason: "Replaced", expectedRevision: 2 }, ctx), "CONFLICT");
    const removed = planRemoveCourseResource(record, { reason: "Replaced by a new edition", expectedRevision: 1 }, ctx).record;
    expectDomain(() => planRemoveCourseResource(removed, { reason: "Again", expectedRevision: 2 }, ctx), "CONFLICT");
  });

  test("reading progress must stay inside readable pages", () => {
    expectDomain(() => planReadingProgress({ userUid: "student-1", libraryBookId: BOOK, lastPage: 50, pageAllowed: (p) => p <= 10 }, {}), "VALIDATION");
    assert.equal(planReadingProgress({ userUid: "student-1", libraryBookId: BOOK, lastPage: 7, pageAllowed: (p) => p <= 10 }, { clock: fixedClock }).lastPage, 7);
  });
});

describe("library persistence", () => {
  test("the academy only reads the existing library tables", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "..", "src", "lib", "academy", "repo", "library-repo.ts"), "utf8");
    assert.doesNotMatch(source, /(INSERT INTO|UPDATE|DELETE FROM)\s+(library_\w+|page_annotations|page_overlays|book_\w+)/i);
  });

  test("grant queries require active participation; entitlement mirrors the existing rule", () => {
    const learner = libraryRepo.selectLearnerCourseGrantsQuery("student-1", BOOK);
    const teacherQ = libraryRepo.selectTeacherCourseGrantsQuery("teacher-1", BOOK);
    const entitlement = libraryRepo.selectLibraryEntitlementQuery("student-1");
    for (const query of [learner, teacherQ, entitlement, libraryRepo.selectBookQuery(BOOK), libraryRepo.selectBookPageQuery(BOOK, 3)]) assertWellFormed(query);
    assert.match(learner.text, /r\.removed_at IS NULL[\s\S]*e\.state = 'active'[\s\S]*cg\.deleted_at IS NULL/);
    assert.match(teacherQ.text, /t\.unassigned_at IS NULL/);
    assert.match(entitlement.text, /expires_at IS NULL OR expires_at > now\(\)/);
    assert.doesNotMatch(libraryRepo.selectBookSummariesQuery([BOOK]).text, /pdf_url/);
  });

  test("SQL reading facts fail closed without querying for bad input or other roles", async () => {
    const executor = fakeExecutor([{ match: /./, rows: [{ course_id: IDS.course, pages_from: null, pages_to: null }] }]);
    const facts = libraryRepo.createSqlReadingFacts(executor);
    assert.equal(await facts.hasLibraryEntitlement("has space"), false);
    assert.deepEqual(await facts.courseGrants({ uid: "student-1", role: "student" }, "not-a-uuid"), []);
    assert.deepEqual(await facts.courseGrants({ uid: "admin-1", role: "admin" }, BOOK), []);
    assert.equal(executor.queries.length, 0);
    assert.deepEqual(await facts.courseGrants({ uid: "student-1", role: "student" }, BOOK), [{ courseId: IDS.course, range: null }]);
  });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const facts: RelationshipFacts = {
  async isTeacherOfClassGroup(uid, groupId) {
    return uid === "teacher-1" && groupId === IDS.classGroup;
  },
  async isActiveLearnerOfClassGroup(uid, groupId) {
    return uid === "student-1" && groupId === IDS.classGroup;
  },
  async classGroupBelongsToCourse(groupId, courseId) {
    return groupId === IDS.classGroup && courseId === IDS.course;
  },
  async hasCourseAccess(uid, courseId) {
    return uid === "student-1" && courseId === IDS.course;
  },
  async hasActiveTeachingRelationship() {
    return false;
  },
};

const BOOK_ROW = { id: BOOK, title: book.title, author: book.author, description: null, cover_url: book.coverUrl, pdf_url: book.pdfUrl, pages_count: 120, is_published: true };

const R = {
  book: /FROM library_books WHERE id = \$1::uuid$/,
  summaries: /FROM library_books WHERE id = ANY/,
  pages: /FROM library_pages WHERE book_id = \$1::uuid ORDER BY/,
  page: /FROM library_pages\s+WHERE book_id = \$1::uuid AND page_number/,
  classGroup: /FROM academy_class_groups WHERE id = \$1::uuid$/,
  course: /FROM academy_courses WHERE id = \$1::uuid$/,
  resources: /FROM academy_course_resources\s+WHERE course_id/,
  lessons: /FROM academy_lessons l JOIN academy_curricula/,
  progress: /FROM academy_reading_progress/,
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    book: [BOOK_ROW],
    summaries: [BOOK_ROW],
    pages: [1, 2, 3, 4, 5, 6].map((n) => ({ page_number: n, image_url: `https://img.example.test/p${n}.jpg` })),
    page: [{ page_number: 4, image_url: "https://img.example.test/p4.jpg", text_content: "باب الكلام" }],
    classGroup: [classGroupRow()],
    course: [courseRow()],
    resources: [{ id: "d5000000-0000-4000-8000-000000000001", course_id: IDS.course, lesson_id: null, library_book_id: BOOK, purpose: "required", pages_from: 3, pages_to: 5, note: null, revision: 1, created_by: "admin-1", created_at: "2026-09-01T00:00:00Z", removed_at: null, removed_by: null, remove_reason: null }],
    lessons: [{ lesson_id: IDS.lesson1 }],
    progress: [],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

function library(executor: FakeExecutor, reading: ReadingFacts) {
  return createLibraryService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("e5e5e5e5"), facts, readingFacts: reading });
}

const pageGrant = readingFacts({ grants: { "student-1": [{ courseId: IDS.course, range: { from: 3, to: 5 } }] } });

describe("library service", () => {
  test("page-range readers get only their pages and never the whole-book file", async () => {
    const result = await library(fakeExecutor(world()), pageGrant).getBook(student, BOOK);
    assert.deepEqual(result.pages.map((p) => p.pageNumber), [3, 4, 5]);
    assert.equal(result.book.pdfUrl, null);
    const entitled = await library(fakeExecutor(world()), readingFacts({ entitled: ["student-1"] })).getBook(student, BOOK);
    assert.equal(entitled.pages.length, 6);
    assert.equal(entitled.book.pdfUrl, book.pdfUrl);
  });

  test("pages outside access and unauthorised readers are refused before any page is loaded", async () => {
    const outside = fakeExecutor(world());
    await rejectsForbidden(library(outside, pageGrant).getPage(student, BOOK, "9"));
    assert.equal(outside.queries.some((q) => R.page.test(q.text)), false);
    const stranger = fakeExecutor(world());
    await rejectsForbidden(library(stranger, readingFacts()).getBook(outsider, BOOK));
    assert.equal(stranger.queries.some((q) => R.pages.test(q.text)), false);
    const page = await library(fakeExecutor(world()), pageGrant).getPage(student, BOOK, "4");
    assert.equal(page.text, "باب الكلام");
  });

  test("reading progress is saved for the caller only, inside readable pages", async () => {
    await rejectsDomain(library(fakeExecutor(world()), pageGrant).saveReadingProgress(student, BOOK, { lastPage: 40 }), "VALIDATION");
    const executor = fakeExecutor(world());
    await library(executor, pageGrant).saveReadingProgress(student, BOOK, { lastPage: 4 });
    const [upsert] = executor.transactions[0];
    assert.match(upsert.text, /INSERT INTO academy_reading_progress/);
    assert.ok(upsert.values.includes("student-1"));
  });

  test("only administrators link readings; participants see the course reading list without files", async () => {
    await rejectsForbidden(library(fakeExecutor(world()), pageGrant).addCourseResource(teacher, IDS.course, { libraryBookId: BOOK, purpose: "required" }));
    const executor = fakeExecutor(world({ resources: [] }));
    const added = await library(executor, pageGrant).addCourseResource(admin, IDS.course, { libraryBookId: BOOK, purpose: "recommended" });
    assert.equal(added.purpose, "recommended");
    assert.match(executor.transactions[0][0].text, /INSERT INTO academy_course_resources[\s\S]*academy_audit_events/);

    const readings = await library(fakeExecutor(world()), pageGrant).classGroupReadings(student, IDS.classGroup);
    assert.equal(readings.length, 1);
    assert.equal(JSON.stringify(readings).includes("whole-book.pdf"), false);
    await rejectsForbidden(library(fakeExecutor(world()), pageGrant).classGroupReadings(outsider, IDS.classGroup));
  });
});
