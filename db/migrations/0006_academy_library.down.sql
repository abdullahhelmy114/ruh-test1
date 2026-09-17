-- =============================================================================
-- Migration 0006 — academy library resources and reading progress (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the tables created by 0006_academy_library.up.sql. The existing
-- library tables are not touched.
--
-- Data loss warning
--   Course reading links and readers' saved positions recorded after the
--   forward migration are destroyed. Export them first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_reading_progress;
DROP TABLE IF EXISTS academy_course_resources;

COMMIT;
