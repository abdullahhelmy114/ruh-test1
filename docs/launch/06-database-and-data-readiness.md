# 06 — Database and data readiness

Revision under review: **8908c57** (local) on top of **1de8fa2** (deployed). Prepared 2026-09-21.
No production database was read or written while preparing this report.

Legend: **FACT** read from the repository; **VERIFIED OBSERVATION** measured; **INFERENCE** reasoned;
**PROPOSAL / PENDING APPROVAL** needs Dr. Jihan or Abdullah.

## 1. What the deployment expects

**FACT** — the schema the code assumes is exactly:

- the **51 `academy_*` tables** created by `db/migrations/0001..0011` (counted from the migration
  files themselves, not a copied list);
- **`public.profiles`** — 33 columns, primary key `id`, unique `email`, unique `firebase_uid`, a role
  check constraint of `admin|teacher|student`, and `id` defaulting to `uuid_generate_v4()` (so the
  `uuid-ossp` extension must exist);
- **`public.verification_codes`** — 5 columns, `id serial` primary key, and deliberately **no** unique
  key on `user_uid`, because the routes delete the account's row before inserting the next code.

Everything else from the old 78-table schema is absent, and the launch path no longer needs it.
`db/recovery/` holds the verified definitions, a guarded rollback, and read-only checks; its README
records where the definitions came from and the approval gates.

## 2. Reported state versus verified state

| Claim | Source | Status |
| --- | --- | --- |
| 51 `academy_*` tables in production | reported by the engineer | **UNVERIFIED from here** — no production credential exists on this machine |
| `profiles` restored | reported | **VERIFIED OBSERVATION (indirect)** — `/api/teacher/public/<unknown-uid>` answers 404, so the query ran |
| `verification_codes` restored | reported | **UNVERIFIED** — no public route reads it without side effects |
| Test profiles inserted | reported | **UNVERIFIED** |
| Administrator activated | reported | **UNVERIFIED**, and **contradicted in the isolated test branch**, where the only admin row is `status = pending` |

**This is the single most important verification gap in the whole launch.** It is closed by one
read-only command, run by Abdullah against the production branch:

```
node scripts/launch-readiness-check.mjs
```

It prints counts, names and booleans only — never a secret, an address, a uid or a row of account
data — and it names the endpoint it inspected so the target can be confirmed before the result is
trusted. It exits non-zero if any gate fails.

**VERIFIED OBSERVATION** — run against the isolated test branch (`ep-flat-bird-aqs91ul8`) on
2026-09-21 it reported **25 passed, 2 warnings, 1 failure**: 51 tables present, both account tables
with the expected column counts, `uuid-ossp` installed, all 12 policies set, content present
(4 programs, 2 courses, 3 curriculum versions, 3 class groups, 6 sessions, 2 offers, 3 teacher
assignments) — and **no active administrator**, because that branch's admin row is `pending`.

## 3. Policies — the prerequisite that outlives the feature flag

**FACT** — `src/lib/academy/policies/registry.ts` defines **12** policies and **none has a default**;
no migration seeds `academy_policy_values`. A service that needs an unset policy fails closed with
`POLICY_UNCONFIGURED` ("This academy setting has not been configured yet.",
`src/lib/academy/policies/resolver.ts:158`).

**Correction to the previous audit:** report `docs/audits/2026-09-21-unavailable-features.md` says
13 policies. The authoritative count, taken from the module itself, is **12**. The audit's conclusion
is unchanged; only the number was wrong.

`institution.timezone` is the one to set first: it decides the local calendar week that the Lesson
Sheet release rule is measured in. Without it, lesson sheets stay unavailable even with the academy
flag on. The full catalogue, with proposed initial values and who must approve each, is report 11.

## 4. Seed and reference data

**FACT** — the repository contains no seed for academy content, and none should be invented: programs,
courses, curriculum versions, class groups, sessions and lesson sheets are academic content and
belong to Dr. Jihan's approval chain. The minimum set a controlled launch needs is listed in
report 11 as a prerequisite checklist, not as data to create.

`scripts/seed-database.js` seeds only the legacy `words` table and is **not** part of the launch path.

## 5. Approved migrations, and what is not approved

- **Approved and applied:** `db/migrations/0001..0011` (academy). `tests/academy/migrations.test.ts`
  keeps them strictly additive and `academy_*`-only.
- **Prepared, not applied:** `db/recovery/0001_account_tables.{up,down}.sql`. If the engineer has
  already created the two tables by hand, run section 4 of `db/recovery/checks.sql` to confirm the
  live shape matches the verified definitions (33 columns, 5 columns, 4 constraints, 1 constraint,
  the `uuid_generate_v4()` default) and record the result.
- **Not approved, and not designed here:** any table for the legacy library, dictionary, Quran corpora
  or waitlist. Those need an evidence-based recovery plan with provenance, counts and rollback — see
  report 15. **No guessed table may be created.**

## 6. Backup and rollback

**PROPOSAL / PENDING APPROVAL** — before any schema or data change in production:

1. Take a Neon branch or snapshot of the production branch and record its name and timestamp in
   report 13. That branch is the rollback of last resort.
2. Apply exactly one change.
3. Re-run `scripts/launch-readiness-check.mjs` and record the output.
4. If anything regresses, restore the recorded branch.

`db/recovery/0001_account_tables.down.sql` drops only the two tables it created and **refuses while
either holds a row**, so it cannot quietly destroy accounts.

## 7. Connection and runtime checks

- Confirm the endpoint id the application uses matches the intended production branch: the readiness
  check prints it, and no connection string is ever displayed.
- Confirm the pooled endpoint is used for the application.
- **Do not** point a local test run at the production branch. Local runs in this work used the
  isolated test branch only, and the readiness script refuses nothing by itself — the operator must
  read the endpoint line it prints.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
