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

## Re-audit, 2026-11-11 (same day, follow-up pass) — new concrete evidence

This pass re-verified the above from scratch (not reused blindly) and found two
additional, concrete pieces of evidence that strengthen the same conclusion:

- **`apps/api/prisma/migrations/migration_lock.toml` explicitly contains
  `provider = "sqlite"`.** This is Prisma's own enforcement mechanism — it means
  attempting to run `prisma migrate dev`/`deploy` with a `postgresql`-provider schema
  **against this same `migrations/` folder would be rejected by Prisma itself**
  (provider mismatch), independent of any decision made here. This is further,
  mechanical confirmation that fresh Postgres migrations must live in their own
  separate migration history, not be appended to or generated into the existing
  SQLite one.
- **Inspected a representative redefine-table migration in full**
  (`20261110194804_add_otp_attempt_tracking/migration.sql` — one of the 5 migration
  files, out of 11 total, that use this pattern). It is pure SQLite boilerplate:
  `PRAGMA defer_foreign_keys`/`foreign_keys` toggling, a full `CREATE TABLE new_X`,
  `INSERT INTO new_X SELECT ... FROM X`, `DROP TABLE X`, `ALTER TABLE new_X RENAME TO
  X`, done because SQLite cannot `ALTER TABLE ... ADD COLUMN` with certain
  constraints directly. The equivalent Postgres migration for this exact same schema
  change would be a single `ALTER TABLE "VerificationToken" ADD COLUMN "attempts"
  INTEGER NOT NULL DEFAULT 0;` statement — trivially simple, and further confirmation
  that hand-translating these 11 files would be pure wasted effort compared to
  generating fresh DDL directly against Postgres.
- **`apps/api/prisma/seed.ts` audited** (not covered in the first pass): uses only
  `prisma.user.upsert`, a standard provider-agnostic Prisma Client call. No SQLite-
  specific code. Confirmed safe as-is for either provider.

## Docker availability — re-checked, still unavailable; execution stopped per instruction

`docker --version` succeeds (29.8.2 installed) but `docker info` fails — **the Docker
daemon is not running on this development machine**, confirmed again (same result as
every previous check this entire engagement). Per explicit instruction or this task
("if Docker is unavailable, stop execution and provide exact manual testing
instructions instead"), **no disposable PostgreSQL container was started, no
migrations were generated, and no test was run against PostgreSQL in this pass.**
Steps 3–7 of the requested task (disposable Postgres container, generating/testing
migrations, running API tests against Postgres, verifying health/readiness against
Postgres) are **not done** — not attempted, not simulated, not assumed to pass.

## Manual testing instructions (run these yourself wherever Docker — or any Postgres — is actually available: the EC2 host, a machine with Docker Desktop running, or any throwaway Postgres instance)

```bash
# 1. Start a disposable, local-only Postgres container (no cloud cost, no RDS):
docker run --rm -d --name premal-pg-test \
  -e POSTGRES_USER=premal -e POSTGRES_PASSWORD=test -e POSTGRES_DB=premal_test \
  -p 5433:5432 postgres:16-alpine

# 2. From apps/api, generate a fresh migration history against it using the
#    prepared postgres-test schema (NOT the real schema.prisma - this never touches
#    the real SQLite migrations/ folder, since the postgres-test schema has no
#    migrations directory of its own yet; Prisma will create one):
cd apps/api
DATABASE_URL="postgresql://premal:test@localhost:5433/premal_test" \
  npx prisma migrate dev --schema=prisma/schema.postgres-test.prisma --name init

# 3. Review the generated SQL by hand (it will be under a new
#    prisma/postgres-migrations/ or similar - inspect exactly what `migrate dev`
#    created before trusting it) - look specifically for: every table present,
#    every index/unique constraint present, no unexpected default-value drift.

# 4. Re-apply from scratch to prove `migrate deploy` (the production-safe, non-
#    interactive command) works against a truly empty database too:
docker exec premal-pg-test psql -U premal -d premal_test -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
DATABASE_URL="postgresql://premal:test@localhost:5433/premal_test" \
  npx prisma migrate deploy --schema=prisma/schema.postgres-test.prisma

# 5. Generate the postgres-test Prisma Client and point a throwaway copy of the API
#    at it to confirm the app actually boots and its health endpoints pass against
#    real Postgres (NEVER point the real running app/.env at this - use a separate
#    shell/env):
DATABASE_URL="postgresql://premal:test@localhost:5433/premal_test" npx prisma generate --schema=prisma/schema.postgres-test.prisma
DATABASE_URL="postgresql://premal:test@localhost:5433/premal_test" pnpm run dev   # in a throwaway terminal, NOT the real dev session
curl http://localhost:3002/api/health
curl http://localhost:3002/api/health/ready

# 6. Run the existing test suite against this Postgres instance to see how many
#    pass unmodified (most are Prisma-mocked unit tests and will be unaffected;
#    any that directly exercise a real DB connection are the interesting ones):
DATABASE_URL="postgresql://premal:test@localhost:5433/premal_test" pnpm vitest run

# 7. Tear down - this was disposable, nothing here needs to persist:
docker stop premal-pg-test
```

**Never** run `prisma migrate reset` or `db push --force-reset` in any of the above —
`migrate dev`/`migrate deploy` only, exactly as used above. None of the commands above
touch `apps/api/prisma/dev.db`, the real `apps/api/prisma/migrations/` SQLite history,
or any `.env`/production configuration.

## Summary (updated)

| Item | Status |
|---|---|
| Schema audit | ✅ Done — minimal risk found, re-confirmed this pass |
| Migration-file audit | ✅ Done — `migration_lock.toml` provider-lock + a concrete redefine-table example now documented |
| Seed script audit | ✅ Done this pass — provider-agnostic, no changes needed |
| App code audit | ✅ Done — zero changes needed |
| Adapted schema prepared | ✅ Done (`schema.postgres-test.prisma`, refreshed) |
| Disposable Postgres container tested | ❌ **Not done — Docker daemon unavailable, execution stopped per instruction** |
| Fresh Postgres migrations generated | ❌ Not done — needs a real Postgres instance (manual instructions above) |
| API tests run against Postgres | ❌ Not done — same blocker |
| Health/readiness verified against Postgres | ❌ Not done — same blocker |
| RDS provisioned | ❌ Not done — needs your explicit approval, not attempted |
| Data migrated | ❌ Not done, and never will be — clean DB only, by design |
| SQLite `dev.db` / production `DATABASE_URL` / Razorpay mode | ✅ Untouched — confirmed, no production or billable system was connected to or modified |
