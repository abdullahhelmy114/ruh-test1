-- =============================================================================
-- Migration 0007 — academy messaging, announcements, notifications (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the tables created by 0007_academy_communication.up.sql, in
-- dependency order (their triggers are dropped with them). The shared
-- academy_reject_mutation function belongs to 0001 and is kept.
--
-- Data loss warning
--   Message threads, messages, announcements and notifications recorded
--   after the forward migration are destroyed. Export them first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_notifications;
DROP TABLE IF EXISTS academy_announcements;
DROP TABLE IF EXISTS academy_thread_reads;
DROP TABLE IF EXISTS academy_messages;
DROP TABLE IF EXISTS academy_message_threads;

COMMIT;
