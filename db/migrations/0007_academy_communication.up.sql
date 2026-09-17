-- =============================================================================
-- Migration 0007 — academy messaging, announcements, notifications (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates relationship-governed message threads with append-only messages
--   and per-reader read markers, scoped announcements, and in-app
--   notifications.
--
-- Impact
--   Strictly additive. Creates new academy_* tables, indexes and triggers
--   only (the triggers reuse academy_reject_mutation from 0001). The
--   existing messages and notifications tables are not altered.
--
-- Rollback strategy
--   Apply 0007_academy_communication.down.sql, which drops only the tables
--   created here (their triggers go with them). Messages, announcements and
--   notifications recorded after this migration are lost on rollback:
--   export them first if needed.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0006, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_message_threads (
  id                    uuid PRIMARY KEY,
  participant_low_uid   text NOT NULL CHECK (length(participant_low_uid) BETWEEN 1 AND 128),
  participant_high_uid  text NOT NULL CHECK (length(participant_high_uid) BETWEEN 1 AND 128),
  class_group_id        uuid NULL REFERENCES academy_class_groups (id),
  created_by            text NOT NULL,
  created_at            timestamptz NOT NULL,
  last_message_at       timestamptz NULL,
  CONSTRAINT academy_message_threads_ordered CHECK (participant_low_uid < participant_high_uid)
);

CREATE UNIQUE INDEX academy_message_threads_pair_uq
  ON academy_message_threads (
    participant_low_uid, participant_high_uid,
    COALESCE(class_group_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX academy_message_threads_low_idx ON academy_message_threads (participant_low_uid, last_message_at DESC);
CREATE INDEX academy_message_threads_high_idx ON academy_message_threads (participant_high_uid, last_message_at DESC);

CREATE TABLE academy_messages (
  id          uuid PRIMARY KEY,
  thread_id   uuid NOT NULL REFERENCES academy_message_threads (id),
  sender_uid  text NOT NULL CHECK (length(sender_uid) BETWEEN 1 AND 128),
  body        text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  created_at  timestamptz NOT NULL
);

CREATE INDEX academy_messages_thread_idx ON academy_messages (thread_id, created_at DESC, id DESC);

CREATE TRIGGER academy_messages_no_update_delete
  BEFORE UPDATE OR DELETE ON academy_messages
  FOR EACH ROW EXECUTE FUNCTION academy_reject_mutation();

CREATE TABLE academy_thread_reads (
  thread_id     uuid NOT NULL REFERENCES academy_message_threads (id),
  reader_uid    text NOT NULL CHECK (length(reader_uid) BETWEEN 1 AND 128),
  last_read_at  timestamptz NOT NULL,
  PRIMARY KEY (thread_id, reader_uid)
);

CREATE TABLE academy_announcements (
  id               uuid PRIMARY KEY,
  scope            text NOT NULL CHECK (scope IN ('academy', 'course', 'class_group')),
  course_id        uuid NULL REFERENCES academy_courses (id),
  class_group_id   uuid NULL REFERENCES academy_class_groups (id),
  title            text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  body             text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 20000),
  author_uid       text NOT NULL,
  state            text NOT NULL CHECK (state IN ('published', 'withdrawn')),
  published_at     timestamptz NOT NULL,
  withdrawn_at     timestamptz NULL,
  withdrawn_by     text NULL,
  withdraw_reason  text NULL,
  revision         integer NOT NULL CHECK (revision >= 1),
  CONSTRAINT academy_announcements_scope_shape CHECK (
    (scope = 'academy' AND course_id IS NULL AND class_group_id IS NULL) OR
    (scope = 'course' AND course_id IS NOT NULL AND class_group_id IS NULL) OR
    (scope = 'class_group' AND course_id IS NOT NULL AND class_group_id IS NOT NULL)
  ),
  CONSTRAINT academy_announcements_withdrawal CHECK (
    (state = 'published' AND withdrawn_at IS NULL AND withdrawn_by IS NULL AND withdraw_reason IS NULL) OR
    (state = 'withdrawn' AND withdrawn_at IS NOT NULL AND withdrawn_by IS NOT NULL AND length(btrim(withdraw_reason)) > 0)
  )
);

CREATE INDEX academy_announcements_scope_idx ON academy_announcements (scope, published_at DESC);
CREATE INDEX academy_announcements_course_idx ON academy_announcements (course_id, published_at DESC) WHERE course_id IS NOT NULL;
CREATE INDEX academy_announcements_class_group_idx ON academy_announcements (class_group_id, published_at DESC) WHERE class_group_id IS NOT NULL;

CREATE TABLE academy_notifications (
  id             uuid PRIMARY KEY,
  recipient_uid  text NOT NULL CHECK (length(recipient_uid) BETWEEN 1 AND 128),
  kind           text NOT NULL CHECK (kind IN ('message', 'announcement', 'assessment_result', 'assessment_returned')),
  title          text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  link           text NULL CHECK (link IS NULL OR (length(link) <= 500 AND link LIKE '/%')),
  source_id      uuid NOT NULL,
  created_at     timestamptz NOT NULL,
  read_at        timestamptz NULL
);

CREATE UNIQUE INDEX academy_notifications_source_uq ON academy_notifications (recipient_uid, kind, source_id);
CREATE INDEX academy_notifications_recipient_idx ON academy_notifications (recipient_uid, created_at DESC);

COMMIT;
