-- =============================================================================
-- Migration 0003 — academy lesson sheets, annotations and preparation (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the objects created by 0003_academy_lesson_sheets.up.sql, in
-- dependency order. No pre-existing table is touched.
--
-- Data loss warning
--   Lesson scripts, private annotations and teacher preparation recorded
--   after the forward migration are destroyed. Export them first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_session_preparations;
DROP TABLE IF EXISTS academy_lesson_annotations;
DROP TABLE IF EXISTS academy_lesson_script_versions;
DROP TABLE IF EXISTS academy_lesson_scripts;

COMMIT;
