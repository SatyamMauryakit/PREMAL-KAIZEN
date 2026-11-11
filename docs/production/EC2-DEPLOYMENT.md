# EC2-DEPLOYMENT.md

Date: 2026-11-11. This documents the deployment process for the **chosen** single-EC2
architecture — not the 3-EC2/RDS/ALB structure the original mega-prompt assumed, which
was explicitly declined before this audit began.

## What already exists (built and reviewed, not new this pass)

- `deploy/deploy.sh` — single-command setup: installs Docker/kind/kubectl, builds all
  3 images from the real Dockerfiles, applies `deploy/k8s/*.yaml`, waits for health,
  prints access URLs and the exact security-group rules to add. Safe to rerun.
- `deploy/k8s/00-namespace.yaml` through `12-admin.yaml` — namespace, ConfigMap,
  Secret template, PVC, and the 3 app Deployments/Services.
- `deploy/kind-config.yaml` — mounts a real host directory so data (SQLite file +
  uploaded images) survives a full cluster teardown/recreate.
- `deploy/README.md` — the authoritative operational doc: instance sizing (t3.large
  recommended), the single-point-of-failure-by-design note, secrets handling, admin
  panel exposure guidance (SSH tunnel, not a public port), file permissions
  (fixed 10001:10001 non-root), and the known HTTPS/domain gap.

## Pre-deployment checklist (per the mega-prompt's Phase 14, adapted)

1. **Configure EC2**: launch Ubuntu 22.04/24.04, t3.large, security group allowing only
   SSH(22) from your own IP initially.
2. **Install Docker**: handled automatically by `deploy.sh` — no manual step needed.
3. **Authenticate with a registry**: N/A for this architecture — images are built
   directly on the EC2 host from source, not pulled from a registry. (If you want
   registry-based deploys later, that's a real architecture change, not covered here.)
4. **Pull the approved release**: `git clone` the repository at the approved commit/tag
   (see `GITHUB-RELEASE-SUMMARY.md` for the exact commit once pushed).
5. **Configure production secrets**: edit the auto-generated `deploy/k8s/02-secret.yaml`
   with real Razorpay **live** keys, working SMTP credentials
   (`premal.kaizen@gmail.com` + its app password, already confirmed working this
   engagement), and `ADMIN_EMAIL`/`ADMIN_PASSWORD` only if seeding fresh (not needed if
   carrying over the cleaned `dev.db` — see below).
6. **Connect to RDS**: N/A — this architecture uses the SQLite file on the EC2 host's
   own disk, not RDS. (Revisit if the architecture decision changes later.)
7. **Configure Nginx/HTTPS**: not yet done anywhere in this repo — genuinely missing,
   flagged in every prior report. Needed before accepting real customer traffic over
   the open internet with real payment details.
8. **Start production containers**: `./deploy.sh`.
9. **Verify application health**: `deploy.sh` already waits for and reports pod health;
   additionally hit the printed URLs directly (`/api/health` for the API, `/` for both
   frontends) after it finishes.
10. **Inspect logs**: `kubectl logs -n premal-kaizen <pod>` (the namespace `deploy.sh`
    creates).
11. **Post-deployment smoke tests**: at minimum, repeat this engagement's live checks —
    register→OTP→login, add-to-cart→checkout→COD order→confirm cart clears, and one
    Razorpay test-mode payment — against the real EC2 URL before calling it live.
12. **Roll back if necessary**: see `ROLLBACK.md` — this is the weakest link right now,
    flagged honestly rather than glossed over.

## Carrying over the real database

Your current `apps/api/prisma/dev.db` has the real (post-cleanup) 49-product catalog,
categories, and store settings — and **zero** sample customers/orders/admins, per
`CLEANUP-REPORT.md`. To use it in production: `scp dev.db` to
`/opt/premal-kaizen/data/db/dev.db` on the EC2 host **before** the first pod start.
Skipping this means `deploy.sh` starts with a genuinely empty database and every
product would need re-entering by hand.

## What this report does NOT authorize

Per the owner's own standing instruction and this prompt's explicit rule: this document
describes the process: it does **not** provision any AWS resource, change DNS, switch
Razorpay to live mode, or execute a deployment. Those remain separate, explicitly
authorized actions.
