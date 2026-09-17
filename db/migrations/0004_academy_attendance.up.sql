-- =============================================================================
-- Migration 0004 — academy attendance (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates attendance records: one mark per learner per session, with the
--   mark code from the academy's attendance vocabulary and a snapshot of
--   whether that mark counted as attended when it was recorded.
--
-- Impact
--   Strictly additive. Creates one new academy_* table and its indexes. No
--   pre-existing table is altered, updated or removed.
--
-- Rollback strategy
--   Apply 0004_academy_attendance.down.sql, which drops only the table
--   created here. Attendance recorded after this migration is lost on
--   rollback: export it first if needed.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0003, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_attendance_records (
  id                  uuid PRIMARY KEY,
  session_id          uuid NOT NULL REFERENCES academy_sessions (id),
  class_group_id      uuid NOT NULL REFERENCES academy_class_groups (id),
  learner_uid         text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  mark_code           text NOT NULL CHECK (mark_code ~ '^[a-z][a-z0-9_]{0,31}$'),
  counts_as_attended  boolean NOT NULL,
  revision            integer NOT NULL CHECK (revision >= 1),
  recorded_by         text NOT NULL,
  recorded_at         timestamptz NOT NULL,
  updated_by          text NOT NULL,
  updated_at          timestamptz NOT NULL,
  CONSTRAINT academy_attendance_records_one_per_learner UNIQUE (session_id, learner_uid)
);

CREATE INDEX academy_attendance_records_learner_idx
  ON academy_attendance_records (learner_uid, class_group_id);
CREATE INDEX academy_attendance_records_class_group_idx
  ON academy_attendance_records (class_group_id, session_id);

COMMIT;
