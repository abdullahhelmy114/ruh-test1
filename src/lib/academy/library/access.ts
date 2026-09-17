/**
 * Reading access to library books.
 *
 * Books live in the existing library (`library_books`, `library_pages`).
 * The academy decides who may read what, on the server, in one place:
 *
 *   - administrators read everything, including unpublished books;
 *   - an unexpired library entitlement (existing `library_access`) grants the
 *     whole library, as it does today;
 *   - a book linked to a course as a reading resource can be read by that
 *     course's active learners and assigned teachers, limited to the linked
 *     page range when one is set.
 *
 * Partial (page-range) access never exposes the whole-book file: only pages
 * inside the granted ranges are returned.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import { DomainError } from "../domain/errors.ts";

export interface BookRecord {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly description: string | null;
  readonly coverUrl: string | null;
  readonly pdfUrl: string | null;
  readonly pagesCount: number | null;
  readonly isPublished: boolean;
}

export interface PageRange {
  readonly from: number;
  readonly to: number;
}

export interface CourseReadingGrant {
  readonly courseId: string;
  /** null when the whole book is linked. */
  readonly range: PageRange | null;
}

export interface ReadingFacts {
  hasLibraryEntitlement(uid: string): Promise<boolean>;
  /** Course links to this book through which the user (learner or teacher) currently has access. */
  courseGrants(user: Pick<AuthUser, "uid" | "role">, bookId: string): Promise<readonly CourseReadingGrant[]>;
}

export type ReadingAccess =
  | { readonly kind: "full"; readonly source: "admin" | "library_entitlement" | "course" }
  | { readonly kind: "pages"; readonly source: "course"; readonly ranges: readonly PageRange[] };

/** Merges overlapping or touching ranges into a sorted minimal list. */
export function mergeRanges(ranges: readonly PageRange[]): PageRange[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: PageRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to + 1) {
      merged[merged.length - 1] = { from: last.from, to: Math.max(last.to, range.to) };
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export async function resolveReadingAccess(user: AuthUser, book: BookRecord | null, facts: ReadingFacts): Promise<ReadingAccess> {
  if (user.role === "admin") {
    if (!book) throw new DomainError("NOT_FOUND", "Book not found.");
    return { kind: "full", source: "admin" };
  }
  // Unpublished and missing books look the same to everyone else.
  if (!book || !book.isPublished) throw new DomainError("NOT_FOUND", "Book not found.");
  if (await facts.hasLibraryEntitlement(user.uid)) return { kind: "full", source: "library_entitlement" };
  const grants = await facts.courseGrants(user, book.id);
  if (grants.length === 0) throw new AuthError("FORBIDDEN");
  if (grants.some((grant) => grant.range === null)) return { kind: "full", source: "course" };
  return { kind: "pages", source: "course", ranges: mergeRanges(grants.map((grant) => grant.range as PageRange)) };
}

export function isPageAllowed(access: ReadingAccess, pageNumber: number): boolean {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return false;
  if (access.kind === "full") return true;
  return access.ranges.some((range) => pageNumber >= range.from && pageNumber <= range.to);
}

export function parsePageNumber(value: unknown): number {
  const page = typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(page) || (page as number) < 1 || (page as number) > 100_000) {
    throw new DomainError("VALIDATION", "pageNumber must be a positive whole number.");
  }
  return page as number;
}

/** What a reader receives about a book. The whole-book file is included only with full access. */
export function readerBookView(book: BookRecord, access: ReadingAccess) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    coverUrl: book.coverUrl,
    pagesCount: book.pagesCount,
    access: access.kind === "full" ? { kind: "full" as const } : { kind: "pages" as const, ranges: access.ranges },
    pdfUrl: access.kind === "full" ? book.pdfUrl : null,
  };
}
