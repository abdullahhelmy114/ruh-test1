# Academy product migrations

These migrations build the academy product schema. **None of them has been
executed against any database.**

Rules that every migration here follows, and that
`tests/academy/migrations.test.ts` enforces:

- Each forward migration `NNNN_name.up.sql` has a matching `NNNN_name.down.sql`.
- Both run inside a single transaction (`BEGIN; … COMMIT;`).
- The header states the purpose, impact, rollback strategy and execution status.
- Migrations are **strictly additive**: they create `academy_*` objects only and
  never alter, update, truncate or drop a pre-existing table.
- A rollback drops only objects its forward migration created.

## Applying

1. Apply to an authorised **non-production** database first, in numeric order.
2. Verify the application against it, then set `ACADEMY_CORE_SCHEMA_READY=true`
   for that environment. Until that flag is set, academy services return a
   clean "not available yet" response instead of touching missing tables.
3. Never apply these migrations to the historical source database.
