-- 0001_account_tables.down.sql
--
-- Rollback for 0001_account_tables.up.sql: drops the two tables it created,
-- and nothing else.
--
-- It refuses to run once either table holds a row, because by then the tables
-- hold real accounts and dropping them would destroy them. Empty the tables
-- deliberately first, or restore the pre-change Neon branch instead.
--
-- EXECUTION STATUS
--   NOT EXECUTED against any database. Rehearsed on 2026-09-20 in a temporary
--   schema of the isolated test branch: it refused while synthetic rows were
--   present, and dropped both tables once they were removed.

BEGIN;

DO $$
DECLARE
  profile_rows bigint := 0;
  code_rows bigint := 0;
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.profiles' INTO profile_rows;
  END IF;
  IF to_regclass('public.verification_codes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.verification_codes' INTO code_rows;
  END IF;
  IF profile_rows > 0 OR code_rows > 0 THEN
    RAISE EXCEPTION 'Refusing to roll back: profiles has % row(s) and verification_codes has % row(s). Dropping them would destroy accounts.', profile_rows, code_rows;
  END IF;
END
$$;

DROP TABLE IF EXISTS public.verification_codes;
DROP TABLE IF EXISTS public.profiles;

COMMIT;
