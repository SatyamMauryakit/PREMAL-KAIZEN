# PRODUCTION_DEPLOYMENT_GUIDE.md

Date: 2026-11-11. Covers the rewritten `deploy.sh`'s 9 stages, both deployment modes,
and the networking/domain work that remains separate, approval-gated follow-up.

## Two deployment modes — do not confuse them

```bash
./deploy.sh                          # staging mode (default)
DEPLOY_MODE=production ./deploy.sh   # production mode
```

**Neither mode changes the underlying infrastructure** — both deploy the exact same
single-node `kind` cluster on one EC2 instance, with SQLite on local disk. This is
**not** a managed, highly-available Kubernetes cluster, and `DEPLOY_MODE=production`
does not pretend otherwise. The only differences:

| | staging | production |
|---|---|---|
| Razorpay/SMTP placeholders | Warns, continues | **Hard-fails** before touching the cluster |
| Report wording | Generic | Explicit about single-node/no-failover limitations |

If you need genuine multi-node high availability, that's a materially different
architecture (managed EKS, RDS instead of SQLite, S3 instead of local uploads) — see
`DATABASE_MIGRATION_REPORT.md` for the audited-but-not-yet-executed Postgres path, and
treat that as a separate project phase, not something `DEPLOY_MODE=production` secretly
does for you.

## The 9 stages (what `deploy.sh` now actually does)

1. **Preflight** — OS/disk/memory/CPU checks (configurable via `PREMAL_MIN_*` env
   vars, not hardcoded), repo structure check, confirms pnpm is correctly *not*
   required on the host, and (production mode only) checks for
   `PREMAL_STOREFRONT_DOMAIN`/`PREMAL_API_DOMAIN`.
2. **Environment validation** — creates/validates `deploy/k8s/02-secret.yaml`,
   classifies every secret key by actual code usage, enforces the production-mode
   Razorpay/SMTP gate.
3. **Docker** — installs only if missing, pins the official apt repo.
4. **Kubernetes** — creates or reuses the `kind` cluster, applies the namespace,
   **validates every manifest's structure against the now-live cluster** (moved here
   deliberately — doing this in Stage 1 would fail on every fresh host, since no
   cluster exists yet to validate against), applies the `StorageClass`/PV/PVC.
5. **Build** — builds and tags all 3 images with a release identifier
   (`<git-short-sha>-<timestamp>`, overridable via `PREMAL_RELEASE_TAG`), not just
   `:local`. Loads both tags into kind.
6. **Database migration** — scales the API to 0 replicas, applies the migration Job,
   **blocks** until it reports `Complete`, aborts the entire deployment (API stays at
   0 replicas) if it doesn't.
7. **Deploy** — applies the (image-tag-substituted) API/storefront/admin manifests,
   waits for each rollout, prints pod/service/endpoint status.
8. **Health verification** — 5 separated layers: container/pod readiness, in-cluster
   Service DNS connectivity, EC2 localhost connectivity (the authoritative automated
   signal), and external public connectivity (reported, never auto-failed — see
   `DEPLOYMENT_AUDIT_REPORT.md` Issue A for why).
9. **Report** — mode, release tag, image tags, pod/service status, migration status,
   health status, disabled integrations, and the exact remaining blockers — never
   claims success if migrations or mandatory health checks failed.

## Exact commands to run

```bash
# On a fresh EC2 instance, after `git clone` and `cd` into the repo:
chmod +x deploy.sh

# If you're carrying over the existing (cleaned) dev.db with your real catalog:
scp dev.db ubuntu@<ec2-ip>:/opt/premal-kaizen/data/db/dev.db   # BEFORE the command below

# Staging:
./deploy.sh

# Production (requires real Razorpay + SMTP values in deploy/k8s/02-secret.yaml first):
DEPLOY_MODE=production ./deploy.sh
```

Safe to rerun either command at any time — every stage checks current state first.

## HTTPS and domain — not invented, not implemented, here's the real design choice

Two supported paths exist; **do not mix them**:

1. **Single EC2 + Nginx + TLS** (fits the current architecture as-is): run Nginx
   directly on the EC2 host (or as a 4th pod) in front of the 3 NodePorts, terminate
   TLS there with a Let's Encrypt cert (certbot) or a cert-manager Ingress if you
   prefer to stay fully in-cluster. Point your real domain's A records at the EC2
   public IP:
   - `https://your-domain.com` → storefront (NodePort 30000)
   - `https://admin.your-domain.com` → admin (NodePort 30001, and even behind TLS,
     still don't open its security-group rule to 0.0.0.0/0 — Nginx can enforce an
     IP allowlist or client-cert requirement in front of it)
   - `https://api.your-domain.com` → api (NodePort 30002)
2. **AWS ALB + ACM** (fits a future multi-node/managed architecture better): an
   Application Load Balancer with an ACM certificate in front of target groups
   pointing at the NodePorts (or, if you later move off `kind` to a real managed
   cluster, at a proper Ingress). This is the right choice if you're also moving to
   RDS + possibly EKS — don't bolt an ALB onto a single `kind` node and call it highly
   available, since the single EC2 instance is still the one point of failure either
   way.

Neither is implemented in this pass (no domain was given, and provisioning an ALB/ACM
is a billable AWS change) — this section exists so the choice is explicit and
documented before you make it, not so you have to re-derive it later.

## Required EC2 security-group rules (printed by `deploy.sh` itself too)

```
TCP 30000  <- your IP (or 0.0.0.0/0 if intentionally public)   # storefront
TCP 30002  <- your IP (or 0.0.0.0/0 - browsers call this directly)   # api
TCP 30001  (admin) - do NOT open to 0.0.0.0/0; prefer an SSH tunnel:
  ssh -L 30001:localhost:30001 <user>@<ec2-ip>   then browse http://localhost:30001
Keep private: 22 beyond your own IP, 6443 (k8s API), any DB port (none public here).
```

`deploy.sh` never opens these itself — by design, so you always make this decision
explicitly in the AWS console/CLI yourself.
