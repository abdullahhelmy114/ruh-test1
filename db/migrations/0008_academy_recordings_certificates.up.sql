-- =============================================================================
-- Migration 0008 — academy recordings and certificates (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates session recordings with their review/publication lifecycle, and
--   certificates with unguessable public verification codes, name and
--   course-title snapshots, and revocation.
--
-- Impact
--   Strictly additive. Creates new academy_* tables and indexes only. The
--   existing certificates and certifications tables are not altered.
--
-- Rollback strategy
--   Apply 0008_academy_recordings_certificates.down.sql, which drops only
--   the tables created here. Recordings and certificates recorded after this
--   migration are lost on rollback: export them first, and note that issued
--   certificate codes would stop verifying.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0007, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_recordings (
  id                uuid PRIMARY KEY,
  session_id        uuid NOT NULL REFERENCES academy_sessions (id),
  class_group_id    uuid NOT NULL REFERENCES academy_class_groups (id),
  course_id         uuid NOT NULL REFERENCES academy_courses (id),
  title             text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  media_url         text NOT NULL CHECK (length(media_url) <= 2000 AND media_url LIKE 'https://%'),
  duration_seconds  integer NULL CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 86400),
  state             text NOT NULL CHECK (state IN ('processing', 'failed', 'in_review', 'published', 'restricted', 'archived')),
  state_reason      text NULL CHECK (state_reason IS NULL OR length(state_reason) <= 2000),
  published_at      timestamptz NULL,
  revision          integer NOT NULL CHECK (revision >= 1),
  created_by        text NOT NULL,
  created_at        timestamptz NOT NULL,
  updated_by        text NOT NULL,
  updated_at        timestamptz NOT NULL,
  CONSTRAINT academy_recordings_published CHECK (state <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX academy_recordings_class_group_idx ON academy_recordings (class_group_id, state);
CREATE INDEX academy_recordings_session_idx ON academy_recordings (session_id);

CREATE TABLE academy_certificates (
  id                     uuid PRIMARY KEY,
  code                   text NOT NULL CHECK (code ~ '^RQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'),
  enrollment_id          uuid NOT NULL REFERENCES academy_enrollments (id),
  completion_id          uuid NULL REFERENCES academy_completions (id),
  learner_uid            text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  course_id              uuid NOT NULL REFERENCES academy_courses (id),
  class_group_id         uuid NOT NULL REFERENCES academy_class_groups (id),
  learner_name_snapshot  text NOT NULL CHECK (length(btrim(learner_name_snapshot)) BETWEEN 1 AND 200),
  course_title_snapshot  text NOT NULL CHECK (length(btrim(course_title_snapshot)) BETWEEN 1 AND 200),
  issued_at              timestamptz NOT NULL,
  issued_by              text NOT NULL,
  state                  text NOT NULL CHECK (state IN ('issued', 'revoked')),
  revoked_at             timestamptz NULL,
  revoked_by             text NULL,
  revoke_reason          text NULL,
  CONSTRAINT academy_certificates_revocation CHECK (
    (state = 'issued' AND revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL) OR
    (state = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND length(btrim(revoke_reason)) > 0)
  )
);

CREATE UNIQUE INDEX academy_certificates_code_uq ON academy_certificates (code);
CREATE UNIQUE INDEX academy_certificates_one_issued_uq ON academy_certificates (enrollment_id) WHERE state = 'issued';
CREATE INDEX academy_certificates_learner_idx ON academy_certificates (learner_uid, issued_at DESC);
CREATE INDEX academy_certificates_completion_idx ON academy_certificates (completion_id) WHERE completion_id IS NOT NULL;

COMMIT;
