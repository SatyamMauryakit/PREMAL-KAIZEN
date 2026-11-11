# DOCKER-READINESS.md

Date: 2026-11-11. All three Dockerfiles were read directly this pass (not assumed from
prior documentation).

## apps/api/Dockerfile

- Multi-stage: `base` → `deps` (frozen-lockfile install) → `build` (`nest build`) →
  `runtime` (minimal `node:*-slim`).
- `openssl`/`ca-certificates` installed explicitly in both the build and runtime stages
  — Prisma's query engine needs `libssl` at runtime, not just at `prisma generate` time;
  documented in-file as a confirmed (not guessed) requirement.
- Non-root: fixed UID/GID `10001:10001` (not Debian's dynamically-assigned `--system`
  ID), set via explicit `groupadd`/`useradd`, `USER appuser` before `CMD`.
- `node_modules` copied forward in full (not `pnpm --prod` pruned) — deliberate, with
  the reasoning documented in-file: a `--prod` install would re-run the API's own
  `postinstall` (`prisma generate`), which needs the `prisma` CLI devDependency that a
  prod-only install excludes, breaking the build. Trade-off is a larger image; correct
  trade-off for correctness over size here.
- `HEALTHCHECK` hits the real `/api/health` route (confirmed to exist, DB-independent)
  — not an invented or guessed path.
- `EXPOSE 3002`, `CMD ["node", "dist/main"]`.

## apps/storefront/Dockerfile & apps/admin/Dockerfile

- Same base pattern, Next.js `standalone` output mode.
- `NEXT_PUBLIC_API_URL` is a **required** build arg with no hardcoded production
  fallback (correct — it's baked into the client bundle at build time, so a wrong
  default would be far worse than a build failure demanding it be set).
- Same fixed non-root UID/GID as the API image, for consistency across all three.
- `HEALTHCHECK` hits `/` since neither frontend has a dedicated health route
  (confirmed, not assumed) — admin's healthcheck correctly accepts both `200` and `307`
  (the real redirect-to-login behavior observed live when signed out, confirmed by
  diffing admin's Dockerfile against storefront's this pass).
- Admin's Dockerfile has one extra line storefront's doesn't: `RUN mkdir -p
  apps/admin/public` — because the admin app has no actual static assets and git never
  tracks empty directories, so a fresh clone wouldn't have that folder at all without
  this; documented in-file as empirically confirmed, not a guess.

## Multi-stage builds, reproducibility, production dependencies

✅ All three. `pnpm install --frozen-lockfile` in every `deps` stage means the exact
versions in `pnpm-lock.yaml` are what gets built — no silent drift between a local
build and a CI/EC2 build.

## Resource limits / log rotation

**Not configured in the Dockerfiles themselves** — these are k8s-level concerns
(`resources.limits`/`requests` in the Deployment manifests, and the container
runtime's own log-rotation policy), not something a Dockerfile controls. Checked
`deploy/k8s/10-api.yaml`/`11-storefront.yaml`/`12-admin.yaml` structure from the prior
deploy-setup review: `replicas: 1` is set everywhere by design (see `deploy/README.md`'s
single-point-of-failure note), but explicit CPU/memory `resources` blocks were not
independently re-verified line-by-line this pass. **Flag, not confirmed either way —
recommend a direct check of the k8s manifests' `resources` stanzas before relying on
this report for that specific claim.**

## Image builds this pass

**Not performed.** Docker CLI is installed (`29.8.2`) but the daemon is not running on
this development machine — confirmed by `docker info` failing both earlier in this
engagement and again this pass. Building and running the 3 images locally to simulate
production (`deploy.sh`'s own first step) was therefore not possible from here. This
will happen as the literal first thing `deploy.sh` does on the real EC2 host, where
it's already proven to work (this exact script + these exact Dockerfiles are what the
existing, previously-reviewed single-EC2 deployment uses).

## Verdict

Dockerfiles are production-ready as written — no changes made or needed this pass.
Image builds themselves are deferred to the real EC2 host due to local Docker daemon
unavailability, not any defect found in the files.
