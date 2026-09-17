/**
 * Public catalog service (no sign-in). Returns only published, active data
 * shaped by public/catalog.ts.
 */
import { DomainError } from "../domain/errors.ts";
import { systemClock } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlRow } from "../infra/sql.ts";
import { parsePublicSlug, type PublicCourseDetail, type PublicCourseSummary, type PublicProgram } from "../public/catalog.ts";
import {
  selectPublicClassGroupsQuery,
  selectPublicCourseQuery,
  selectPublicCoursesQuery,
  selectPublicOutlineQuery,
  selectPublicProgramsQuery,
} from "../repo/public-repo.ts";
import { numOrNull, str, strOrNull } from "../repo/rows.ts";
import type { ServiceDeps } from "./support.ts";

function summary(row: SqlRow): PublicCourseSummary {
  const programSlug = strOrNull(row.program_slug);
  return {
    slug: str(row.slug),
    title: str(row.title),
    description: strOrNull(row.description),
    program: programSlug ? { slug: programSlug, title: str(row.program_title) } : null,
  };
}

export function createPublicService(deps: Pick<ServiceDeps, "executor" | "flags" | "clock">) {
  const { executor } = deps;

  return {
    async catalog(): Promise<{ programs: PublicProgram[]; courses: PublicCourseSummary[] }> {
      assertAcademyCoreAvailable(deps.flags);
      const [programs, courses] = await Promise.all([executor.query(selectPublicProgramsQuery()), executor.query(selectPublicCoursesQuery())]);
      return {
        programs: programs.map((row) => ({ slug: str(row.slug), title: str(row.title), description: strOrNull(row.description) })),
        courses: courses.map(summary),
      };
    },

    async course(slugInput: unknown): Promise<PublicCourseDetail> {
      assertAcademyCoreAvailable(deps.flags);
      const slug = parsePublicSlug(slugInput);
      const rows = await executor.query(selectPublicCourseQuery(slug));
      if (rows.length === 0) throw new DomainError("NOT_FOUND", "Course not found.");
      const courseId = str(rows[0].id);
      const today = (deps.clock ?? systemClock)().toISOString().slice(0, 10);
      const [outlineRows, groupRows] = await Promise.all([
        executor.query(selectPublicOutlineQuery(courseId)),
        executor.query(selectPublicClassGroupsQuery(courseId, today)),
      ]);
      const units: { title: string; lessons: { title: string; plannedMinutes: number | null }[] }[] = [];
      let lastPosition: unknown = undefined;
      for (const row of outlineRows) {
        if (row.unit_position !== lastPosition) {
          units.push({ title: str(row.unit_title), lessons: [] });
          lastPosition = row.unit_position;
        }
        if (row.lesson_title !== null && row.lesson_title !== undefined) {
          units[units.length - 1].lessons.push({ title: str(row.lesson_title), plannedMinutes: numOrNull(row.planned_minutes) });
        }
      }
      return {
        ...summary(rows[0]),
        outline: units,
        upcomingClassGroups: groupRows.map((row) => ({
          name: str(row.name),
          startsOn: strOrNull(row.starts_on),
          endsOn: strOrNull(row.ends_on),
          availability: row.is_full === true ? "full" : "open",
        })),
      };
    },
  };
}

export type PublicService = ReturnType<typeof createPublicService>;
