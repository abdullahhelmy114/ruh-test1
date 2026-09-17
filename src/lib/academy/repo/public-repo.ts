/**
 * Queries for the public catalog. Every column selected here is safe to
 * publish: no uids, emails, counts of people, content or links.
 */
import { sqlQuery, type SqlQuery } from "../infra/sql.ts";

export function selectPublicProgramsQuery(): SqlQuery {
  return {
    text: `SELECT slug, title, description FROM academy_programs WHERE status = 'active' AND deleted_at IS NULL ORDER BY title ASC LIMIT 200`,
    values: [],
  };
}

export function selectPublicCoursesQuery(): SqlQuery {
  return {
    text: `SELECT c.slug, c.title, c.description, p.slug AS program_slug, p.title AS program_title
      FROM academy_courses c
      LEFT JOIN academy_programs p ON p.id = c.program_id AND p.status = 'active' AND p.deleted_at IS NULL
      WHERE c.status = 'active' AND c.deleted_at IS NULL
      ORDER BY c.title ASC
      LIMIT 500`,
    values: [],
  };
}

export function selectPublicProgramQuery(slug: string): SqlQuery {
  return sqlQuery`SELECT id, slug, title, description FROM academy_programs WHERE slug = ${slug} AND status = 'active' AND deleted_at IS NULL`;
}

export function selectPublicProgramCoursesQuery(programId: string): SqlQuery {
  return sqlQuery`SELECT slug, title, description FROM academy_courses
    WHERE program_id = ${programId}::uuid AND status = 'active' AND deleted_at IS NULL
    ORDER BY title ASC
    LIMIT 500`;
}

export function selectPublicCourseQuery(slug: string): SqlQuery {
  return sqlQuery`SELECT c.id, c.slug, c.title, c.description, p.slug AS program_slug, p.title AS program_title
    FROM academy_courses c
    LEFT JOIN academy_programs p ON p.id = c.program_id AND p.status = 'active' AND p.deleted_at IS NULL
    WHERE c.slug = ${slug} AND c.status = 'active' AND c.deleted_at IS NULL`;
}

/** Unit and lesson titles of the course's currently published curriculum version. */
export function selectPublicOutlineQuery(courseId: string): SqlQuery {
  return sqlQuery`SELECT u.position AS unit_position, u.title AS unit_title, l.position AS lesson_position, l.title AS lesson_title, l.planned_minutes
    FROM academy_curricula cu
    JOIN academy_curriculum_versions v ON v.curriculum_id = cu.id AND v.state = 'published'
    JOIN academy_curriculum_version_units u ON u.curriculum_version_id = v.id
    LEFT JOIN academy_curriculum_version_lessons l ON l.curriculum_version_id = v.id AND l.unit_id = u.unit_id
    WHERE cu.course_id = ${courseId}::uuid
    ORDER BY u.position ASC, l.position ASC NULLS LAST`;
}

/** Upcoming class groups with whether a place is available (no counts are returned). */
export function selectPublicClassGroupsQuery(courseId: string, today: string): SqlQuery {
  return sqlQuery`SELECT cg.name, cg.status, cg.starts_on::text AS starts_on, cg.ends_on::text AS ends_on,
      (cg.capacity IS NOT NULL AND (
        SELECT count(*) FROM academy_enrollments e WHERE e.class_group_id = cg.id AND e.state IN ('pending', 'active', 'suspended')
      ) >= cg.capacity) AS is_full
    FROM academy_class_groups cg
    WHERE cg.course_id = ${courseId}::uuid AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
      AND (cg.ends_on IS NULL OR cg.ends_on >= ${today}::date)
    ORDER BY cg.starts_on ASC NULLS LAST, cg.name ASC
    LIMIT 50`;
}
