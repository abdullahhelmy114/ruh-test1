-- checks.sql — READ-ONLY checks for the account-table recovery.
--
-- Every statement is a SELECT. Nothing is created, changed or deleted, and no
-- email, name, uid or code is returned: counts and booleans only.
--
-- Run 1 and 2 BEFORE the recovery, and 3, 4 and 5 after it.

-- ---------------------------------------------------------------------------
-- 1. Are the account tables really missing, in every schema?
--    (A table hiding in another schema is a search_path problem, not data loss.)
-- ---------------------------------------------------------------------------
SELECT current_database() AS database,
       current_schema() AS active_schema,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_name IN ('profiles', 'verification_codes'))::int AS account_tables_in_any_schema,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name LIKE 'academy\_%')::int AS academy_tables,
       (SELECT count(*) FROM pg_extension WHERE extname = 'uuid-ossp')::int AS has_uuid_ossp;

-- ---------------------------------------------------------------------------
-- 2. Which academy records already name an account, and how many distinct
--    accounts do they name? Each of those uids needs a profile row afterwards.
-- ---------------------------------------------------------------------------
SELECT 'academy_enrollments' AS source, count(*)::int AS rows, count(DISTINCT learner_uid)::int AS distinct_uids FROM academy_enrollments
UNION ALL SELECT 'academy_class_group_teachers', count(*)::int, count(DISTINCT teacher_uid)::int FROM academy_class_group_teachers
UNION ALL SELECT 'academy_teacher_applications', count(*)::int, count(DISTINCT applicant_uid)::int FROM academy_teacher_applications
UNION ALL SELECT 'academy_checkouts', count(*)::int, count(DISTINCT learner_uid)::int FROM academy_checkouts
UNION ALL SELECT 'academy_entitlements', count(*)::int, count(DISTINCT learner_uid)::int FROM academy_entitlements
UNION ALL SELECT 'academy_audit_events', count(*)::int, count(DISTINCT actor_uid)::int FROM academy_audit_events
UNION ALL SELECT 'academy_messages', count(*)::int, count(DISTINCT sender_uid)::int FROM academy_messages
UNION ALL SELECT 'academy_notifications', count(*)::int, count(DISTINCT recipient_uid)::int FROM academy_notifications
UNION ALL SELECT 'academy_completions', count(*)::int, count(DISTINCT learner_uid)::int FROM academy_completions
UNION ALL SELECT 'academy_certificates', count(*)::int, count(DISTINCT learner_uid)::int FROM academy_certificates
ORDER BY 1;

-- ---------------------------------------------------------------------------
-- 3. AFTER the recovery: academy records naming an account with no profile row.
--
--    Read the "missing_accounts" column: it counts identities shaped like a
--    Firebase uid (28 characters), and every one of those must be 0, or those
--    learners and teachers cannot be resolved. "non_account_actors" counts
--    identities that are not accounts at all and are expected to have no
--    profile: the webhook actor 'system:whop', and setup-script actors.
-- ---------------------------------------------------------------------------
WITH named AS (
  SELECT DISTINCT learner_uid AS uid, 'enrollment' AS kind FROM academy_enrollments
  UNION SELECT DISTINCT teacher_uid, 'class group teacher' FROM academy_class_group_teachers
  UNION SELECT DISTINCT applicant_uid, 'teacher application' FROM academy_teacher_applications
  UNION SELECT DISTINCT learner_uid, 'checkout' FROM academy_checkouts
  UNION SELECT DISTINCT learner_uid, 'entitlement' FROM academy_entitlements
  UNION SELECT DISTINCT actor_uid, 'audit event' FROM academy_audit_events
  UNION SELECT DISTINCT recipient_uid, 'notification' FROM academy_notifications
)
SELECT kind,
       count(*) FILTER (WHERE uid ~ '^[A-Za-z0-9]{28}$')::int AS missing_accounts,
       count(*) FILTER (WHERE uid !~ '^[A-Za-z0-9]{28}$')::int AS non_account_actors
FROM named
WHERE uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.firebase_uid = named.uid)
GROUP BY kind ORDER BY kind;

-- ---------------------------------------------------------------------------
-- 4. AFTER the recovery: the tables match the verified definitions.
--    Expect profiles = 33 columns, verification_codes = 5, and all 4 constraints.
-- ---------------------------------------------------------------------------
SELECT (SELECT count(*)::int FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles') AS profiles_columns,
       (SELECT count(*)::int FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'verification_codes') AS verification_codes_columns,
       (SELECT count(*)::int FROM pg_constraint
         WHERE conrelid = 'public.profiles'::regclass
           AND conname IN ('profiles_pkey', 'profiles_email_key', 'profiles_firebase_uid_key', 'profiles_role_check')) AS profiles_constraints,
       (SELECT count(*)::int FROM pg_constraint
         WHERE conrelid = 'public.verification_codes'::regclass AND conname = 'verification_codes_pkey') AS code_constraints,
       pg_get_expr(adbin, adrelid) AS profiles_id_default
  FROM pg_attrdef
 WHERE adrelid = 'public.profiles'::regclass
   AND adnum = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'id');

-- ---------------------------------------------------------------------------
-- 5. AFTER the recovery: who holds which role. Counts only.
--    Before the first administrator is established this returns no rows.
-- ---------------------------------------------------------------------------
SELECT role, status, COALESCE(email_verified, false) AS email_verified, count(*)::int AS accounts
  FROM profiles GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
