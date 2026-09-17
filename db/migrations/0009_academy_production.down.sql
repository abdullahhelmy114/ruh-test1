-- =============================================================================
-- Migration 0009 — academy 2C production infrastructure (ROLLBACK)
-- -----------------------------------------------------------------------------
-- Drops only the tables created by 0009_academy_production.up.sql, in
-- dependency order. No pre-existing table is touched.
--
-- Data loss warning
--   Libraries, factories, runs, content items and versions, links, practice
--   results and remediation recorded after the forward migration are
--   destroyed. Export them first.
--
-- Execution status: NOT EXECUTED.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS academy_remediation_assignments;
DROP TABLE IF EXISTS academy_remediation_rules;
DROP TABLE IF EXISTS academy_practice_results;
DROP TABLE IF EXISTS academy_content_links;
DROP TABLE IF EXISTS academy_content_item_versions;
DROP TABLE IF EXISTS academy_content_items;
DROP TABLE IF EXISTS academy_production_runs;
DROP TABLE IF EXISTS academy_production_factories;
DROP TABLE IF EXISTS academy_content_libraries;

COMMIT;
