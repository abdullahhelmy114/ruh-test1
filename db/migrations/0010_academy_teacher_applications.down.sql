-- =============================================================================
-- Migration 0010 — academy teacher applications (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the tables created by 0010_academy_teacher_applications.up.sql.
-- The existing profiles and teacher_applications tables are not touched.
--
-- Data loss warning
--   Teacher applications and their review history are destroyed. Profile
--   statuses already set by decisions (for example an approved teacher's
--   'active') are not reverted. Export first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_teacher_application_events;
DROP TABLE IF EXISTS academy_teacher_applications;

COMMIT;
