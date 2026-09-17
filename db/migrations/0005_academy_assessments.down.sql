-- =============================================================================
-- Migration 0005 — academy assessments, attempts and completion (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the objects created by 0005_academy_assessments.up.sql, in
-- dependency order. No pre-existing table is touched.
--
-- Data loss warning
--   Assessments, learners' attempts and completion records recorded after
--   the forward migration are destroyed. Export them first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_completions;
DROP TABLE IF EXISTS academy_assessment_attempts;
DROP TABLE IF EXISTS academy_assessment_assignments;
DROP TABLE IF EXISTS academy_assessment_versions;
DROP TABLE IF EXISTS academy_assessments;

COMMIT;
