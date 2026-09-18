# Academy product migrations

These migrations build the academy product schema.

**Execution log.** 2026-09-17: 0001–0010 applied, in order, to the isolated
Neon test branch `ruh-e2e-test` only (authorised for end-to-end testing; no
real user data), after confirming the connection's Neon endpoint and that
every user and business table was empty. Result: 47 `academy_*` tables,
2 functions, 6 append-only triggers, 143 indexes; no foreign key between
academy and legacy tables. **They have not been applied to production or to
the historical source database.** The "NOT EXECUTED" header in each file
refers to those databases.

2026-09-19: 0011 (academy commerce: Whop offers, checkouts, entitlements and
the processed-webhook log) applied to the same test branch only, after
confirming its endpoint and that 0001–0010 were present (47 → 51 academy
tables). Not applied anywhere else.

Rules that every migration here follows, and that
`tests/academy/migrations.test.ts` enforces:

- Each forward migration `NNNN_name.up.sql` has a matching `NNNN_name.down.sql`.
- Both run inside a single transaction (`BEGIN; … COMMIT;`).
- The header states the purpose, impact, rollback strategy and execution status.
- Migrations are **strictly additive**: they create `academy_*` objects only and
  never alter, update, truncate or drop a pre-existing table. The single
  exception is adding a foreign key between two `academy_*` tables (for example
  linking policy values to programs once programs exist).
- No constraint references a legacy application table (`profiles`, `course`,
  `enrollments`, ...). Links to legacy rows are informational columns only.
- A rollback drops only objects its forward migration created, removing added
  foreign keys before any table.

## Applying

1. Apply to an authorised **non-production** database first, in numeric order.
2. Verify the application against it, then set `ACADEMY_CORE_SCHEMA_READY=true`
   for that environment. Until that flag is set, academy services return a
   clean "not available yet" response instead of touching missing tables.
3. Never apply these migrations to the historical source database.
