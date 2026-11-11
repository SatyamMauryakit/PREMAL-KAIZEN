# PREMAL KAIZEN — Sample Data Cleanup & Production Reset Report

Date: 2026-11-11
Scope: `apps/api/prisma/dev.db` (the application's only database — SQLite, no separate Postgres instance exists or was created; see "Database decision" below).

## Database decision: stayed on SQLite

The cleanup master prompt requested a fresh PostgreSQL production database. This was
**not done**, deliberately, after confirming with the requester: the deployment target
chosen immediately beforehand is the existing single-EC2/`kind` setup in `deploy/`,
which runs SQLite with `replicas: 1` by design (no multi-writer scenario to support).
Migrating to Postgres now would mean provisioning RDS, rewriting the Prisma migration
history (the tracked migrations are provider-locked to `sqlite` in `migration_lock.toml`
— not portable to Postgres as-is), and reworking the k8s manifests, for a concurrency
benefit this deployment doesn't need yet. A `schema.postgres-test.prisma` variant
already exists in the repo as groundwork if/when a real multi-replica migration is
undertaken later.

## Backup taken before any destructive action

`backups/dev.db.pre-cleanup.20261111_181605.bak` — a full, untouched copy of the
database exactly as it stood before any deletion. DATABASE_URL was confirmed to point
at the local dev file (`file:./dev.db`) before proceeding — no external/production
database was ever in scope.

## Products and categories were NOT blanket-deleted — a deliberate deviation

The master prompt asked to remove "all sample products." Inspection showed the
database actually contains two very different populations mixed together:

- **2 confirmed test artifacts**: "Huddy" (SKU `M`, ₹5,000, already disabled) and
  "Lebrador" (SKU `EHH-001`, ₹300, already disabled) — clearly one-off entries from
  testing the admin product-creation form.
- **49 real, structured products** across all 13 categories (Hoodies, T-Shirts,
  Sweatshirts, Jackets, Pants, Jeans, Shorts, Shirts, Polo T-Shirts, Activewear,
  Co-ord Sets, Knitwear, Accessories), each following a consistent SKU scheme
  (`PK-HOD-001`, `PK-TSH-006`, ...) with real images, pricing and variants.

This was flagged to and confirmed by the requester before proceeding. Only the 2 test
entries (and their product images — 7 rows) were deleted. The 49 real products, all 13
categories, 242 product images, and 545 inventory rows were preserved untouched.

`StoreSettings` (the singleton business-configuration row — store name, email, GSTIN,
shipping methods, tax rate) was also preserved as permanent business configuration, not
sample data.

## Records deleted, by table

All counts are from the actual cleanup transaction run against `dev.db`:

| Table | Rows deleted | Notes |
|---|---:|---|
| `User` | 15 | All customer + the 1 admin account |
| `Session` | 84 | |
| `VerificationToken` | 36 | OTP / email-verification / password-reset rows |
| `Address` | 35 | |
| `Order` | 28 | |
| `OrderItem` | 33 | |
| `Invoice` | 18 | |
| `NotificationEvent` | 53 | Not a formal Prisma relation on Order — explicitly deleted to avoid orphans |
| `OrderStatusEvent` | 25 | Same — explicitly deleted |
| `CartItem` | 6 | |
| `WishlistItem` | 0 | |
| `Review` | 3 | |
| `CouponCode` | 1 | |
| `CouponRedemption` | 0 | |
| `Promotion` | 1 | |
| `PaymentWebhookEvent` | 0 | |
| `SettingsAuditLog` | 18 | |
| `AdminAuditLog` | 8 | |
| `ContactMessage` | 6 | |
| `ProductImage` (test products only) | 7 | Scoped to the 2 removed test products |
| `Inventory` / `InventoryAdjustment` / `InventoryAuditLog` (test products only) | 0 each | The 2 test products never had stock rows |
| `Product` | 2 | "Huddy" and "Lebrador" only |

**Admin accounts removed: 1** (the single existing admin, `premal.kaizen@gmail.com`).
Zero admin accounts now exist.

## Preserved (not touched)

- 49 real products, 13 categories, 242 product images, 545 inventory rows.
- `StoreSettings` singleton row (store name/email/GSTIN/shipping/tax config).
- All Prisma schema, indexes, and the full migration history — nothing in
  `apps/api/prisma/migrations/` was touched.
- Source code, Dockerfiles, `deploy/` scripts and manifests, `.env.example` (already
  placeholder-only before this cleanup — verified, not edited).

## Fresh admin bootstrap — reused the existing mechanism, built nothing new

`IdentityService.bootstrapFirstAdmin` (`apps/api/src/identity/identity.service.ts`) and
its public route `POST /api/auth/admin/bootstrap` already satisfy every Phase 4
requirement and were reused as-is, per the master prompt's own instruction to reuse an
existing mechanism rather than build a new one:

- Self-disables permanently the moment any admin account exists
  (`ConflictException` if `adminExists()` is true) — confirmed safe to leave on a public
  route because of this.
- Passwords are bcrypt-hashed via the same `createUser` path every account uses; no
  hardcoded credentials anywhere in code.
- Minimum 8-character password enforced (baseline — not complexity-enforced; consider
  tightening before go-live if you want more than a length check).
- Admin accounts intentionally bypass the mandatory login-OTP step (documented
  elsewhere in the codebase) since the admin app has no OTP-entry UI — this is
  existing, deliberate behavior, not something this cleanup changed.
- A real UI already exists at `apps/admin/app/auth/signup` which calls this exact
  endpoint — confirmed reachable (`GET /auth/signup` → 200) with zero admins currently
  in the database, i.e. it is live and ready to use right now.

**Action required from you**: since this endpoint is unauthenticated by design (anyone
reaching it first becomes the Super Admin), bootstrap your real admin account
**immediately** after this database is deployed to production — don't leave it sitting
open. Choose your own strong password; nothing was created on your behalf.

## Automated test results

Ran after cleanup (unaffected by the data wipe — these are unit tests against a mocked
Prisma client, not the real file):

- `apps/api`: **315/315 passed**, 34 test files.
- `apps/storefront`: **58/58 passed**.
- `apps/admin`: **13/13 passed**.

## Production build results

| App | `pnpm run build` |
|---|---|
| `apps/api` (`nest build`) | ✅ exit 0 |
| `apps/storefront` (`next build`) | ✅ exit 0 |
| `apps/admin` (`next build`) | ✅ exit 0 |

**Docker image builds**: not performed — the local Docker CLI is installed but the
Docker daemon is not running on this machine. Deferred to the actual EC2 deployment,
where `deploy.sh` builds these exact three images from the same Dockerfiles as its
first step — this will be verified live at that time rather than redundantly here.

## Live verification after cleanup

Restarted all three dev servers against the cleaned database and confirmed:

| Check | Result |
|---|---|
| `GET /api/products` | 200, returns the 49 real products |
| `GET /` (storefront) | 200 |
| `GET /shop` (storefront) | 200 |
| `GET /auth/signup` (admin, bootstrap UI) | 200 |
| `GET /auth/login` (admin) | 200 |
| `GET /api/auth/me` with no token | 401 (correct) |

Note: the dev servers crashed twice mid-verification with stale/corrupted `dist`/`.next`
output — a known, previously-documented gotcha in this project (running a production
`build` in the same directory a `--watch` dev server is using corrupts its output
mid-recompile). Not a regression from the cleanup itself; fixed each time by killing the
stale processes, clearing `dist`/`.next`, and restarting. Worth remembering: never run
`pnpm run build` in the same app directory as a running `pnpm run dev`.

## Code / asset cleanup (Phases 5–6)

Not performed in this pass. The master prompt's own rules require verifying every
reference (including dynamic ones) before removing any asset or code, and require not
removing working features — doing this safely needs a dedicated pass of its own rather
than being bundled into a database reset. Recommend treating this as separate,
lower-urgency follow-up work; nothing here blocks production readiness.

## Remaining items before going live

1. **Bootstrap your real admin account now** (see above) — the window is open.
2. Decide on and set **live** Razorpay keys (currently test-mode keys in `.env`) before
   accepting real payments.
3. TLS/HTTPS and a real domain — still out of scope per `deploy/README.md`, needed
   before launch.
4. Docker image builds — will happen naturally as the first step of `deploy.sh` on the
   EC2 host; not separately verified here.
5. Phases 5–6 (file/code cleanup) — deferred, not performed.
