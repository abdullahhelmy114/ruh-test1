-- =============================================================================
-- Migration 0003 — academy lesson sheets, annotations and preparation (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates canonical lesson scripts with governed versions (structured
--   blocks with stable ids), learners' and teachers' private annotations
--   anchored to those blocks, and teachers' per-session preparation.
--   The Lesson Sheet release rule is enforced in application code; nothing
--   here stores or configures it.
--
-- Impact
--   Strictly additive. Creates new academy_* tables and indexes only. No
--   pre-existing table is altered, updated or removed. The existing editor
--   tables and the legacy lessons table are untouched.
--
-- Rollback strategy
--   Apply 0003_academy_lesson_sheets.down.sql, which drops only the objects
--   created here. Lesson scripts, annotations and preparation recorded after
--   this migration are lost on rollback: export them first if needed.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0002, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_lesson_scripts (
  id             uuid PRIMARY KEY,
  lesson_id      uuid NOT NULL,
  curriculum_id  uuid NOT NULL,
  created_by     text NOT NULL,
  created_at     timestamptz NOT NULL,
  CONSTRAINT academy_lesson_scripts_lesson_fk
    FOREIGN KEY (lesson_id, curriculum_id) REFERENCES academy_lessons (id, curriculum_id)
);

CREATE UNIQUE INDEX academy_lesson_scripts_lesson_uq ON academy_lesson_scripts (lesson_id);

CREATE TABLE academy_lesson_script_versions (
  id                   uuid PRIMARY KEY,
  lesson_script_id     uuid NOT NULL REFERENCES academy_lesson_scripts (id),
  version_number       integer NOT NULL CHECK (version_number >= 1),
  based_on_version_id  uuid NULL REFERENCES academy_lesson_script_versions (id),
  state                text NOT NULL CHECK (state IN (
                         'draft', 'in_review', 'changes_requested', 'approved',
                         'published', 'superseded', 'rejected', 'archived')),
  revision             integer NOT NULL CHECK (revision >= 1),
  content              jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND jsonb_typeof(content -> 'blocks') = 'array'),
  created_by           text NOT NULL,
  created_at           timestamptz NOT NULL,
  updated_at           timestamptz NOT NULL,
  submitted_at         timestamptz NULL,
  reviewed_by          text NULL,
  reviewed_at          timestamptz NULL,
  published_by         text NULL,
  published_at         timestamptz NULL,
  superseded_at        timestamptz NULL,
  archived_at          timestamptz NULL,
  CONSTRAINT academy_lesson_script_versions_number_uq UNIQUE (lesson_script_id, version_number),
  CONSTRAINT academy_lesson_script_versions_publication CHECK (
    state NOT IN ('published', 'superseded') OR (published_at IS NOT NULL AND published_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX academy_lesson_script_versions_id_script_uq
  ON academy_lesson_script_versions (id, lesson_script_id);
CREATE UNIQUE INDEX academy_lesson_script_versions_one_working_uq
  ON academy_lesson_script_versions (lesson_script_id) WHERE state IN ('draft', 'in_review', 'changes_requested', 'approved');
CREATE UNIQUE INDEX academy_lesson_script_versions_one_published_uq
  ON academy_lesson_script_versions (lesson_script_id) WHERE state = 'published';

CREATE TABLE academy_lesson_annotations (
  id                 uuid PRIMARY KEY,
  owner_uid          text NOT NULL CHECK (length(owner_uid) BETWEEN 1 AND 128),
  lesson_script_id   uuid NOT NULL,
  script_version_id  uuid NOT NULL,
  class_group_id     uuid NULL REFERENCES academy_class_groups (id),
  block_id           uuid NOT NULL,
  range_start        integer NULL,
  range_end          integer NULL,
  quote              text NULL CHECK (quote IS NULL OR length(quote) <= 500),
  kind               text NOT NULL CHECK (kind IN ('highlight', 'note')),
  color              text NOT NULL CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'purple')),
  body               text NULL CHECK (body IS NULL OR length(body) <= 5000),
  revision           integer NOT NULL CHECK (revision >= 1),
  created_at         timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL,
  deleted_at         timestamptz NULL,
  CONSTRAINT academy_lesson_annotations_version_fk
    FOREIGN KEY (script_version_id, lesson_script_id) REFERENCES academy_lesson_script_versions (id, lesson_script_id),
  CONSTRAINT academy_lesson_annotations_range CHECK (
    (range_start IS NULL AND range_end IS NULL) OR (range_start >= 0 AND range_end > range_start)
  ),
  CONSTRAINT academy_lesson_annotations_note_body CHECK (kind <> 'note' OR body IS NOT NULL)
);

CREATE INDEX academy_lesson_annotations_owner_idx
  ON academy_lesson_annotations (owner_uid, lesson_script_id) WHERE deleted_at IS NULL;

CREATE TABLE academy_session_preparations (
  session_id     uuid NOT NULL REFERENCES academy_sessions (id),
  teacher_uid    text NOT NULL CHECK (length(teacher_uid) BETWEEN 1 AND 128),
  status         text NOT NULL CHECK (status IN ('not_started', 'in_progress', 'ready')),
  private_notes  text NULL CHECK (private_notes IS NULL OR length(private_notes) <= 10000),
  revision       integer NOT NULL CHECK (revision >= 1),
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL,
  ready_at       timestamptz NULL,
  PRIMARY KEY (session_id, teacher_uid),
  CONSTRAINT academy_session_preparations_ready CHECK ((status = 'ready') = (ready_at IS NOT NULL))
);

COMMIT;
