-- =============================================================================
-- Migration 0001 — academy governance foundation (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the objects created by 0001_academy_governance_foundation.up.sql,
-- in dependency order. No pre-existing object is touched.
--
-- Data loss warning
--   Audit events, approval history and policy values recorded after the
--   forward migration are destroyed. Export them before rolling back.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_approval_decisions;
DROP TABLE IF EXISTS academy_approval_gates;
DROP TABLE IF EXISTS academy_approval_gate_definitions;
DROP TABLE IF EXISTS academy_audit_events;
DROP FUNCTION IF EXISTS academy_reject_mutation();
DROP TABLE IF EXISTS academy_policy_values;

COMMIT;
