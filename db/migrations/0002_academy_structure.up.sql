-- =============================================================================
-- Migration 0002 — academy core academic structure (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates programs, courses, curricula with versioned outlines (units and
--   lessons with stable identities), class groups pinned to published
--   curriculum versions, teacher assignments, sessions and enrollments.
--   Adds a guard function that aborts a multi-statement transaction when a
--   conditional write matched no row (stale edit), and links academy policy
--   values to the new program and course tables.
--
-- Impact
--   Strictly additive. Creates new academy_* tables, indexes and one
--   function, and adds two foreign keys to academy_policy_values (created by
--   0001). No pre-existing application table is altered, updated or removed.
--   Legacy tables (course, live_course, lessons, enrollments, profiles) are
--   not referenced by constraints; academy_courses.catalog_course_id is an
--   informational link to course.id without a foreign key.
--
-- Rollback strategy
--   Apply 0002_academy_structure.down.sql, which drops the two foreign keys
--   and then only the objects created here. Academic structure recorded
--   after this migration is lost on rollback: export it first if needed.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0001, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Stale-write guard
-- ---------------------------------------------------------------------------
CREATE FUNCTION academy_expect_rows(actual bigint, expected bigint) RETURNS boolean
  LANGUAGE plpgsql AS $fn$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'academy stale write: expected % row(s), matched %', expected, actual
      USING ERRCODE = 'RQ409';
  END IF;
  RETURN true;
END
$fn$;

-- ---------------------------------------------------------------------------
-- Programs and courses
-- ---------------------------------------------------------------------------
CREATE TABLE academy_programs (
  id               uuid PRIMARY KEY,
  slug             text NOT NULL CHECK (length(slug) BETWEEN 3 AND 80 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description      text NULL CHECK (description IS NULL OR length(description) <= 5000),
  status           text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  revision         integer NOT NULL CHECK (revision >= 1),
  created_by       text NOT NULL,
  created_at       timestamptz NOT NULL,
  updated_by       text NOT NULL,
  updated_at       timestamptz NOT NULL,
  deleted_at       timestamptz NULL,
  deleted_by       text NULL,
  deletion_reason  text NULL,
  CONSTRAINT academy_programs_deletion CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND deletion_reason IS NULL) OR
    (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND length(btrim(deletion_reason)) BETWEEN 1 AND 2000)
  )
);

CREATE UNIQUE INDEX academy_programs_slug_uq ON academy_programs (slug);

CREATE TABLE academy_courses (
  id                 uuid PRIMARY KEY,
  program_id         uuid NULL REFERENCES academy_programs (id),
  catalog_course_id  uuid NULL,
  slug               text NOT NULL CHECK (length(slug) BETWEEN 3 AND 80 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title              text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description        text NULL CHECK (description IS NULL OR length(description) <= 5000),
  status             text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  revision           integer NOT NULL CHECK (revision >= 1),
  created_by         text NOT NULL,
  created_at         timestamptz NOT NULL,
  updated_by         text NOT NULL,
  updated_at         timestamptz NOT NULL,
  deleted_at         timestamptz NULL,
  deleted_by         text NULL,
  deletion_reason    text NULL,
  CONSTRAINT academy_courses_deletion CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND deletion_reason IS NULL) OR
    (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND length(btrim(deletion_reason)) BETWEEN 1 AND 2000)
  )
);

CREATE UNIQUE INDEX academy_courses_slug_uq ON academy_courses (slug);
CREATE UNIQUE INDEX academy_courses_catalog_uq ON academy_courses (catalog_course_id) WHERE catalog_course_id IS NOT NULL;
CREATE INDEX academy_courses_program_idx ON academy_courses (program_id) WHERE program_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Curricula, versions and outlines
-- ---------------------------------------------------------------------------
CREATE TABLE academy_curricula (
  id          uuid PRIMARY KEY,
  course_id   uuid NOT NULL REFERENCES academy_courses (id),
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL
);

CREATE UNIQUE INDEX academy_curricula_course_uq ON academy_curricula (course_id);
CREATE UNIQUE INDEX academy_curricula_id_course_uq ON academy_curricula (id, course_id);

CREATE TABLE academy_curriculum_versions (
  id                   uuid PRIMARY KEY,
  curriculum_id        uuid NOT NULL REFERENCES academy_curricula (id),
  version_number       integer NOT NULL CHECK (version_number >= 1),
  based_on_version_id  uuid NULL REFERENCES academy_curriculum_versions (id),
  state                text NOT NULL CHECK (state IN (
                         'draft', 'in_review', 'changes_requested', 'approved',
                         'published', 'superseded', 'rejected', 'archived')),
  revision             integer NOT NULL CHECK (revision >= 1),
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
  CONSTRAINT academy_curriculum_versions_number_uq UNIQUE (curriculum_id, version_number),
  CONSTRAINT academy_curriculum_versions_publication CHECK (
    state NOT IN ('published', 'superseded') OR (published_at IS NOT NULL AND published_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX academy_curriculum_versions_id_curriculum_uq
  ON academy_curriculum_versions (id, curriculum_id);
CREATE UNIQUE INDEX academy_curriculum_versions_one_working_uq
  ON academy_curriculum_versions (curriculum_id) WHERE state IN ('draft', 'in_review', 'changes_requested', 'approved');
CREATE UNIQUE INDEX academy_curriculum_versions_one_published_uq
  ON academy_curriculum_versions (curriculum_id) WHERE state = 'published';

CREATE TABLE academy_units (
  id             uuid PRIMARY KEY,
  curriculum_id  uuid NOT NULL REFERENCES academy_curricula (id),
  created_by     text NOT NULL,
  created_at     timestamptz NOT NULL
);

CREATE UNIQUE INDEX academy_units_id_curriculum_uq ON academy_units (id, curriculum_id);

CREATE TABLE academy_lessons (
  id             uuid PRIMARY KEY,
  curriculum_id  uuid NOT NULL REFERENCES academy_curricula (id),
  created_by     text NOT NULL,
  created_at     timestamptz NOT NULL
);

CREATE UNIQUE INDEX academy_lessons_id_curriculum_uq ON academy_lessons (id, curriculum_id);

CREATE TABLE academy_curriculum_version_units (
  curriculum_version_id  uuid NOT NULL,
  curriculum_id          uuid NOT NULL,
  unit_id                uuid NOT NULL,
  position               integer NOT NULL CHECK (position >= 1),
  title                  text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  summary                text NULL CHECK (summary IS NULL OR length(summary) <= 5000),
  PRIMARY KEY (curriculum_version_id, unit_id),
  CONSTRAINT academy_curriculum_version_units_position_uq UNIQUE (curriculum_version_id, position),
  CONSTRAINT academy_curriculum_version_units_version_fk
    FOREIGN KEY (curriculum_version_id, curriculum_id) REFERENCES academy_curriculum_versions (id, curriculum_id),
  CONSTRAINT academy_curriculum_version_units_unit_fk
    FOREIGN KEY (unit_id, curriculum_id) REFERENCES academy_units (id, curriculum_id)
);

CREATE TABLE academy_curriculum_version_lessons (
  curriculum_version_id  uuid NOT NULL,
  curriculum_id          uuid NOT NULL,
  lesson_id              uuid NOT NULL,
  unit_id                uuid NOT NULL,
  position               integer NOT NULL CHECK (position >= 1),
  title                  text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  summary                text NULL CHECK (summary IS NULL OR length(summary) <= 5000),
  planned_minutes        integer NULL CHECK (planned_minutes IS NULL OR planned_minutes BETWEEN 1 AND 1440),
  PRIMARY KEY (curriculum_version_id, lesson_id),
  CONSTRAINT academy_curriculum_version_lessons_position_uq UNIQUE (curriculum_version_id, unit_id, position),
  CONSTRAINT academy_curriculum_version_lessons_unit_fk
    FOREIGN KEY (curriculum_version_id, unit_id) REFERENCES academy_curriculum_version_units (curriculum_version_id, unit_id),
  CONSTRAINT academy_curriculum_version_lessons_lesson_fk
    FOREIGN KEY (lesson_id, curriculum_id) REFERENCES academy_lessons (id, curriculum_id),
  CONSTRAINT academy_curriculum_version_lessons_version_fk
    FOREIGN KEY (curriculum_version_id, curriculum_id) REFERENCES academy_curriculum_versions (id, curriculum_id)
);

CREATE INDEX academy_curriculum_version_lessons_lesson_idx
  ON academy_curriculum_version_lessons (lesson_id);

-- ---------------------------------------------------------------------------
-- Class groups and teachers
-- ---------------------------------------------------------------------------
CREATE TABLE academy_class_groups (
  id                     uuid PRIMARY KEY,
  course_id              uuid NOT NULL,
  curriculum_id          uuid NOT NULL,
  curriculum_version_id  uuid NOT NULL,
  name                   text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  status                 text NOT NULL CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  status_reason          text NULL CHECK (status_reason IS NULL OR length(status_reason) <= 2000),
  capacity               integer NULL CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 10000),
  starts_on              date NULL,
  ends_on                date NULL,
  revision               integer NOT NULL CHECK (revision >= 1),
  created_by             text NOT NULL,
  created_at             timestamptz NOT NULL,
  updated_by             text NOT NULL,
  updated_at             timestamptz NOT NULL,
  deleted_at             timestamptz NULL,
  deleted_by             text NULL,
  deletion_reason        text NULL,
  CONSTRAINT academy_class_groups_curriculum_fk
    FOREIGN KEY (curriculum_id, course_id) REFERENCES academy_curricula (id, course_id),
  CONSTRAINT academy_class_groups_version_fk
    FOREIGN KEY (curriculum_version_id, curriculum_id) REFERENCES academy_curriculum_versions (id, curriculum_id),
  CONSTRAINT academy_class_groups_dates CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT academy_class_groups_deletion CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND deletion_reason IS NULL) OR
    (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND length(btrim(deletion_reason)) BETWEEN 1 AND 2000)
  )
);

CREATE UNIQUE INDEX academy_class_groups_id_course_uq ON academy_class_groups (id, course_id);
CREATE INDEX academy_class_groups_course_idx ON academy_class_groups (course_id, status);

CREATE TABLE academy_class_group_teachers (
  id               uuid PRIMARY KEY,
  class_group_id   uuid NOT NULL REFERENCES academy_class_groups (id),
  teacher_uid      text NOT NULL CHECK (length(teacher_uid) BETWEEN 1 AND 128),
  assigned_by      text NOT NULL,
  assigned_at      timestamptz NOT NULL,
  unassigned_by    text NULL,
  unassigned_at    timestamptz NULL,
  unassign_reason  text NULL,
  CONSTRAINT academy_class_group_teachers_unassignment CHECK (
    (unassigned_at IS NULL AND unassigned_by IS NULL AND unassign_reason IS NULL) OR
    (unassigned_at IS NOT NULL AND unassigned_by IS NOT NULL AND length(btrim(unassign_reason)) BETWEEN 1 AND 2000)
  )
);

CREATE UNIQUE INDEX academy_class_group_teachers_active_uq
  ON academy_class_group_teachers (class_group_id, teacher_uid) WHERE unassigned_at IS NULL;
CREATE INDEX academy_class_group_teachers_teacher_idx
  ON academy_class_group_teachers (teacher_uid) WHERE unassigned_at IS NULL;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
CREATE TABLE academy_sessions (
  id                     uuid PRIMARY KEY,
  class_group_id         uuid NOT NULL REFERENCES academy_class_groups (id),
  curriculum_version_id  uuid NOT NULL,
  lesson_id              uuid NOT NULL,
  starts_at              timestamptz NOT NULL,
  ends_at                timestamptz NOT NULL,
  state                  text NOT NULL CHECK (state IN ('scheduled', 'live', 'completed', 'cancelled')),
  state_reason           text NULL CHECK (state_reason IS NULL OR length(state_reason) <= 2000),
  meeting_url            text NULL CHECK (meeting_url IS NULL OR (length(meeting_url) <= 2000 AND meeting_url LIKE 'https://%')),
  revision               integer NOT NULL CHECK (revision >= 1),
  created_by             text NOT NULL,
  created_at             timestamptz NOT NULL,
  updated_by             text NOT NULL,
  updated_at             timestamptz NOT NULL,
  CONSTRAINT academy_sessions_lesson_fk
    FOREIGN KEY (curriculum_version_id, lesson_id) REFERENCES academy_curriculum_version_lessons (curriculum_version_id, lesson_id),
  CONSTRAINT academy_sessions_window CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '24 hours')
);

CREATE INDEX academy_sessions_class_group_idx ON academy_sessions (class_group_id, starts_at);
CREATE INDEX academy_sessions_upcoming_idx ON academy_sessions (starts_at) WHERE state IN ('scheduled', 'live');
CREATE INDEX academy_sessions_lesson_idx ON academy_sessions (lesson_id);

-- ---------------------------------------------------------------------------
-- Enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE academy_enrollments (
  id              uuid PRIMARY KEY,
  class_group_id  uuid NOT NULL,
  course_id       uuid NOT NULL,
  learner_uid     text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  state           text NOT NULL CHECK (state IN ('pending', 'active', 'suspended', 'completed', 'withdrawn', 'cancelled')),
  source          text NOT NULL CHECK (source IN ('admin', 'entitlement')),
  state_reason    text NULL CHECK (state_reason IS NULL OR length(state_reason) <= 2000),
  revision        integer NOT NULL CHECK (revision >= 1),
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL,
  updated_by      text NOT NULL,
  updated_at      timestamptz NOT NULL,
  activated_at    timestamptz NULL,
  ended_at        timestamptz NULL,
  CONSTRAINT academy_enrollments_class_group_fk
    FOREIGN KEY (class_group_id, course_id) REFERENCES academy_class_groups (id, course_id)
);

CREATE UNIQUE INDEX academy_enrollments_open_uq
  ON academy_enrollments (class_group_id, learner_uid) WHERE state IN ('pending', 'active', 'suspended');
CREATE INDEX academy_enrollments_learner_idx ON academy_enrollments (learner_uid, state);
CREATE INDEX academy_enrollments_course_idx ON academy_enrollments (course_id, state);

-- ---------------------------------------------------------------------------
-- Policy values now reference real programs and courses
-- ---------------------------------------------------------------------------
ALTER TABLE academy_policy_values
  ADD CONSTRAINT academy_policy_values_program_fk FOREIGN KEY (program_id) REFERENCES academy_programs (id);
ALTER TABLE academy_policy_values
  ADD CONSTRAINT academy_policy_values_course_fk FOREIGN KEY (course_id) REFERENCES academy_courses (id);

COMMIT;
