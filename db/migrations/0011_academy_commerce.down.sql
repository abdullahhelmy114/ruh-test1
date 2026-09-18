-- =============================================================================
-- Migration 0011 — academy commerce (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the tables created by 0011_academy_commerce.up.sql. Enrollments
-- that entitlements opened stay in academy_enrollments.
--
-- Data loss warning
--   Offers (the Whop plan to class group mapping), checkouts, entitlements
--   and the processed-webhook log are destroyed: which payment opened which
--   enrollment can no longer be told, and a redelivered Whop event would be
--   processed again. Export first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_payment_events;
DROP TABLE IF EXISTS academy_entitlements;
DROP TABLE IF EXISTS academy_checkouts;
DROP TABLE IF EXISTS academy_offers;

COMMIT;
