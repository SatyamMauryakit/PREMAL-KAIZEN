# CODE-AUDIT.md — PREMAL KAIZEN Repository Audit

Date: 2026-11-11. Scope: full monorepo (`apps/storefront`, `apps/admin`, `apps/api`), targeting the **existing single-EC2 deployment architecture** (`deploy/` — Docker + `kind` + k8s manifests, SQLite), not a 3-EC2/RDS/ALB architecture. That distinction was confirmed explicitly before this audit began — see `GITHUB-RELEASE-SUMMARY.md` for the full note on why.

## 1. Applications and packages

- `apps/storefront` — Next.js 15.5.29 / React 19 customer site.
- `apps/admin` — Next.js 15.5.29 / React 19 admin panel.
- `apps/api` — NestJS 10 + Prisma 5, SQLite provider (`apps/api/prisma/schema.prisma`).
- No `packages/ui` or `packages/types` exist in this repo — the prompt's assumed architecture names them, but this monorepo only has the 3 `apps/*` workspaces (confirmed via `pnpm-workspace.yaml` and the actual directory tree). Shared code lives inline in each app rather than a shared package; not a blocker, just noted so nobody looks for packages that don't exist.

## 2. Dockerfiles — already production-grade

All three (`apps/api/Dockerfile`, `apps/storefront/Dockerfile`, `apps/admin/Dockerfile`) were inspected directly this pass. All three:
multi-stage, frozen-lockfile installs, fixed non-root UID/GID (10001:10001) consistent across all three, real `HEALTHCHECK` directives hitting actual endpoints (API: `/api/health`; frontends: `/`, admin accounts for its 307-redirect-when-signed-out), `NODE_ENV=production`. See `DOCKER-READINESS.md` for detail. No changes needed.

## 3. Deployment scripts

`deploy/deploy.sh` (514 lines) + `deploy/k8s/*.yaml` + `deploy/kind-config.yaml` — a mature, already-tested single-EC2 deployment (installs Docker/kind/kubectl, builds the 3 images, applies manifests, prints exact security-group rules). This is the deployment this audit targets. A separate `deploy/production/` tree with per-service Compose files, Nginx configs and a `rollback.sh` (as the newest mega-prompt's Phase 5 describes) does **not** exist and was **not** created — that structure belongs to the 3-EC2 architecture that was explicitly declined. See `EC2-DEPLOYMENT.md` and `ROLLBACK.md` for what exists today and what's genuinely missing.

## 4. CI/CD

**No `.github/workflows/` directory exists.** There is no automated CI pipeline — tests, typecheck, lint, and builds have all been run manually (by this audit and prior sessions), never automatically on push/PR. This is a real gap if the repo is going to accept outside contributions or you want a safety net before merging, but it isn't a blocker for a manual, approval-gated deployment process.

## 5. Environment configuration

- `apps/api/.env.example` is genuinely placeholder-only (re-verified this pass).
- `apps/api/.env` (the real local file) is correctly gitignored and was never a tracked file.
- `deploy/k8s/02-secret.example.yaml` templates every sensitive value as `REPLACE_ME`/`REPLACE_ME_OPTIONAL`; the real `02-secret.yaml` it generates on the EC2 host is gitignored.
- No `NEXT_PUBLIC_API_URL` or other frontend env var was found hardcoded to `localhost` outside `.env`/`.env.example` defaults (which is expected/correct — these are dev fallbacks, and the Dockerfiles require `NEXT_PUBLIC_API_URL` as a mandatory `--build-arg` with no hardcoded production fallback).

## 6. Database schema and migrations

SQLite provider, 20 tracked migrations under `apps/api/prisma/migrations/`, all additive/safe (confirmed pattern used throughout this engagement — SQLite's "redefine table" approach for column additions, never a destructive rewrite). Full detail in `DATABASE-READINESS.md`.

## 7. Authentication and authorization

Mandatory two-step login (password → OTP → session), OTP attempt-limiting (max 5, enforced across login/email/mobile OTP types), OTP single-use (deleted on success), admin-role bypass of the OTP step (documented, intentional — the admin UI has no OTP-entry screen), backend-derived `req.user.id` everywhere (never a client-supplied `userId`), a working self-disabling admin-bootstrap endpoint. All of this was built, live-browser-tested, and re-verified multiple times across this engagement (most recently in the live cart-clear-on-order test, which exercised the full OTP login flow end-to-end).

## 8. Payments

Razorpay: server-side signature verification + an independent cross-check against Razorpay's own `fetchPayment` API (not just trusting the signature), webhook idempotency via a `(provider, eventId)` unique constraint, amount/currency cross-validation on both the browser-callback and webhook paths. Live-tested with a real test-mode payment earlier in this engagement, cross-verified against Razorpay's own API as the source of truth.

## 9. File uploads / storage

`STORAGE_DRIVER=local` is the active configuration (confirmed in `deploy/k8s/01-configmap.yaml`). An S3 storage adapter already exists in code (`apps/api/src/uploads/storage/s3-storage.adapter.ts`, with its own spec) as a ready-but-unused alternative — switching to it is a config change (`STORAGE_DRIVER=s3` + IAM credentials), not new development, if S3 is ever adopted. Upload validation (extension/size) exists (`upload-validation.ts` + spec, lint/typecheck clean).

## 10. Test suites

386 tests across all 3 apps (315 API / 58 storefront / 13 admin) — all passing, this is the preserved regression baseline. See `TEST-RESULTS.md`.

## 11. Health-check endpoints

`apps/api/src/health/health.controller.ts` — a real `/api/health` route with no DB dependency (deliberate — a DB hiccup shouldn't make the liveness probe itself fail), used by the API's own Dockerfile `HEALTHCHECK`. Frontends have no dedicated health route; their Dockerfiles check `/` instead (documented, deliberate choice — confirmed no such route exists).

## 12. Logging and error handling

`request-logger.middleware.ts` + `common/logging/redact.ts` (secret redaction confirmed to exist — a dedicated module specifically for keeping credentials out of logs). `main.ts` wires Helmet security headers, a CORS origin-validator, graceful shutdown hooks. Every `EmailService`/`SmsService` send is non-throwing and logs success/failure without ever logging the credential itself (verified repeatedly this engagement via live log inspection).

## Confirmed production-ready features

- Mandatory OTP login, attempt-limiting, replay-prevention.
- Multi-user cart/wishlist/address/order data isolation (live-tested, zero leakage both directions).
- Razorpay payment verification (signature + independent API cross-check + webhook idempotency).
- Atomic order creation: stock decrement + cart-clear in the same transaction (fixed and live-verified this engagement).
- Rate limiting on auth-sensitive routes (`@Throttle`, confirmed via `throttle-wiring.spec.ts` and a live brute-force test against OTP verification).
- Secure, non-root, multi-stage, health-checked Docker images for all three apps.
- Self-disabling admin bootstrap (no hardcoded credentials, confirmed by code read + a zero-admin-accounts live check).

## Confirmed gaps / honest limitations (not blockers for the chosen single-EC2 path)

1. **No systematic request-validation layer.** `main.ts`'s global `ValidationPipe` is wired but has nothing to act on — no DTO classes exist anywhere in the codebase; every `@Body()` is `any`/inline-typed. Validation that does exist is ad-hoc, hand-written per-service (e.g. pincode/mobile regex checks seen in `orders.service.ts`). Not a security hole in itself (services do validate what they read), but it means "add a DTO class" is a real future task, not something already done.
2. **No CI pipeline.** All checks in this report were run manually.
3. **No automated rollback script** for the single-EC2 path (see `ROLLBACK.md`) — rollback today is a manual procedure.
4. Lint is clean but carries pre-existing `@typescript-eslint/no-explicit-any` **warnings** (not errors) in several frontend files — cosmetic, not fixed in this pass since they don't block anything and fixing them risks touching working code unnecessarily.
5. Cookie-based session auth is wired with `secure: NODE_ENV==='production'` but the app doesn't actually rely on it (both frontends use `localStorage` + `Authorization: Bearer`) — previously documented, unaffected by anything in this pass. Matters once/if HTTPS is added and cookie auth is ever actually used.

## Unused / stray development files found and handled

- `apps/api/seed-test-admin.js` — one-off script with a hardcoded **test-only** password for an `@test.local` account. Added to `.gitignore`, left untracked (not deleted — it may still be useful locally, just shouldn't ship).
- `apps/api/prisma/dev_backup_20261109_172758.db`, `dev_backup_before_image_update_20261109_180937.db` — stray SQLite binary snapshots from earlier manual work. Added `apps/api/prisma/dev_backup_*.db` to `.gitignore`.
- Root-level `backups/` (this session's pre-cleanup DB backup) — added `/backups/` to `.gitignore`.
- Two root-level `.xlsx` catalog exports (~1.2MB, ~4MB) — added `*.xlsx` to `.gitignore` as data exports, not source.

None of these were deleted from disk — only excluded from version control, since they may still have local value and deleting a backup file during a "harden for production" pass would be exactly the kind of unnecessary destructive action to avoid.

## Deployment blockers for the chosen single-EC2 path

**None identified.** The one item that blocks real customer traffic (not code) is TLS/HTTPS + a real domain, already flagged as out-of-scope-for-now in `deploy/README.md` and unchanged by this audit.
