# Account table recovery

The database the deployment runs on has the academy schema (migrations
0001–0011) but neither account table. While `profiles` is missing, the sign-in
exchange `POST /api/auth/session` answers **401 to everyone** (it reads
`profiles` and turns any error into 401), and no account can be created.
`verification_codes` is needed for sign-up and email verification.

`0001_account_tables.up.sql` recreates both, schema only.

## Where the definitions come from

Two independent records agree column for column, and the script uses them
exactly:

1. the live schema snapshot taken **2026-09-16** from the database in use then
   (`profiles`: 33 columns, `verification_codes`: 5 columns);
2. the catalog of the isolated test branch, read **2026-09-20**.

The repository never held them: `src/lib/db/schema.sql` has an 8-column
`profiles` and no `verification_codes`, and no migration ever created or
altered either table. `tests/auth/account-tables.test.ts` pins the script to
those definitions.

They are **not** academy migrations: `db/migrations` is strictly additive and
`academy_*` only, enforced by `tests/academy/migrations.test.ts`. That is why
this lives in `db/recovery`.

## What is deliberately not here

- **No account data.** The 8 accounts in the old database are test-only, and
  the owner confirmed they need not be preserved. None is copied.
- **No verification codes.** They expire in minutes; copying expired rows would
  be noise. The verification state that matters lives in `profiles`
  (`email_verified`, `is_verified`, `status`).
- **No administrator.** No role is granted, here or anywhere in the code.

## Running it (each step needs the owner's recorded approval)

1. **Check first, read-only.** Run sections 1 and 2 of `checks.sql` against the
   target database. Section 1 confirms both tables really are missing in every
   schema (a table hiding in another schema is a `search_path` problem, not
   data loss) and whether `uuid-ossp` is installed. Section 2 lists the academy
   records that already name an account.
2. **Back up.** Take a Neon branch or snapshot of the target database and
   record its name here. That branch is the rollback of last resort.
3. **Approve.** Record the owner's explicit approval, with the date, below.
4. **Apply** `0001_account_tables.up.sql` once, in one transaction.
5. **Verify.** Run sections 3, 4 and 5 of `checks.sql`. Section 4 must report
   33 columns, 5 columns, 4 constraints, 1 constraint and the
   `uuid_generate_v4()` default. Section 3 must report no unresolved account
   for any kind of academy record.
6. **Establish the first administrator** by the step below, then re-run
   section 5.

## The first administrator

No code path grants the administrator role. Sign-up creates `student` (status
`pending`) or, for a teacher application, `teacher` (status `pending`), and the
self-profile update cannot change `role`. `tests/auth/account-tables.test.ts`
keeps it that way.

So the first administrator is established **once, by hand, with the owner's
approval**, against a Firebase account that already exists in the project the
deployment authenticates with (currently `ruhulqudus-test`):

1. The owner signs up normally in the deployed site, or creates the user in the
   Firebase console. This gives the account a Firebase uid.
2. The owner reads that uid from the Firebase console (Authentication → Users).
3. With the uid, and only after approval, run **one** statement:

   ```sql
   -- Replace <FIREBASE_UID> and <EMAIL> with the intended administrator's own values.
   INSERT INTO public.profiles (firebase_uid, email, full_name, role, status, email_verified)
   VALUES ('<FIREBASE_UID>', '<EMAIL>', '<NAME>', 'admin', 'active', true)
   ON CONFLICT (firebase_uid) DO UPDATE
      SET role = 'admin', status = 'active', email_verified = true;
   ```

4. Confirm with section 5 of `checks.sql`: exactly one `admin`, status
   `active`.

A uid from any other Firebase project is meaningless here: uids are minted per
project, and a profile keyed to a foreign uid matches nobody.

## Rollback

`0001_account_tables.down.sql` drops the two tables and nothing else. It
refuses to run once either table holds a row, so it cannot quietly destroy
accounts; empty them deliberately first, or restore the backup branch from
step 2.

## Execution log

- **2026-09-20 — rehearsed, not applied.** Run in a temporary schema of the
  isolated test branch with synthetic identities only: 16 of 16 checks passed
  (shape, column order, constraints, defaults, duplicate uid and email refused,
  unknown role refused, the delete-then-insert code flow, the orphan check, the
  rollback refusing while rows existed and succeeding once empty). The schema
  was dropped afterwards and the branch's own tables were untouched.
- **NOT APPLIED to the deployment's database.** No backup recorded, no approval
  recorded.

| Step | Date | Approved by | Note |
| --- | --- | --- | --- |
| Backup branch taken |  |  |  |
| Apply approved |  |  |  |
| Applied |  |  |  |
| First administrator approved |  |  |  |
