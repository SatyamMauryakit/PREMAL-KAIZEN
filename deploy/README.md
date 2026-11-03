# PREMAL KAIZEN - single-EC2-instance deployment

Docker + [kind](https://kind.sigs.k8s.io/) (Kubernetes-in-Docker) + a single `deploy.sh`,
for running the full stack (storefront, admin, API) on one EC2 instance.

## Before you run it

1. Launch an EC2 instance - **t3.large (2 vCPU / 8GB RAM) recommended**, Ubuntu 22.04 or
   24.04, with a security group that at minimum allows SSH (22) from your own IP. Do
   **not** open any other ports yet - `deploy.sh` will tell you exactly which ones to
   add, and will not open them for you.
2. `git clone` this repository onto the instance and `cd` into it.
3. `chmod +x deploy.sh && ./deploy.sh`

## What it does

See `deploy.sh`'s own comments for the full step-by-step; in short: checks the host has
enough disk/memory/CPU, installs Docker + kind + kubectl if missing, builds the 3 app
images from the real Dockerfiles, loads them into a dedicated `premal-kaizen` kind
cluster (never touching any other cluster/context already configured on the host),
applies the manifests in `deploy/k8s/`, waits for everything to become healthy, and
prints the access URLs plus the exact security-group rules to add.

Safe to rerun at any time - every step checks current state first.

## Why kind, and its real limitations here

kind is normally a local-dev/CI tool for testing against a real Kubernetes API, not a
typical production hosting choice - a bare single-node distribution built for this
exact scenario (e.g. k3s) would have lower resource overhead. It was deliberately
chosen for this deployment anyway; the practical consequences worth knowing:

- Extra resource overhead: kind's "node" is itself a container, with its own nested
  containerd/kubelet/API-server/etcd on top of the Docker daemon already running on the
  host. Budget accordingly (see the memory check `deploy.sh` runs).
- Data only truly survives the EC2 instance because `deploy/kind-config.yaml` mounts
  a real host directory (`/opt/premal-kaizen/data`) into the kind node, and
  `deploy/k8s/03-pvc.yaml` is a static PV pointed at that same path - without that,
  anything written inside the cluster would be lost the moment the kind node
  container is recreated (not just on pod restart).
- `kind delete cluster --name premal-kaizen` removes the Kubernetes layer entirely, but
  `/opt/premal-kaizen/data` on the host is untouched - the SQLite database and uploaded
  images survive a full cluster teardown/recreate.

## Single point of failure, by design

This is one EC2 instance. `replicas: 1` on every Deployment is intentional, not an
oversight - a second replica of the API would mean two processes fighting over the same
SQLite file (which has no safe concurrent-multi-writer story), and a second storefront/
admin replica would add no real availability since both would go down with the same one
underlying node anyway. There is no failover here; the instance itself is the single
point of failure.

## Database

The app uses SQLite via Prisma (confirmed - not PostgreSQL in the active app, whatever
Phase H-K scratch exploration may have tested elsewhere). The tracked migration history
(`apps/api/prisma/migrations/`, provider-locked to `sqlite` in `migration_lock.toml`)
is applied with the standard `prisma migrate deploy` - verified correct for this exact
provider and history, not assumed.

`deploy.sh` never runs a migration or touches an existing `dev.db` automatically. After
the pods are up, it runs a **read-only** `prisma migrate status` inside the API pod
(this only reads migration metadata, never modifies the database) and tells you plainly
whether the schema is up to date or still needs the one-time `migrate deploy` command -
it does not guess this from the file's size, since SQLite can write its own header as
soon as anything connects (even the readiness probe's own `SELECT 1`), which would make
a "is the file empty" check silently stop being accurate after the first pod start.

If you have an existing `dev.db` you want this deployment to use, `scp` it to
`/opt/premal-kaizen/data/db/dev.db` on the EC2 host *before* running `deploy.sh` (or
before the first pod start) - it will be reused as-is, never reset or migrated
automatically.

## Secrets

`deploy/k8s/02-secret.yaml` is created automatically from `02-secret.example.yaml` on
first run (gitignored - never commit it). Every value in it is a placeholder until you
edit it by hand. None of them are required for the app to boot and pass health checks
(verified - see the comments in `02-secret.example.yaml` for exactly what each one
actually gates); `deploy.sh` tells you which are still placeholders and what stays
degraded (payments, email, admin seeding) until you set them.

## Admin panel exposure

The admin Service is a NodePort like the other two, for consistency and simplicity, but
it is sensitive - don't open it to `0.0.0.0/0`. Either restrict the security-group rule
for port 30001 to your own IP, or don't open it at all and reach it through an SSH
tunnel instead (`ssh -L 30001:localhost:30001 <user>@<ec2-ip>`, then browse to
`http://localhost:30001`) - `deploy.sh` prints both options.

## File/data permissions (least privilege)

All three images run as a fixed, non-root UID/GID (`10001:10001`, pinned explicitly in
each Dockerfile's `useradd`/`groupadd` - not Debian's dynamically-assigned `--system`
ID, which would differ unpredictably and couldn't be inspected ahead of a real build).
`deploy.sh` `chown`s `/opt/premal-kaizen/data` to that same `10001:10001` and `chmod`s it
`700` (owner-only) - not world-writable. Each Deployment also sets an explicit
`securityContext` (`runAsNonRoot: true`, `runAsUser/Group: 10001`) as defense in depth,
so a pod refuses to start at all rather than silently running as root if this ever
drifts from the Dockerfiles.

## Authentication cookie note (not a blocker, documented for awareness)

`apps/api/src/identity/identity.controller.ts` sets a `sessionToken` cookie with
`secure: process.env.NODE_ENV === 'production'`. Since this deployment sets
`NODE_ENV=production` and serves plain HTTP (no TLS yet), that cookie's `Secure` flag
means browsers will never actually send it back. This does **not** block login:
both `apps/storefront` and `apps/admin` were verified to authenticate exclusively via a
`sessionToken` stored in `localStorage` and sent as an `Authorization: Bearer` header -
neither frontend relies on the cookie at all currently. Flagging this so it isn't
mistaken for working cookie-based auth later, and so it's revisited if HTTPS/cookie-based
auth is ever added - no application code was changed for this phase.

## HTTPS / a real domain (not covered here)

Out of scope for this initial deployment. To add it later: point a domain's A record at
the EC2 public IP, put a reverse proxy (nginx/Traefik) or a Kubernetes Ingress +
cert-manager in front of the three NodePorts, and terminate TLS there.
