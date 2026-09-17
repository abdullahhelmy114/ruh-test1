-- =============================================================================
-- Migration 0006 — academy library resources and reading progress (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Links existing library books to academy courses (and optionally lessons)
--   as required or recommended reading, whole or as a page range, and stores
--   each reader's private reading position.
--
-- Impact
--   Strictly additive. Creates new academy_* tables and indexes only. The
--   existing library tables (library_books, library_pages, library_access,
--   page_annotations, ...) are not altered and not referenced by
--   constraints; library_book_id is an informational link to library_books.id.
--
-- Rollback strategy
--   Apply 0006_academy_library.down.sql, which drops only the tables created
--   here. Course reading links and reading positions recorded after this
--   migration are lost on rollback: export them first if needed.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0005, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_course_resources (
  id               uuid PRIMARY KEY,
  course_id        uuid NOT NULL REFERENCES academy_courses (id),
  lesson_id        uuid NULL REFERENCES academy_lessons (id),
  library_book_id  uuid NOT NULL,
  purpose          text NOT NULL CHECK (purpose IN ('required', 'recommended')),
  pages_from       integer NULL,
  pages_to         integer NULL,
  note             text NULL CHECK (note IS NULL OR length(note) <= 2000),
  revision         integer NOT NULL CHECK (revision >= 1),
  created_by       text NOT NULL,
  created_at       timestamptz NOT NULL,
  removed_at       timestamptz NULL,
  removed_by       text NULL,
  remove_reason    text NULL,
  CONSTRAINT academy_course_resources_pages CHECK (
    (pages_from IS NULL AND pages_to IS NULL) OR (pages_from >= 1 AND pages_to >= pages_from)
  ),
  CONSTRAINT academy_course_resources_removal CHECK (
    (removed_at IS NULL AND removed_by IS NULL AND remove_reason IS NULL) OR
    (removed_at IS NOT NULL AND removed_by IS NOT NULL AND length(btrim(remove_reason)) BETWEEN 1 AND 2000)
  )
);

-- One active link per course, book, lesson and page range, so two concurrent
-- additions of the same reading cannot both succeed.
CREATE UNIQUE INDEX academy_course_resources_active_uq
  ON academy_course_resources (
    course_id, library_book_id,
    COALESCE(lesson_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(pages_from, 0), COALESCE(pages_to, 0))
  WHERE removed_at IS NULL;
CREATE INDEX academy_course_resources_course_idx ON academy_course_resources (course_id) WHERE removed_at IS NULL;
CREATE INDEX academy_course_resources_book_idx ON academy_course_resources (library_book_id) WHERE removed_at IS NULL;

CREATE TABLE academy_reading_progress (
  user_uid         text NOT NULL CHECK (length(user_uid) BETWEEN 1 AND 128),
  library_book_id  uuid NOT NULL,
  last_page        integer NOT NULL CHECK (last_page >= 1),
  updated_at       timestamptz NOT NULL,
  PRIMARY KEY (user_uid, library_book_id)
);

COMMIT;
