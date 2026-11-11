# API_CONTRACT_AUDIT.md

Date: 2026-11-11. **No application code changed in this pass** — everything this pass
touched was infrastructure (`deploy.sh`, `deploy/k8s/*`, a gitignored planning-only
Postgres schema copy). The full endpoint inventory and frontend-call verification
already exists and is current: `docs/production/API-CONTRACT-REPORT.md` (from the
immediately prior hardening pass), which documents every endpoint group with an
honest verification status (live-tested / unit-tested / read-verified) — not
duplicated here to avoid two documents drifting out of sync with each other.

## What's worth re-stating here, specific to this pass's infrastructure changes

- **`NEXT_PUBLIC_API_URL`** (how the storefront/admin frontends know where the API
  is) is unaffected by this pass's `deploy.sh` rewrite in terms of app behavior — it's
  still baked into the client bundle at Docker build time via `--build-arg`, still
  required with no hardcoded fallback. The only change: `deploy.sh` now prefers an
  explicit `PREMAL_API_DOMAIN` env var (e.g. a future `https://api.your-domain.com`)
  over the bare NodePort IP/port when building this value, so a later HTTPS/domain
  cutover doesn't require editing the script itself.
- **CORS** (`CORS_ALLOWED_ORIGINS` in the ConfigMap) is still rendered from the same
  detected public IP + ports as before — unchanged logic, just now also aware of
  `PREMAL_API_DOMAIN` for consistency with the above.
- **The health endpoints this pass depends on for real** (`/api/health`,
  `/api/health/ready`) are unchanged application code — confirmed by reading
  `health.controller.ts` this pass specifically to verify the readiness probe's actual
  behavior (it only runs `SELECT 1`, which does **not** detect a missing-migration
  state — this is a genuine, documented limitation of relying on that probe alone,
  which is exactly why Stage 6's migration Job gate exists as a separate, harder
  guarantee rather than trusting the readiness probe to catch schema problems).

## Frontend → backend mismatch check (re-run, not re-derived)

Re-confirmed this pass: no new frontend `fetch`/service call was added or changed, so
there is nothing new to cross-check against the NestJS controllers beyond what
`docs/production/API-CONTRACT-REPORT.md` already covers. If/when the PostgreSQL
migration in `DATABASE_MIGRATION_REPORT.md` is actually executed, this file should be
revisited specifically for any endpoint whose behavior could differ under Postgres's
stricter transaction semantics (flagged there: the order-creation transaction is the
one worth a dedicated look, not because it's wrong, but because it's untested under
real concurrent load on a real multi-writer database).
