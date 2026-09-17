-- =============================================================================
-- Migration 0005 — academy assessments, attempts and completion (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates the single assessment engine: assessments with governed versions
--   (item content with answer keys), assignments of published versions to
--   class groups, learners' attempts with grading and result release, and
--   course completion records.
--
-- Impact
--   Strictly additive. Creates new academy_* tables and indexes only. No
--   pre-existing table is altered, updated or removed. The legacy exam and
--   quiz tables are untouched.
--
-- Rollback strategy
--   Apply 0005_academy_assessments.down.sql, which drops only the objects
--   created here. Assessments, attempts and completions recorded after this
--   migration are lost on rollback: export them first if needed.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0004, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_assessments (
  id          uuid PRIMARY KEY,
  course_id   uuid NOT NULL REFERENCES academy_courses (id),
  mode        text NOT NULL CHECK (mode IN ('practice', 'quiz', 'homework', 'writing', 'oral', 'placement', 'midterm', 'final')),
  title       text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL
);

CREATE INDEX academy_assessments_course_idx ON academy_assessments (course_id, mode);

CREATE TABLE academy_assessment_versions (
  id                   uuid PRIMARY KEY,
  assessment_id        uuid NOT NULL REFERENCES academy_assessments (id),
  version_number       integer NOT NULL CHECK (version_number >= 1),
  based_on_version_id  uuid NULL REFERENCES academy_assessment_versions (id),
  state                text NOT NULL CHECK (state IN (
                         'draft', 'in_review', 'changes_requested', 'approved',
                         'published', 'superseded', 'rejected', 'archived')),
  revision             integer NOT NULL CHECK (revision >= 1),
  content              jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND jsonb_typeof(content -> 'items') = 'array'),
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
  CONSTRAINT academy_assessment_versions_number_uq UNIQUE (assessment_id, version_number),
  CONSTRAINT academy_assessment_versions_publication CHECK (
    state NOT IN ('published', 'superseded') OR (published_at IS NOT NULL AND published_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX academy_assessment_versions_one_working_uq
  ON academy_assessment_versions (assessment_id) WHERE state IN ('draft', 'in_review', 'changes_requested', 'approved');
CREATE UNIQUE INDEX academy_assessment_versions_one_published_uq
  ON academy_assessment_versions (assessment_id) WHERE state = 'published';

CREATE TABLE academy_assessment_assignments (
  id                     uuid PRIMARY KEY,
  class_group_id         uuid NOT NULL REFERENCES academy_class_groups (id),
  course_id              uuid NOT NULL REFERENCES academy_courses (id),
  assessment_id          uuid NOT NULL REFERENCES academy_assessments (id),
  assessment_version_id  uuid NOT NULL REFERENCES academy_assessment_versions (id),
  mode                   text NOT NULL CHECK (mode IN ('practice', 'quiz', 'homework', 'writing', 'oral', 'placement', 'midterm', 'final')),
  title                  text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  opens_at               timestamptz NOT NULL,
  due_at                 timestamptz NULL,
  state                  text NOT NULL CHECK (state IN ('active', 'cancelled')),
  cancel_reason          text NULL,
  revision               integer NOT NULL CHECK (revision >= 1),
  created_by             text NOT NULL,
  created_at             timestamptz NOT NULL,
  updated_by             text NOT NULL,
  updated_at             timestamptz NOT NULL,
  CONSTRAINT academy_assessment_assignments_window CHECK (due_at IS NULL OR due_at > opens_at),
  CONSTRAINT academy_assessment_assignments_cancel CHECK ((state = 'cancelled') = (cancel_reason IS NOT NULL))
);

CREATE INDEX academy_assessment_assignments_class_group_idx ON academy_assessment_assignments (class_group_id, opens_at);

CREATE TABLE academy_assessment_attempts (
  id                      uuid PRIMARY KEY,
  assignment_id           uuid NOT NULL REFERENCES academy_assessment_assignments (id),
  class_group_id          uuid NOT NULL REFERENCES academy_class_groups (id),
  learner_uid             text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  attempt_number          integer NOT NULL CHECK (attempt_number >= 1),
  kind                    text NOT NULL CHECK (kind IN ('attempt', 'revision')),
  revision_of_attempt_id  uuid NULL REFERENCES academy_assessment_attempts (id),
  state                   text NOT NULL CHECK (state IN ('in_progress', 'needs_review', 'graded', 'returned')),
  responses               jsonb NOT NULL,
  item_results            jsonb NULL,
  earned_points           numeric NULL,
  max_points              numeric NOT NULL CHECK (max_points >= 0),
  score_percent           integer NULL CHECK (score_percent IS NULL OR score_percent BETWEEN 0 AND 100),
  is_late                 boolean NOT NULL,
  started_at              timestamptz NOT NULL,
  submitted_at            timestamptz NULL,
  graded_by               text NULL,
  graded_at               timestamptz NULL,
  feedback                text NULL CHECK (feedback IS NULL OR length(feedback) <= 10000),
  released_at             timestamptz NULL,
  revision                integer NOT NULL CHECK (revision >= 1),
  updated_at              timestamptz NOT NULL,
  CONSTRAINT academy_assessment_attempts_number_uq UNIQUE (assignment_id, learner_uid, attempt_number),
  CONSTRAINT academy_assessment_attempts_revision_link CHECK ((kind = 'revision') = (revision_of_attempt_id IS NOT NULL)),
  CONSTRAINT academy_assessment_attempts_submitted CHECK (state = 'in_progress' OR submitted_at IS NOT NULL)
);

CREATE UNIQUE INDEX academy_assessment_attempts_one_open_uq
  ON academy_assessment_attempts (assignment_id, learner_uid) WHERE state = 'in_progress';
CREATE INDEX academy_assessment_attempts_review_idx
  ON academy_assessment_attempts (class_group_id, state, submitted_at);
CREATE INDEX academy_assessment_attempts_learner_idx
  ON academy_assessment_attempts (learner_uid, class_group_id);

CREATE TABLE academy_completions (
  id                 uuid PRIMARY KEY,
  enrollment_id      uuid NOT NULL REFERENCES academy_enrollments (id),
  class_group_id     uuid NOT NULL REFERENCES academy_class_groups (id),
  course_id          uuid NOT NULL REFERENCES academy_courses (id),
  learner_uid        text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  completed_at       timestamptz NOT NULL,
  decided_by         text NOT NULL,
  met_all_criteria   boolean NOT NULL,
  criteria_snapshot  jsonb NOT NULL,
  override_reason    text NULL,
  revoked_at         timestamptz NULL,
  revoked_by         text NULL,
  revoke_reason      text NULL,
  CONSTRAINT academy_completions_override CHECK (met_all_criteria OR (override_reason IS NOT NULL AND length(btrim(override_reason)) > 0)),
  CONSTRAINT academy_completions_revocation CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL) OR
    (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND length(btrim(revoke_reason)) > 0)
  )
);

CREATE UNIQUE INDEX academy_completions_enrollment_uq ON academy_completions (enrollment_id);
CREATE INDEX academy_completions_learner_idx ON academy_completions (learner_uid, course_id);

COMMIT;
