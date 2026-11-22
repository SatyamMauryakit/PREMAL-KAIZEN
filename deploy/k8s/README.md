# PREMAL KAIZEN - Kubernetes manifests (K3s-compatible)

These replace an earlier, now-removed set of manifests that assumed SQLite and a
`kind` (Kubernetes-in-Docker) cluster - both stale relative to the architecture
actually running in production today (Docker Compose + PostgreSQL, see
`deploy-compose/`). This set targets **PostgreSQL** and a **K3s** single-node cluster,
matching `apps/api/prisma-postgres/schema.prisma` and the project's documented single
EC2 instance deployment model.

**Not deployed anywhere by this commit** - these are prepared, locally-validated
manifests (YAML-parsed, not yet applied to a real cluster), per STEP 1's explicit
"do not deploy to AWS / do not deploy to any real cluster" rule. Applying them for
real is STEP 2's job.

## Files, in apply order

| File | Resource(s) |
|---|---|
| `00-namespace.yaml` | `Namespace/premal-kaizen` |
| `01-configmap.yaml` | `ConfigMap/premal-api-config` - non-secret API env (CORS, S3 bucket, etc. - replace the `__PLACEHOLDER__` values) |
| `02-secret.example.yaml` | Template only - copy to `02-secret.yaml` (gitignored) and fill in real values before applying |
| `03-postgres.yaml` | `StatefulSet/premal-postgres` + headless `Service` - persistent via K3s's built-in `local-path` StorageClass |
| `04-migration-job.yaml` | One-shot `Job` - runs `prisma migrate deploy` against Postgres. **Apply this and wait for it to complete before applying `05-api.yaml`** |
| `05-api.yaml` | `Deployment/premal-api` + `Service` (port 3002, internal only) |
| `06-storefront.yaml` | `Deployment/premal-storefront` + `Service` (port 3000, internal only) |
| `07-admin.yaml` | `Deployment/premal-admin` + `Service` (port 3001, internal only - **never** routed through `08-caddy.yaml`; reach it via `kubectl port-forward` or a separate IP-restricted rule) |
| `08-caddy.yaml` | `ConfigMap` + `Deployment` + `LoadBalancer Service` - the only public entry point, routes `/api/*` to the API and everything else to the storefront |

## Building the images these manifests expect

The API image **must** be built with the Postgres build arg - the default build
(no arg) generates a SQLite-targeted Prisma Client, which will fail against a real
Postgres `DATABASE_URL`:

```bash
docker build -f apps/api/Dockerfile --build-arg DATABASE_PROVIDER=postgresql \
  -t premal-api:postgres-local .
docker build -f apps/storefront/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://your-domain/api \
  -t premal-storefront:postgres-local .
docker build -f apps/admin/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://your-domain/api \
  --build-arg NEXT_PUBLIC_STOREFRONT_URL=https://your-domain \
  -t premal-admin:postgres-local .
```

For K3s (not a managed registry), import each built image directly into K3s's
embedded containerd rather than `docker push`ing anywhere:

```bash
docker save premal-api:postgres-local | sudo k3s ctr images import -
docker save premal-storefront:postgres-local | sudo k3s ctr images import -
docker save premal-admin:postgres-local | sudo k3s ctr images import -
```

Then update each Deployment's `image:` field (currently `*:postgres-local`
placeholders) to match whatever tag you actually built/imported, if different.

## Apply order (once real values are filled in)

```bash
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-configmap.yaml
kubectl apply -f 02-secret.yaml       # your real, gitignored copy - not 02-secret.example.yaml
kubectl apply -f 03-postgres.yaml
kubectl wait --for=condition=ready pod -l app=premal-postgres -n premal-kaizen --timeout=120s
kubectl apply -f 04-migration-job.yaml
kubectl wait --for=condition=complete job/premal-api-migrate -n premal-kaizen --timeout=120s
kubectl apply -f 05-api.yaml -f 06-storefront.yaml -f 07-admin.yaml -f 08-caddy.yaml
```

## Conventions carried forward from the old (removed) manifests

- Namespace name (`premal-kaizen`) and resource naming prefix (`premal-<component>`).
- Fixed non-root UID/GID `10001:10001` - **Dockerfile-enforced**, not just a manifest
  convention; all three app images `useradd`/`groupadd` this exact ID, so every
  Deployment's `securityContext.runAsUser/runAsGroup` must match or the container
  fails to start.
- Probe targets: API liveness `/api/health` (no DB dependency, by design - see
  `apps/api/src/health/health.controller.ts`), API readiness `/api/health/ready`
  (does check DB connectivity); storefront/admin have no dedicated health route, so
  both probe plain `/` (admin's unauthenticated 307 redirect is still a 2xx-399
  success as far as Kubernetes' default httpGet probe logic is concerned).
- Admin is never exposed through the same public ingress as storefront/API.

## What's genuinely new versus the removed manifests

- `PostgreSQL StatefulSet` (`03-postgres.yaml`) - SQLite needed no separate database
  service at all, so this didn't exist before.
- K3s's built-in `local-path` StorageClass for dynamic provisioning, instead of a
  static hostPath `PersistentVolume`/`PersistentVolumeClaim` hand-wired for a
  `kind`-specific node mount.
- `RollingUpdate` instead of `Recreate` on the API Deployment - the old `Recreate`
  strategy existed only to avoid two processes opening one SQLite file; Postgres
  handles concurrent connections natively, so that constraint is gone.
- `imagePullPolicy` is left at its K8s default (`IfNotPresent` for a non-`:latest`
  tag) instead of `Never` - the old value was specific to `kind load docker-image`'s
  mechanics and doesn't apply to a `k3s ctr images import` workflow.
