-- =============================================================================
-- Migration 0004 — academy attendance (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the table created by 0004_academy_attendance.up.sql. No
-- pre-existing table is touched.
--
-- Data loss warning
--   Attendance recorded after the forward migration is destroyed. Export it
--   first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_attendance_records;

COMMIT;
