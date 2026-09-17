-- =============================================================================
-- Migration 0008 — academy recordings and certificates (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the tables created by 0008_academy_recordings_certificates.up.sql.
-- The existing certificates tables are not touched.
--
-- Data loss warning
--   Recordings and certificates recorded after the forward migration are
--   destroyed, and issued certificate codes stop verifying. Export first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_certificates;
DROP TABLE IF EXISTS academy_recordings;

COMMIT;
