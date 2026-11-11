# DATABASE_MIGRATION_REPORT.md — SQLite → PostgreSQL

Date: 2026-11-11. **This is a plan and a prepared-for-review schema only. No RDS
instance was created, no AWS resource was touched, no migration was executed, and the
active `apps/api/prisma/schema.prisma` was NOT changed** — per explicit instruction,
all of that requires your separate approval.

## 1–4. Audit results

- **All Prisma models audited** (27 models, full list in `docs/production/DATABASE-READINESS.md`
  from the prior hardening pass — unchanged since). Every id is `@default(cuid())` — a
  portable string, not an auto-increment integer tied to either engine.
- **No `@db.*` native-type annotations exist anywhere in the schema** (confirmed by
  grep — zero matches). This means every field already uses Prisma's own
  provider-agnostic defaults (`String`→`TEXT`, `Int`→`INTEGER`, `Float`→`DOUBLE
  PRECISION`, `Boolean`→`BOOLEAN`, `DateTime`→`TIMESTAMP`), which Prisma maps
  correctly for either SQLite or PostgreSQL without any schema change.
- **No `Json` or `Decimal` fields exist.** Two groups of fields are deliberately
  JSON-encoded as plain `String` with an explicit in-schema comment explaining why
  ("SQLite has no native array/json type"): `Product.colors`/`sizes` and
  `Promotion.eligibleProductIds`/`eligibleCategoryIds`/`excludedProductIds`/
  `excludedCategoryIds`, plus `StoreSettings.shippingMethods`. These work completely
  unchanged as `TEXT` columns in Postgres too — the application already does its own
  `JSON.parse`/`JSON.stringify` around them, so this is a safe no-op for migration
  purposes. **Optional future improvement, not required**: these could become native
  Postgres `jsonb` columns later for queryability, but that's an application-code
  change (removing the manual parse/stringify), not something migration itself needs.
- **Only one raw SQL statement in the entire application**:
  `apps/api/src/health/health.controller.ts`'s `$queryRaw\`SELECT 1\`` — valid,
  identical syntax on both engines. No other `$queryRaw`/`$executeRaw` call exists
  anywhere in `apps/api/src` (confirmed by grep).
- **Migration files**: 11 tracked SQLite migrations under
  `apps/api/prisma/migrations/`, all using SQLite's "redefine table" pattern for
  anything beyond a plain additive column (SQLite's `ALTER TABLE` is limited compared
  to Postgres's). These are **SQLite-dialect SQL and not meant to be hand-translated**
  — see the plan below for why a clean Postgres database should get a freshly
  generated migration history instead.

## 5. Complete migration plan

1. **Do not hand-translate the 11 SQLite migration files.** For a genuinely clean
   production database (which you've explicitly asked for — no sample data, no
   history baggage), the correct approach is to generate **one fresh Postgres
   migration** directly from the current schema against an empty Postgres instance,
   using `prisma migrate dev --name init` (or `migrate deploy` against a pre-created
   empty DB with `migrate diff` + `migrate resolve` if you want to establish baseline
   history differently). This produces real Postgres `CREATE TABLE` DDL in Postgres's
   own dialect, not an awkward translation of SQLite's redefine-table SQL.
2. **A real (even temporary/throwaway) PostgreSQL instance is required to generate
   that migration** — Prisma needs to actually connect to a Postgres server to
   synthesize correct DDL. This was **not possible in this pass**: no Postgres server
   is running in this environment, and the local Docker daemon is also unavailable
   (confirmed earlier this engagement) so even a scratch `docker run postgres`
   instance couldn't be spun up to test against. **This step remains outstanding and
   requires either a local Postgres install, a Dockerized one once Docker is
   available, or (with your explicit approval) a real RDS instance.**
3. Once migrations are generated against a scratch instance, review the generated SQL
   by hand before ever applying it anywhere real (same idempotent-migration-Job
   pattern already built for SQLite in Issue B applies equally well to Postgres — the
   Job's `prisma migrate deploy` command doesn't change, only `DATABASE_URL`'s
   provider does).
4. **Never copy `dev.db`'s data into Postgres.** Production starts from the fresh
   migration applied to an empty database, then the existing self-disabling
   `/api/auth/admin/bootstrap` endpoint creates the one real admin account — exactly
   the same controlled process already used for the SQLite path (see
   `docs/production/CLEANUP-REPORT.md` from the prior sample-data cleanup for how this
   already works in practice).
5. **Application code changes needed: none identified.** Every database operation
   goes through Prisma's query builder; the engine swap is transparent to all service
   code. This was verified by the zero-raw-SQL finding above, not assumed.
6. **Infrastructure changes needed** (not done, require your approval): provision an
   RDS PostgreSQL instance in a private subnet (never publicly accessible — see
   `PRODUCTION_SECURITY_CHECKLIST.md`), update `DATABASE_URL` in the Secret (not the
   ConfigMap — a Postgres connection string contains credentials, unlike the current
   SQLite file path), and remove the SQLite-specific `PersistentVolume`/
   `PersistentVolumeClaim`/mounts from the API Deployment once RDS is live (the
   `replicas: 1` constraint on the API Deployment is **only** there because of
   SQLite's single-writer limitation — once on RDS, this constraint can genuinely be
   lifted if you want multiple API replicas for availability).

## 6–7. Schema adaptation and migration generation — status

- **`apps/api/prisma/schema.postgres-test.prisma`** — refreshed this pass (was 9 days
  stale, missing every model added since: reviews, RBAC, invoices, notifications,
  SMS, OTP-attempt-tracking, phone verification, product soft-delete). Now matches
  the current `schema.prisma` exactly except for two lines: `datasource.provider =
  "postgresql"` and an isolated `generator.output` path (required — generating a
  client from this file without an isolated output would overwrite the real app's
  shared Prisma client, which the top-of-file comment in `schema.prisma` notes already
  happened once during an earlier migration test and briefly broke the running dev
  server). This file is gitignored and not used by the running app.
- **Fresh Postgres migration SQL**: **not generated** — blocked on needing a real
  Postgres instance to generate against (see point 2 above). This is the single
  concrete next step whenever you're ready to continue this migration.

## 8. Query/operation verification

Not independently re-run against Postgres (no instance available), but every current
service method was already confirmed to use only standard Prisma Client calls
(`findUnique`, `findMany`, `create`, `update`, `updateMany`, `deleteMany`,
`$transaction`) — none of which differ in behavior or syntax between the SQLite and
PostgreSQL Prisma providers. The one place this is worth a real double-check once a
Postgres instance exists: `$transaction` behavior under concurrent load differs
meaningfully between SQLite (effectively single-writer, serialized) and Postgres (real
MVCC, concurrent writers) — the order-creation transaction
(`OrdersService.create`, stock-decrement + cart-clear) was written assuming SQLite's
serialization; it should still be correct under Postgres's stronger concurrency
guarantees, but this is exactly the kind of thing worth a dedicated concurrent-order
load test once RDS is real, not something provable by reading code alone.

## Summary

| Item | Status |
|---|---|
| Schema audit | ✅ Done — minimal risk found |
| Migration-file audit | ✅ Done — plan is "regenerate fresh," not "translate" |
| App code audit | ✅ Done — zero changes needed |
| Adapted schema prepared | ✅ Done (`schema.postgres-test.prisma`, refreshed) |
| Fresh Postgres migrations generated | ❌ Not done — needs a real Postgres instance |
| RDS provisioned | ❌ Not done — needs your explicit approval |
| Data migrated | ❌ Not done, and never will be — clean DB only, by design |
| SQLite `dev.db` preserved | ✅ Untouched, plus the pre-cleanup backup from the prior session |
