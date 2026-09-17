-- =============================================================================
-- Migration 0009 — academy 2C production infrastructure (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates content libraries, production factories and runs, versioned
--   content items (activities, stories, adventures, games, media) with
--   provenance, links from published items to courses, lessons and
--   assessments, learners' practice results, and remediation rules and
--   assignments.
--
-- Impact
--   Strictly additive. Creates new academy_* tables and indexes only. No
--   pre-existing table is altered, updated or removed; the legacy games and
--   generated content tables are untouched.
--
-- Rollback strategy
--   Apply 0009_academy_production.down.sql, which drops only the tables
--   created here. Production content, practice results and remediation
--   recorded after this migration are lost on rollback: export them first.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0008, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_content_libraries (
  id            uuid PRIMARY KEY,
  slug          text NOT NULL CHECK (length(slug) BETWEEN 3 AND 80 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description   text NULL CHECK (description IS NULL OR length(description) <= 5000),
  scope         text NOT NULL CHECK (scope IN ('academy', 'program', 'course')),
  program_id    uuid NULL REFERENCES academy_programs (id),
  course_id     uuid NULL REFERENCES academy_courses (id),
  state         text NOT NULL CHECK (state IN ('active', 'archived')),
  state_reason  text NULL,
  revision      integer NOT NULL CHECK (revision >= 1),
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL,
  updated_by    text NOT NULL,
  updated_at    timestamptz NOT NULL,
  CONSTRAINT academy_content_libraries_scope_shape CHECK (
    (scope = 'academy' AND program_id IS NULL AND course_id IS NULL) OR
    (scope = 'program' AND program_id IS NOT NULL AND course_id IS NULL) OR
    (scope = 'course' AND course_id IS NOT NULL AND program_id IS NULL)
  )
);

CREATE UNIQUE INDEX academy_content_libraries_slug_uq ON academy_content_libraries (slug);

CREATE TABLE academy_production_factories (
  id           uuid PRIMARY KEY,
  key          text NOT NULL CHECK (length(key) BETWEEN 3 AND 80 AND key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description  text NULL CHECK (description IS NULL OR length(description) <= 5000),
  output_kind  text NOT NULL CHECK (output_kind IN ('activity', 'story', 'adventure', 'game', 'media')),
  state        text NOT NULL CHECK (state IN ('active', 'retired')),
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL
);

CREATE UNIQUE INDEX academy_production_factories_key_uq ON academy_production_factories (key);

CREATE TABLE academy_production_runs (
  id            uuid PRIMARY KEY,
  factory_id    uuid NOT NULL REFERENCES academy_production_factories (id),
  library_id    uuid NOT NULL REFERENCES academy_content_libraries (id),
  title         text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  brief         text NULL CHECK (brief IS NULL OR length(brief) <= 20000),
  state         text NOT NULL CHECK (state IN ('planned', 'in_production', 'awaiting_review', 'completed', 'cancelled')),
  state_reason  text NULL,
  revision      integer NOT NULL CHECK (revision >= 1),
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL,
  updated_by    text NOT NULL,
  updated_at    timestamptz NOT NULL
);

CREATE INDEX academy_production_runs_state_idx ON academy_production_runs (state, updated_at DESC);

CREATE TABLE academy_content_items (
  id                 uuid PRIMARY KEY,
  library_id         uuid NOT NULL REFERENCES academy_content_libraries (id),
  kind               text NOT NULL CHECK (kind IN ('activity', 'story', 'adventure', 'game', 'media')),
  title              text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  production_run_id  uuid NULL REFERENCES academy_production_runs (id),
  created_by         text NOT NULL,
  created_at         timestamptz NOT NULL
);

CREATE INDEX academy_content_items_library_idx ON academy_content_items (library_id, kind);
CREATE INDEX academy_content_items_run_idx ON academy_content_items (production_run_id) WHERE production_run_id IS NOT NULL;

CREATE TABLE academy_content_item_versions (
  id                   uuid PRIMARY KEY,
  item_id              uuid NOT NULL REFERENCES academy_content_items (id),
  version_number       integer NOT NULL CHECK (version_number >= 1),
  based_on_version_id  uuid NULL REFERENCES academy_content_item_versions (id),
  state                text NOT NULL CHECK (state IN (
                         'draft', 'in_review', 'changes_requested', 'approved',
                         'published', 'superseded', 'rejected', 'archived')),
  revision             integer NOT NULL CHECK (revision >= 1),
  content              jsonb NULL,
  provenance           jsonb NULL,
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
  CONSTRAINT academy_content_item_versions_number_uq UNIQUE (item_id, version_number),
  CONSTRAINT academy_content_item_versions_publication CHECK (
    state NOT IN ('published', 'superseded') OR
    (published_at IS NOT NULL AND published_by IS NOT NULL AND content IS NOT NULL AND provenance IS NOT NULL
     AND provenance ->> 'rightsStatus' = 'cleared')
  )
);

CREATE UNIQUE INDEX academy_content_item_versions_one_working_uq
  ON academy_content_item_versions (item_id) WHERE state IN ('draft', 'in_review', 'changes_requested', 'approved');
CREATE UNIQUE INDEX academy_content_item_versions_one_published_uq
  ON academy_content_item_versions (item_id) WHERE state = 'published';

CREATE TABLE academy_content_links (
  id             uuid PRIMARY KEY,
  item_id        uuid NOT NULL REFERENCES academy_content_items (id),
  course_id      uuid NOT NULL REFERENCES academy_courses (id),
  target_kind    text NOT NULL CHECK (target_kind IN ('course', 'lesson', 'assessment')),
  target_id      uuid NOT NULL,
  purpose        text NOT NULL CHECK (purpose IN ('practice', 'enrichment', 'preparation', 'remediation')),
  revision       integer NOT NULL CHECK (revision >= 1),
  created_by     text NOT NULL,
  created_at     timestamptz NOT NULL,
  removed_at     timestamptz NULL,
  removed_by     text NULL,
  remove_reason  text NULL,
  CONSTRAINT academy_content_links_removal CHECK (
    (removed_at IS NULL AND removed_by IS NULL AND remove_reason IS NULL) OR
    (removed_at IS NOT NULL AND removed_by IS NOT NULL AND length(btrim(remove_reason)) > 0)
  )
);

CREATE UNIQUE INDEX academy_content_links_active_uq
  ON academy_content_links (item_id, target_kind, target_id, purpose) WHERE removed_at IS NULL;
CREATE INDEX academy_content_links_course_idx ON academy_content_links (course_id, purpose) WHERE removed_at IS NULL;

CREATE TABLE academy_practice_results (
  id                uuid PRIMARY KEY,
  item_id           uuid NOT NULL REFERENCES academy_content_items (id),
  item_version_id   uuid NOT NULL REFERENCES academy_content_item_versions (id),
  class_group_id    uuid NOT NULL REFERENCES academy_class_groups (id),
  learner_uid       text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  responses         jsonb NOT NULL,
  item_results      jsonb NOT NULL,
  score_percent     integer NOT NULL CHECK (score_percent BETWEEN 0 AND 100),
  duration_seconds  integer NULL CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 86400),
  completed_at      timestamptz NOT NULL
);

CREATE INDEX academy_practice_results_learner_idx ON academy_practice_results (learner_uid, class_group_id, completed_at DESC);
CREATE INDEX academy_practice_results_class_group_idx ON academy_practice_results (class_group_id, item_id);

CREATE TABLE academy_remediation_rules (
  id                   uuid PRIMARY KEY,
  course_id            uuid NOT NULL REFERENCES academy_courses (id),
  assessment_id        uuid NOT NULL REFERENCES academy_assessments (id),
  below_score_percent  integer NOT NULL CHECK (below_score_percent BETWEEN 1 AND 100),
  item_id              uuid NOT NULL REFERENCES academy_content_items (id),
  state                text NOT NULL CHECK (state IN ('active', 'retired')),
  reason               text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  retire_reason        text NULL,
  revision             integer NOT NULL CHECK (revision >= 1),
  created_by           text NOT NULL,
  created_at           timestamptz NOT NULL,
  updated_by           text NOT NULL,
  updated_at           timestamptz NOT NULL,
  CONSTRAINT academy_remediation_rules_retire CHECK ((state = 'retired') = (retire_reason IS NOT NULL))
);

CREATE INDEX academy_remediation_rules_assessment_idx ON academy_remediation_rules (assessment_id) WHERE state = 'active';

CREATE TABLE academy_remediation_assignments (
  id                 uuid PRIMARY KEY,
  class_group_id     uuid NOT NULL REFERENCES academy_class_groups (id),
  learner_uid        text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  item_id            uuid NOT NULL REFERENCES academy_content_items (id),
  rule_id            uuid NULL REFERENCES academy_remediation_rules (id),
  source_attempt_id  uuid NULL REFERENCES academy_assessment_attempts (id),
  note               text NULL CHECK (note IS NULL OR length(note) <= 2000),
  state              text NOT NULL CHECK (state IN ('assigned', 'completed', 'dismissed')),
  state_reason       text NULL,
  revision           integer NOT NULL CHECK (revision >= 1),
  assigned_by        text NOT NULL,
  assigned_at        timestamptz NOT NULL,
  resolved_at        timestamptz NULL,
  CONSTRAINT academy_remediation_assignments_resolution CHECK ((state = 'assigned') = (resolved_at IS NULL)),
  CONSTRAINT academy_remediation_assignments_dismissal CHECK (state <> 'dismissed' OR length(btrim(state_reason)) > 0)
);

CREATE UNIQUE INDEX academy_remediation_assignments_open_uq
  ON academy_remediation_assignments (class_group_id, learner_uid, item_id) WHERE state = 'assigned';
CREATE INDEX academy_remediation_assignments_learner_idx ON academy_remediation_assignments (learner_uid, state);

COMMIT;
