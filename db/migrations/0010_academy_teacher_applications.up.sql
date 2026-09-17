-- =============================================================================
-- Migration 0010 — academy teacher applications (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates the teacher application record (the details an applicant
--   submitted, references to their private CV and introduction video, the
--   review state and a revision for concurrency-safe decisions) and an
--   append-only history of every submission and administrative decision.
--   Approval activates the teacher account in the same transaction as the
--   decision (see src/lib/academy/services/teacher-service.ts).
--
-- Impact
--   Strictly additive. Creates new academy_* tables, indexes and a trigger
--   only. The existing profiles and teacher_applications tables are not
--   altered and no rows are copied: teacher accounts created before this
--   migration create their application record from their own application
--   page after signing in.
--
-- Rollback strategy
--   Apply 0010_academy_teacher_applications.down.sql, which drops only the
--   tables created here. Applications and their review history are lost on
--   rollback; profile statuses already set by decisions are not reverted.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0009, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_teacher_applications (
  id                     uuid PRIMARY KEY,
  applicant_uid          text NOT NULL CHECK (length(applicant_uid) BETWEEN 1 AND 128),
  state                  text NOT NULL CHECK (state IN ('draft', 'submitted', 'in_review', 'interview', 'changes_requested', 'approved', 'rejected', 'withdrawn')),
  details                jsonb NOT NULL CHECK (jsonb_typeof(details) = 'object' AND length(details::text) <= 20000),
  cv_public_id           text NULL CHECK (cv_public_id IS NULL OR cv_public_id ~ '^teacher-signup/cv/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'),
  intro_video_public_id  text NULL CHECK (intro_video_public_id IS NULL OR intro_video_public_id ~ '^teacher-signup/videos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  revision               integer NOT NULL CHECK (revision >= 1),
  submitted_at           timestamptz NULL,
  decided_at             timestamptz NULL,
  decided_by             text NULL CHECK (decided_by IS NULL OR length(decided_by) BETWEEN 1 AND 128),
  decision_reason        text NULL CHECK (decision_reason IS NULL OR length(decision_reason) <= 2000),
  created_at             timestamptz NOT NULL,
  updated_at             timestamptz NOT NULL,
  CONSTRAINT academy_teacher_applications_submitted CHECK (state = 'draft' OR submitted_at IS NOT NULL),
  CONSTRAINT academy_teacher_applications_decided CHECK (state NOT IN ('approved', 'rejected') OR (decided_at IS NOT NULL AND decided_by IS NOT NULL)),
  CONSTRAINT academy_teacher_applications_cv CHECK (state = 'draft' OR cv_public_id IS NOT NULL)
);

-- One application per account that is still open or approved (double submission, duplicate applications).
CREATE UNIQUE INDEX academy_teacher_applications_live_uq ON academy_teacher_applications (applicant_uid)
  WHERE state NOT IN ('rejected', 'withdrawn');
CREATE INDEX academy_teacher_applications_queue_idx ON academy_teacher_applications (state, submitted_at, id);

CREATE TABLE academy_teacher_application_events (
  id                    uuid PRIMARY KEY,
  application_id        uuid NOT NULL REFERENCES academy_teacher_applications (id),
  action                text NOT NULL CHECK (action IN ('submit', 'resubmit', 'start_review', 'schedule_interview', 'request_changes', 'approve', 'reject')),
  from_state            text NULL,
  to_state              text NOT NULL,
  reason                text NULL CHECK (reason IS NULL OR length(reason) <= 2000),
  actor_uid             text NOT NULL CHECK (length(actor_uid) BETWEEN 1 AND 128),
  actor_role            text NOT NULL CHECK (actor_role IN ('admin', 'applicant')),
  application_revision  integer NOT NULL CHECK (application_revision >= 1),
  occurred_at           timestamptz NOT NULL
);

-- One event per application revision: two decisions on the same revision cannot both be recorded.
CREATE UNIQUE INDEX academy_teacher_application_events_revision_uq ON academy_teacher_application_events (application_id, application_revision);

CREATE TRIGGER academy_teacher_application_events_no_update_delete
  BEFORE UPDATE OR DELETE ON academy_teacher_application_events
  FOR EACH ROW EXECUTE FUNCTION academy_reject_mutation();

COMMIT;
