-- =============================================================================
-- Migration 0011 — academy commerce: Whop offers, checkouts and entitlements (FORWARD)
-- -----------------------------------------------------------------------------
-- Purpose
--   Records how a learner buys a place in a class group through Whop, the
--   academy's only payment channel:
--     * academy_offers        — an administrator's explicit mapping from one
--                               Whop plan to one class group of one course.
--                               Identity is the plan id, never a title.
--     * academy_checkouts     — a checkout the server opened for one learner
--                               and one offer; its id travels to Whop as
--                               metadata and comes back on the payment.
--     * academy_entitlements  — access bought by one verified Whop payment:
--                               the enrollment it opened, the Whop payment,
--                               membership and user it came from, and whether
--                               it is still in force (refunds and ended
--                               memberships revoke it).
--     * academy_payment_events — every signed Whop webhook delivery processed,
--                               keyed by its delivery id, so a redelivered
--                               event is recognised and changes nothing twice.
--   Payments themselves stay in Whop; nothing here stores card or financial
--   details beyond the provider's own identifiers.
--
-- Impact
--   Strictly additive. Creates new academy_* tables, indexes and a trigger
--   only; references academy_courses, academy_class_groups and
--   academy_enrollments. No legacy table is altered and no rows are copied.
--
-- Rollback strategy
--   Apply 0011_academy_commerce.down.sql, which drops only the tables created
--   here. Enrollments already opened by entitlements remain (their source says
--   'entitlement'); the record of which payment opened them is lost.
--
-- Execution status
--   NOT EXECUTED. Review-only until an operator applies it, after 0010, to an
--   authorised non-production database first. Never apply to the historical
--   source database.
-- =============================================================================

BEGIN;

CREATE TABLE academy_offers (
  id                 uuid PRIMARY KEY,
  course_id          uuid NOT NULL REFERENCES academy_courses (id),
  class_group_id     uuid NOT NULL,
  provider           text NOT NULL CHECK (provider IN ('whop')),
  provider_plan_id   text NOT NULL CHECK (provider_plan_id ~ '^plan_[A-Za-z0-9]{1,64}$'),
  label              text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  state              text NOT NULL CHECK (state IN ('active', 'retired')),
  state_reason       text NULL CHECK (state_reason IS NULL OR length(state_reason) <= 2000),
  revision           integer NOT NULL CHECK (revision >= 1),
  created_by         text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 128),
  created_at         timestamptz NOT NULL,
  updated_by         text NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 128),
  updated_at         timestamptz NOT NULL,
  CONSTRAINT academy_offers_class_group_fk
    FOREIGN KEY (class_group_id, course_id) REFERENCES academy_class_groups (id, course_id),
  CONSTRAINT academy_offers_retired_reason CHECK (state = 'active' OR state_reason IS NOT NULL)
);

-- One active offer per Whop plan: a payment for a plan maps to exactly one class group.
CREATE UNIQUE INDEX academy_offers_active_plan_uq ON academy_offers (provider, provider_plan_id) WHERE state = 'active';
CREATE INDEX academy_offers_course_idx ON academy_offers (course_id, state);

CREATE TABLE academy_checkouts (
  id                    uuid PRIMARY KEY,
  offer_id              uuid NOT NULL REFERENCES academy_offers (id),
  learner_uid           text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  provider              text NOT NULL CHECK (provider IN ('whop')),
  provider_checkout_id  text NULL CHECK (provider_checkout_id IS NULL OR provider_checkout_id ~ '^ch_[A-Za-z0-9]{1,64}$'),
  purchase_url          text NULL CHECK (purchase_url IS NULL OR (purchase_url ~ '^https://' AND length(purchase_url) <= 2000)),
  state                 text NOT NULL CHECK (state IN ('created', 'open', 'completed', 'failed')),
  failure               text NULL CHECK (failure IS NULL OR failure IN ('initialization', 'payment_failed', 'mismatch', 'not_enrollable')),
  created_at            timestamptz NOT NULL,
  updated_at            timestamptz NOT NULL,
  CONSTRAINT academy_checkouts_open CHECK (state NOT IN ('open', 'completed') OR (provider_checkout_id IS NOT NULL AND purchase_url IS NOT NULL)),
  CONSTRAINT academy_checkouts_failure CHECK ((state = 'failed') = (failure IS NOT NULL))
);

CREATE UNIQUE INDEX academy_checkouts_provider_uq ON academy_checkouts (provider, provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;
CREATE INDEX academy_checkouts_learner_idx ON academy_checkouts (learner_uid, created_at DESC);

CREATE TABLE academy_entitlements (
  id                      uuid PRIMARY KEY,
  learner_uid             text NOT NULL CHECK (length(learner_uid) BETWEEN 1 AND 128),
  offer_id                uuid NOT NULL REFERENCES academy_offers (id),
  course_id               uuid NOT NULL,
  class_group_id          uuid NOT NULL,
  enrollment_id           uuid NOT NULL REFERENCES academy_enrollments (id),
  checkout_id             uuid NOT NULL REFERENCES academy_checkouts (id),
  provider                text NOT NULL CHECK (provider IN ('whop')),
  provider_payment_id     text NOT NULL CHECK (provider_payment_id ~ '^pay_[A-Za-z0-9]{1,64}$'),
  provider_membership_id  text NULL CHECK (provider_membership_id IS NULL OR provider_membership_id ~ '^mem_[A-Za-z0-9]{1,64}$'),
  provider_user_id        text NULL CHECK (provider_user_id IS NULL OR provider_user_id ~ '^user_[A-Za-z0-9]{1,64}$'),
  state                   text NOT NULL CHECK (state IN ('active', 'revoked')),
  state_reason            text NULL CHECK (state_reason IS NULL OR state_reason IN ('refunded', 'membership_ended')),
  revision                integer NOT NULL CHECK (revision >= 1),
  granted_at              timestamptz NOT NULL,
  updated_at              timestamptz NOT NULL,
  revoked_at              timestamptz NULL,
  CONSTRAINT academy_entitlements_class_group_fk
    FOREIGN KEY (class_group_id, course_id) REFERENCES academy_class_groups (id, course_id),
  CONSTRAINT academy_entitlements_revoked CHECK ((state = 'revoked') = (revoked_at IS NOT NULL AND state_reason IS NOT NULL))
);

-- One entitlement per Whop payment: a payment is never turned into access twice.
CREATE UNIQUE INDEX academy_entitlements_payment_uq ON academy_entitlements (provider, provider_payment_id);
-- One entitlement per checkout: the checkout a learner opened grants at most once.
CREATE UNIQUE INDEX academy_entitlements_checkout_uq ON academy_entitlements (checkout_id);
CREATE INDEX academy_entitlements_membership_idx ON academy_entitlements (provider, provider_membership_id);
CREATE INDEX academy_entitlements_learner_idx ON academy_entitlements (learner_uid, state);

CREATE TABLE academy_payment_events (
  provider      text NOT NULL CHECK (provider IN ('whop')),
  event_id      text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 128),
  event_type    text NOT NULL CHECK (event_type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  resource_id   text NULL CHECK (resource_id IS NULL OR length(resource_id) <= 128),
  outcome       text NOT NULL CHECK (outcome IN ('granted', 'revoked', 'reinstated', 'recorded', 'ignored', 'held')),
  detail        text NULL CHECK (detail IS NULL OR length(detail) <= 500),
  received_at   timestamptz NOT NULL,
  -- A redelivered webhook carries the same delivery id: it is processed once.
  CONSTRAINT academy_payment_events_pk PRIMARY KEY (provider, event_id)
);

CREATE INDEX academy_payment_events_resource_idx ON academy_payment_events (provider, resource_id, received_at DESC);

CREATE TRIGGER academy_payment_events_no_update_delete
  BEFORE UPDATE OR DELETE ON academy_payment_events
  FOR EACH ROW EXECUTE FUNCTION academy_reject_mutation();

CREATE TRIGGER academy_payment_events_no_truncate
  BEFORE TRUNCATE ON academy_payment_events
  FOR EACH STATEMENT EXECUTE FUNCTION academy_reject_mutation();

COMMIT;
