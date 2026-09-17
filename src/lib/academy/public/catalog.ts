/**
 * Public academy catalog.
 *
 * Anyone may see active programs and courses, a course's published outline
 * (unit and lesson titles only) and its upcoming class groups. Public views
 * never include identifiers of people, enrollment lists or counts, lesson
 * content, answer keys, meeting links or anything unpublished.
 */
import { DomainError } from "../domain/errors.ts";

export interface PublicProgram {
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
}

export interface PublicCourseSummary {
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly program: { readonly slug: string; readonly title: string } | null;
}

export type Availability = "open" | "full";

export interface PublicClassGroup {
  readonly name: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly availability: Availability;
}

export interface PublicCourseDetail extends PublicCourseSummary {
  readonly outline: readonly { readonly title: string; readonly lessons: readonly { readonly title: string; readonly plannedMinutes: number | null }[] }[];
  readonly upcomingClassGroups: readonly PublicClassGroup[];
}

/** An active program with its active courses (titles and descriptions only). */
export interface PublicProgramDetail extends PublicProgram {
  readonly courses: readonly Omit<PublicCourseSummary, "program">[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Public slugs that cannot be a slug are simply not found (no validation detail leaks). */
export function parsePublicSlug(value: unknown, notFoundMessage = "Course not found."): string {
  if (typeof value !== "string" || value.length < 3 || value.length > 80 || !SLUG.test(value)) {
    throw new DomainError("NOT_FOUND", notFoundMessage);
  }
  return value;
}
