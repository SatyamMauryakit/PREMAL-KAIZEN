# DEPLOYMENT_AUDIT_REPORT.md

Date: 2026-11-11. Scope: the 5 real deployment problems observed on EC2 (public IP
`13.203.28.64` at observation time — never hardcoded into any committed file or
config; used here only to describe what was observed). Each root cause below was
determined by reading the actual script/manifest/code, not assumed.

## Issue A — External health check incorrectly treated as an application failure

**Root cause, confirmed by reading `deploy.sh`'s Stage 9 (old numbering):** the
script's own post-deploy health check ran `curl http://${PUBLIC_IP}:30002/...` —
**from the EC2 instance itself**, curling **its own public IP** back through a
NodePort. This is a well-known cloud-networking limitation (often called the "hairpin
NAT" problem): many VPC/security-group configurations do not route a host's own
outbound request back to itself via its public IP, and the connection simply times
out — for reasons that have nothing to do with whether the application is actually
reachable from the real internet. The internal check (`127.0.0.1:30002`) and the
application's own logs (`GET /api/health 200`) already proved the app was fine; the
script was asking the wrong question of the wrong path.

**Fix implemented:** `deploy.sh`'s health verification is now 5 explicitly separated
layers (container health / pod readiness / in-cluster Service DNS connectivity / EC2
localhost connectivity / external public connectivity), with external connectivity
downgraded from an automated pass/fail gate to a clearly-labeled manual verification
step with the exact `curl` commands to run from a genuinely external machine. See
`PRODUCTION_DEPLOYMENT_GUIDE.md` for the full layer breakdown.

## Issue B — Prisma migrations never applied; `NotificationEvent` table missing

**Root cause, confirmed by reading `apps/api/Dockerfile`, `.dockerignore`, and
`apps/api/package.json`:**

1. The previous `deploy.sh` **by design never ran any migration** (explicitly
   documented in its own header comment) — it only printed a manual command to run
   later. Nobody ran it, so the fresh `dev.db` the deployment created stayed
   completely schema-less. `/api/health/ready` only runs `SELECT 1` (confirmed by
   reading `health.controller.ts`), which succeeds even against an empty database —
   so the readiness probe gave false confidence and the app started serving traffic
   anyway, with background processors (`NotificationProcessor`,
   `StaleOrderCleanupService`) then failing every time they queried a real table.
2. The user's own manual diagnostic (`pnpm exec prisma migrate status`) failed with
   `pnpm: not found` because **`pnpm` is deliberately not installed in the runtime
   stage** of `apps/api/Dockerfile` (only `base`/`deps`/`build` stages run
   `corepack prepare pnpm` — the final `runtime` stage is a fresh `node:*-slim` with
   only `node` itself, which does ship `npx`/`npm` but not `pnpm`).
3. However: `prisma` **is** a devDependency of `@premal/api` (`^5.7.0`, confirmed in
   `package.json`), and the Dockerfile's runtime stage deliberately copies the FULL
   `node_modules` forward (not a `--prod` prune — documented in-file: a prod-only
   install would break the build since it needs `prisma generate`, a devDependency).
   `apps/api/prisma/migrations/` and `schema.prisma` are **not** excluded by
   `.dockerignore` either. So the Prisma CLI binary and every migration file are
   genuinely present in the image — the failure was specifically about `pnpm`, not
   about the CLI or schema being missing.

**Fix implemented:** a dedicated, one-shot Kubernetes **Job**
(`deploy/k8s/09-migration-job.yaml`) that runs `./node_modules/.bin/prisma migrate
deploy` directly (the locally-resolved binary, not `npx` or `pnpm`, removing any
ambiguity about resolution/network access) against the same mounted database file the
API uses. `deploy.sh` now: scales the API Deployment to 0 replicas first (so the Job
and a live API pod are never both writing to the SQLite file at once), deletes any
previous Job (Jobs aren't rerunnable in place), applies the new one, and **blocks**
until it reports `Complete` — refusing to apply the API Deployment at all if the Job
fails, with the exact failure (`kubectl logs job/premal-api-migrate`) printed. `prisma
migrate deploy` is idempotent by nature (only applies migrations not yet recorded as
applied), satisfying the "safe to rerun" requirement without any custom bookkeeping.
Never uses `migrate reset` or `db push --force-reset` anywhere.

## Issue C — SQLite vs. PostgreSQL

See `DATABASE_MIGRATION_REPORT.md` for the full audit and plan. Headline: the schema
itself needs almost no changes (no `@db.*` native-type annotations, no `Json`/`Decimal`
fields, every id is a portable `cuid()`, and the application's only raw SQL —
`$queryRaw\`SELECT 1\`` — is identical on both engines). The real work is generating a
correct, clean Postgres migration history and provisioning RDS, neither of which was
done without your separate approval (no RDS was created, no AWS resource was touched).

## Issue D — StorageClass `premal-local` not found

**Root cause, confirmed by reading `deploy/k8s/03-pvc.yaml`:** the `PersistentVolume`
and `PersistentVolumeClaim` both reference `storageClassName: premal-local`, but **no
`StorageClass` object named `premal-local` was ever defined anywhere in the repo** —
only referenced by name. For a purely static PV/PVC pairing this can still bind by
matching the string value, but the API server logs
`storageclass.storage.k8s.io "premal-local" not found` because something in the
provisioning/admission path tries to actually resolve that named object and finds
nothing. Falling through toward kind's default `standard` StorageClass (backed by the
`local-path-provisioner`, which stores data inside the kind node container's own
writable layer) would be the wrong outcome for this architecture - that path does
**not** survive `kind delete cluster` or a node-container recreation, defeating the
entire reason `deploy/kind-config.yaml` mounts a real EC2 host directory
(`/opt/premal-kaizen/data`) in the first place.

**Fix implemented:** added the actual `StorageClass` object
(`provisioner: kubernetes.io/no-provisioner`, `volumeBindingMode: WaitForFirstConsumer`
— the standard, documented pattern for a manually pre-created static PV) to
`deploy/k8s/03-pvc.yaml`, applied before the PV/PVC. This is purely additive — the
static PV's `hostPath`, the PVC, and all existing data are completely untouched; only
the previously-missing class definition was added, so the reference now resolves
cleanly with no ambiguity about which storage backend is actually being used.

## Issue E — Production secrets

**Audited by grep against actual code usage**, not assumed:

| Secret | Actually read by code? | Where |
|---|---|---|
| `JWT_SECRET` / `JWT_EXPIRY` | **No** — zero matches outside `.env` itself | Sessions use a random opaque token in the `Session` table, not a signed JWT |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Only by `pnpm db:seed` (`prisma/seed.ts`) | Not run by `deploy.sh` at all — the real admin account is created via the self-disabling `/api/auth/admin/bootstrap` endpoint instead |
| `RAZORPAY_KEY_ID` / `_SECRET` / `_WEBHOOK_SECRET` | Yes | `razorpay.service.ts` — signature verification confirmed to use the real secret, not a stub |
| `SMTP_HOST`/`_PORT`/`_USER`/`_PASSWORD`, `EMAIL_FROM` | Yes | `email.service.ts` — gracefully degrades (logs + skips) when unset, never crashes |

**Fix implemented:** `deploy.sh`'s secret-validation stage now classifies every key
into these three buckets explicitly (rather than one flat "placeholder" list), reports
Razorpay/SMTP as **DISABLED** (not silently "fine") when still placeholders, and — new
this pass — **production mode (`DEPLOY_MODE=production`) now hard-fails** if Razorpay
or SMTP are still placeholders, since OTP login and checkout genuinely depend on them
in real use. Staging mode is unaffected (keeps the previous graceful-degradation
behavior for local/test deployments). No secret value is ever printed, in either mode.
AWS Secrets Manager/SSM Parameter Store is documented as the recommended real
production secret source in `PRODUCTION_DEPLOYMENT_GUIDE.md` — not implemented in this
pass, since it requires AWS IAM/resource decisions outside a repo-only change.

## Files changed this pass

- `deploy.sh` — full rewrite into the 9-stage structure (see
  `PRODUCTION_DEPLOYMENT_GUIDE.md` for stage-by-stage detail).
- `deploy/k8s/03-pvc.yaml` — added the missing `StorageClass` object.
- `deploy/k8s/09-migration-job.yaml` — new file, the migration Job.
- `apps/api/prisma/schema.postgres-test.prisma` — refreshed (was 9 days stale,
  missing models added since) as planning groundwork; still gitignored, still not the
  active schema, still not used by the running app.

No application code, Dockerfiles, or the active `schema.prisma` needed changes for
Issues A/B/D/E — confirmed by direct inspection, not assumed from the prior
engagement's reports.
