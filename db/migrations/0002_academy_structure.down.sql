-- =============================================================================
-- Migration 0002 — academy core academic structure (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops the foreign keys this migration added to academy_policy_values, then
-- only the objects created by 0002_academy_structure.up.sql, in dependency
-- order. No pre-existing application table is touched.
--
-- Data loss warning
--   Programs, courses, curricula, class groups, sessions and enrollments
--   recorded after the forward migration are destroyed. Export them first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

ALTER TABLE academy_policy_values DROP CONSTRAINT IF EXISTS academy_policy_values_course_fk;
ALTER TABLE academy_policy_values DROP CONSTRAINT IF EXISTS academy_policy_values_program_fk;

DROP TABLE IF EXISTS academy_enrollments;
DROP TABLE IF EXISTS academy_sessions;
DROP TABLE IF EXISTS academy_class_group_teachers;
DROP TABLE IF EXISTS academy_class_groups;
DROP TABLE IF EXISTS academy_curriculum_version_lessons;
DROP TABLE IF EXISTS academy_curriculum_version_units;
DROP TABLE IF EXISTS academy_lessons;
DROP TABLE IF EXISTS academy_units;
DROP TABLE IF EXISTS academy_curriculum_versions;
DROP TABLE IF EXISTS academy_curricula;
DROP TABLE IF EXISTS academy_courses;
DROP TABLE IF EXISTS academy_programs;
DROP FUNCTION IF EXISTS academy_expect_rows(bigint, bigint);

COMMIT;
