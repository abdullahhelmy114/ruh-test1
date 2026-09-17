-- =============================================================================
-- Migration 0001 — academy governance foundation (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Creates the shared governance substrate used by every later academy
--   module: academic policy values (academy -> program -> course), the
--   append-only audit trail, and human approval gates with their decisions.
--
-- Impact
--   Strictly additive. Creates new academy_* tables, indexes, functions and
--   triggers only. No existing table, column, constraint, index or row is
--   altered, updated or removed. No historical source data is touched.
--
-- Rollback strategy
--   Apply 0001_academy_governance_foundation.down.sql, which drops only the
--   objects created here. Audit history and policy values recorded after this
--   migration are lost on rollback: export academy_audit_events and
--   academy_policy_values first if they must be retained.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it to an authorised,
--   non-production database first. Never apply to the historical source
--   database.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Academic policy values
-- ---------------------------------------------------------------------------
CREATE TABLE academy_policy_values (
  id          uuid PRIMARY KEY,
  policy_key  text NOT NULL CHECK (policy_key ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$'),
  scope       text NOT NULL CHECK (scope IN ('academy', 'program', 'course')),
  program_id  uuid NULL,
  course_id   uuid NULL,
  value       jsonb NOT NULL,
  revision    integer NOT NULL CHECK (revision >= 1),
  set_by      text NOT NULL CHECK (length(set_by) BETWEEN 1 AND 128),
  set_at      timestamptz NOT NULL,
  reason      text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  CONSTRAINT academy_policy_values_scope_shape CHECK (
    (scope = 'academy' AND program_id IS NULL AND course_id IS NULL) OR
    (scope = 'program' AND program_id IS NOT NULL AND course_id IS NULL) OR
    (scope = 'course'  AND course_id IS NOT NULL AND program_id IS NULL)
  )
);

CREATE UNIQUE INDEX academy_policy_values_academy_uq
  ON academy_policy_values (policy_key) WHERE scope = 'academy';
CREATE UNIQUE INDEX academy_policy_values_program_uq
  ON academy_policy_values (policy_key, program_id) WHERE scope = 'program';
CREATE UNIQUE INDEX academy_policy_values_course_uq
  ON academy_policy_values (policy_key, course_id) WHERE scope = 'course';
CREATE INDEX academy_policy_values_program_idx
  ON academy_policy_values (program_id) WHERE program_id IS NOT NULL;
CREATE INDEX academy_policy_values_course_idx
  ON academy_policy_values (course_id) WHERE course_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Audit trail (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE academy_audit_events (
  id                    uuid PRIMARY KEY,
  occurred_at           timestamptz NOT NULL,
  actor_uid             text NOT NULL CHECK (length(actor_uid) BETWEEN 1 AND 128),
  actor_role            text NOT NULL CHECK (actor_role IN ('admin', 'teacher', 'student', 'applicant', 'system')),
  action                text NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  impact                text NOT NULL CHECK (impact IN ('low', 'standard', 'high')),
  object_kind           text NOT NULL,
  object_id             text NOT NULL,
  previous_version_id   uuid NULL,
  new_version_id        uuid NULL,
  reason                text NULL CHECK (reason IS NULL OR length(reason) <= 2000),
  impact_scope          jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_relationships jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_state        text NULL,
  rollback_capable      boolean NOT NULL DEFAULT false,
  rollback_strategy     text NULL,
  correlation_id        text NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX academy_audit_events_object_idx
  ON academy_audit_events (object_kind, object_id, occurred_at DESC);
CREATE INDEX academy_audit_events_actor_idx
  ON academy_audit_events (actor_uid, occurred_at DESC);
CREATE INDEX academy_audit_events_occurred_idx
  ON academy_audit_events (occurred_at DESC, id DESC);
CREATE INDEX academy_audit_events_correlation_idx
  ON academy_audit_events (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX academy_audit_events_action_idx
  ON academy_audit_events (action, occurred_at DESC);

CREATE FUNCTION academy_reject_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END
$fn$;

CREATE TRIGGER academy_audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON academy_audit_events
  FOR EACH ROW EXECUTE FUNCTION academy_reject_mutation();

CREATE TRIGGER academy_audit_events_no_truncate
  BEFORE TRUNCATE ON academy_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION academy_reject_mutation();

-- ---------------------------------------------------------------------------
-- Approval gates
-- ---------------------------------------------------------------------------
CREATE TABLE academy_approval_gate_definitions (
  gate_type           text PRIMARY KEY CHECK (gate_type IN (
                        'publication', 'high_impact_academic', 'rights_clearance',
                        'religious_review', 'historical_review', 'privacy_review',
                        'final_assessment_release', 'permanent_deletion', 'external_publication')),
  required_approvals  integer NOT NULL CHECK (required_approvals BETWEEN 1 AND 10),
  eligible_roles      text[] NOT NULL CHECK (
                        cardinality(eligible_roles) > 0
                        AND eligible_roles <@ ARRAY['admin', 'teacher']::text[]),
  allow_self_approval boolean NOT NULL,
  updated_by          text NOT NULL,
  updated_at          timestamptz NOT NULL,
  reason              text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000)
);

CREATE TABLE academy_approval_gates (
  id                  uuid PRIMARY KEY,
  gate_type           text NOT NULL REFERENCES academy_approval_gate_definitions (gate_type),
  subject_kind        text NOT NULL,
  subject_id          text NOT NULL,
  subject_version_id  uuid NULL,
  state               text NOT NULL CHECK (state IN ('open', 'approved', 'rejected', 'changes_requested', 'cancelled')),
  requested_by        text NOT NULL,
  requested_at        timestamptz NOT NULL,
  resolved_at         timestamptz NULL,
  -- Snapshot of the definition at the moment the gate was opened.
  required_approvals  integer NOT NULL CHECK (required_approvals BETWEEN 1 AND 10),
  eligible_roles      text[] NOT NULL CHECK (
                        cardinality(eligible_roles) > 0
                        AND eligible_roles <@ ARRAY['admin', 'teacher']::text[]),
  allow_self_approval boolean NOT NULL,
  CONSTRAINT academy_approval_gates_resolution CHECK (
    (state = 'open' AND resolved_at IS NULL) OR (state <> 'open' AND resolved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX academy_approval_gates_one_open_uq
  ON academy_approval_gates (
    gate_type, subject_kind, subject_id,
    COALESCE(subject_version_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE state = 'open';
CREATE INDEX academy_approval_gates_subject_idx
  ON academy_approval_gates (subject_kind, subject_id, requested_at DESC);
CREATE INDEX academy_approval_gates_state_idx
  ON academy_approval_gates (state, requested_at DESC);

CREATE TABLE academy_approval_decisions (
  id           uuid PRIMARY KEY,
  gate_id      uuid NOT NULL REFERENCES academy_approval_gates (id),
  decided_by   text NOT NULL,
  decided_role text NOT NULL CHECK (decided_role IN ('admin', 'teacher')),
  decision     text NOT NULL CHECK (decision IN ('approve', 'reject', 'request_changes')),
  reason       text NULL,
  decided_at   timestamptz NOT NULL,
  CONSTRAINT academy_approval_decisions_one_per_person UNIQUE (gate_id, decided_by),
  CONSTRAINT academy_approval_decisions_reason CHECK (
    decision = 'approve' OR (reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 2000)
  )
);

CREATE INDEX academy_approval_decisions_gate_idx
  ON academy_approval_decisions (gate_id, decided_at);

CREATE TRIGGER academy_approval_decisions_no_update_delete
  BEFORE UPDATE OR DELETE ON academy_approval_decisions
  FOR EACH ROW EXECUTE FUNCTION academy_reject_mutation();

CREATE TRIGGER academy_approval_decisions_no_truncate
  BEFORE TRUNCATE ON academy_approval_decisions
  FOR EACH STATEMENT EXECUTE FUNCTION academy_reject_mutation();

COMMIT;
