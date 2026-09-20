-- 0001_account_tables.up.sql
--
-- PURPOSE
--   Recreate the two account tables that are missing from the database the
--   deployment now runs on: public.profiles and public.verification_codes.
--   Every signed-in path reads profiles (src/lib/auth/index.ts resolves the
--   caller's role and status from it), and the sign-up and email-verification
--   routes read and write verification_codes. While profiles is absent, the
--   sign-in exchange POST /api/auth/session answers 401 to everyone and no
--   account can be created.
--
-- SOURCE OF THE DEFINITIONS (verified, not invented)
--   The definitions below are the ones the application has always run on,
--   reconstructed from two independent records that agree column for column:
--     1. the live schema snapshot taken 2026-09-16 from the database in use
--        at that time (profiles: 33 columns; verification_codes: 5 columns);
--     2. the catalog of the isolated test branch, read on 2026-09-20.
--   The repository never held these definitions: src/lib/db/schema.sql has an
--   8-column profiles and no verification_codes at all, and no migration ever
--   created or altered either table. Nothing here is simplified or guessed.
--
-- SAFETY
--   Schema only. It creates two tables and nothing else: no row is inserted,
--   no existing object is altered or dropped, and no academy_* object is
--   touched. It carries no account data: the 8 accounts in the old database
--   are test-only and are deliberately NOT copied, and expired verification
--   codes are NOT copied. It is idempotent (IF NOT EXISTS) and runs in one
--   transaction. Administrator access is NOT granted here; see README.md.
--
-- IMPACT
--   After this runs, sign-in works for any account that has a profile row.
--   The database will have no profile rows, so the first administrator must be
--   established by the separate, approved step in README.md.
--
-- EXECUTION STATUS
--   NOT EXECUTED against any database. Rehearsed on 2026-09-20 in a temporary
--   schema of the isolated test branch (created, verified and dropped again).
--   Rollback: 0001_account_tables.down.sql.

BEGIN;

-- profiles.id defaults to uuid_generate_v4(), which this extension provides.
-- The test branch has it; a database without it would reject every insert.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles: one row per account, keyed by the Firebase uid.
-- role and status decide privileges (src/lib/auth/core.ts).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  firebase_uid text NOT NULL,
  email text NOT NULL,
  full_name text,
  role text DEFAULT 'student'::text,
  plan text DEFAULT 'free'::text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  certification_progress integer DEFAULT 0,
  teacher_uid text,
  referral_code text,
  referral_count integer DEFAULT 0,
  credits numeric DEFAULT 0,
  email_verified boolean DEFAULT false,
  profile_completed boolean DEFAULT false,
  bio text,
  country text,
  interests text,
  referred_by text,
  fcm_token text,
  whatsapp text,
  telegram text,
  social_links jsonb DEFAULT '{}'::jsonb,
  cv_url text,
  intro_video_url text,
  languages text,
  nationality text,
  gender text,
  age integer,
  country_of_residence text,
  is_verified boolean DEFAULT false,
  referral_discount_used boolean DEFAULT false,
  referral_credits numeric DEFAULT 0,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_email_key UNIQUE (email),
  CONSTRAINT profiles_firebase_uid_key UNIQUE (firebase_uid),
  CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'teacher'::text, 'student'::text])))
);

-- ---------------------------------------------------------------------------
-- verification_codes: the live email code for an account, one row at a time.
-- The routes delete the account's row before inserting the next one, so the
-- original has no unique key on user_uid; this keeps that behaviour exactly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id serial NOT NULL,
  user_uid text NOT NULL,
  email_code text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verification_codes_pkey PRIMARY KEY (id)
);

COMMIT;
