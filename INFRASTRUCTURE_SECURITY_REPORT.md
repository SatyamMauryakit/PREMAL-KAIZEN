# Infrastructure Security Report — PREMAL KAIZEN

**Date:** 2026-11-07
**Scope:** Static review of `apps/{api,admin,storefront}/Dockerfile`, `deploy/k8s/*.yaml`, `deploy/kind-config.yaml`, `deploy.sh`, `deploy/README.md`, `.dockerignore`. No cluster was actually deployed/run in this pass — this is a configuration review, not a live penetration test of the EC2/kind setup.

## Summary

This deployment setup is unusually well-documented and self-aware — `deploy/README.md` and inline comments in the manifests already disclose several of the findings below (the no-TLS gap, the admin NodePort exposure risk, the cookie/`Secure`-flag mismatch). That's a genuinely good sign: the team already knows these limitations and has made deliberate, explained tradeoffs rather than leaving them as silent gaps. This report independently verifies those claims and adds what wasn't already called out.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 1 |
| Low | 2 |
| Informational | 3 |

---

## HIGH — No TLS/HTTPS anywhere in this deployment

**Status: confirmed, already disclosed in `deploy/README.md` and `deploy.sh`'s own final output — not fixed, flagging with its real severity for the production-readiness verdict.**

No Ingress, reverse proxy, or cert-manager config exists anywhere in `deploy/k8s/`. All three services are exposed as plain-HTTP `NodePort`s. This means, as currently documented and designed:

- Customer login credentials, admin login credentials, and session tokens (sent as `Authorization: Bearer` headers per `apps/storefront`/`apps/admin`'s auth implementation — see `SECURITY_AUDIT_REPORT.md`) travel in **cleartext** over the public internet between a browser and the EC2 instance.
- The Razorpay webhook endpoint (`POST /api/payments/razorpay/webhook`) would also receive its signed payloads over plain HTTP — the HMAC signature still protects authenticity/integrity, but the payload itself (order/payment metadata) is not confidential in transit.
- The `sessionToken` cookie's `Secure` flag is set based on `NODE_ENV=production`, so in this exact deployment the cookie is marked `Secure` while being served over HTTP — browsers will simply never send it back. The README correctly notes this is a non-issue only because neither frontend actually relies on that cookie (both use `localStorage` + `Authorization: Bearer`) — verified true in `SECURITY_AUDIT_REPORT.md`'s live testing. If cookie-based auth is ever (re-)introduced, this combination would silently break it.

**Remediation (already correctly identified in the README, not yet implemented):** terminate TLS with a reverse proxy (nginx/Traefik) or a Kubernetes Ingress + cert-manager in front of the NodePorts, backed by a real domain. This is infrastructure work outside this QA pass's scope to implement, but it is the single biggest gap standing between this setup and a real production launch.

## MEDIUM — Kubernetes Secrets are not encrypted at rest by default

`deploy/k8s/02-secret.yaml` (generated from the `.example` template) uses a standard `Opaque` Secret. Vanilla Kubernetes (and a default `kind` cluster, which this deployment uses) stores Secret data in etcd **base64-encoded, not encrypted** — anyone with access to the etcd data store or a sufficiently-privileged `kubectl` context can read Razorpay keys, SMTP credentials, etc. in plaintext. This is a well-known Kubernetes default, not a defect specific to this project, but worth calling out since Razorpay's live secret key would eventually live here.

**Remediation:** for a real production cluster, enable [Kubernetes encryption at rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/) for Secrets, or use a dedicated secret manager (Sealed Secrets, SOPS, or a cloud KMS-backed secret store) instead of raw `Opaque` Secrets. Lower priority than the TLS gap above, and arguably moot until this moves off a single-EC2/kind setup — flagged for awareness, not blocking.

## LOW — No NetworkPolicy; all pods can reach each other unrestricted

No `NetworkPolicy` manifests exist in `deploy/k8s/`. Any pod in the `premal-kaizen` namespace (or, depending on cluster CNI defaults, any pod in the cluster) can reach any other pod/service with no network-layer restriction. For this 3-service, single-namespace, single-tenant deployment the practical risk is low — there's no multi-tenant isolation requirement yet — but it's a standard defense-in-depth gap.

## LOW — Admin panel exposure is operator-dependent

Confirmed via `deploy/README.md` and `deploy.sh`'s printed output: the admin Service is a `NodePort` (30001) like the other two, and the script explicitly warns not to open it to `0.0.0.0/0`, offering an SSH-tunnel alternative. This is a **correctly documented** risk, not a code defect — the actual exposure depends entirely on whether the operator follows that guidance when configuring the EC2 security group. Flagging because the master audit asked specifically about admin-panel exposure; the control here is procedural/documentation, not technical enforcement (nothing stops a security-group rule from opening 30001 to the world).

## Informational / Verified-Good (evidence of what was checked)

| Check | Result |
|---|---|
| Containers run as root? | **No.** All three Dockerfiles create a fixed, non-dynamic UID/GID (`10001:10001`) via `useradd`/`groupadd`, and all three K8s Deployments additionally set `securityContext: { runAsNonRoot: true, runAsUser: 10001, runAsGroup: 10001 }` as defense in depth — a pod refuses to start rather than silently running as root if this ever drifts. |
| Secrets baked into images? | **No.** `NEXT_PUBLIC_API_URL` (the only build-arg) is a public API URL, not a credential. Real secrets (`RAZORPAY_KEY_SECRET`, `SMTP_PASSWORD`, etc.) are injected at runtime via the K8s Secret / `--env-file`, never `COPY`'d or `ARG`'d into any image layer. |
| Health checks | Each Dockerfile has a `HEALTHCHECK` hitting a real endpoint (not a hardcoded always-pass check); the API's K8s manifest correctly uses **two different** probes — liveness on `/api/health` (no DB dependency, won't restart-loop on a transient DB blip) and readiness on `/api/health/ready` (checks DB connectivity) — verified against the actual controller code. |
| Resource limits | Set on all three Deployments (CPU 100–150m requests / 400–500m limits, memory 192–256Mi requests / 384–512Mi limits) — prevents one runaway pod from starving the others on the single EC2 node. |
| Host data permissions | `deploy.sh` `chown`s the persistent-data directory to the exact non-root UID/GID the containers run as and `chmod 700`s it (owner-only, not world- or group-writable) — verified least-privilege. |
| Secrets never committed | `02-secret.yaml` is gitignored (only the `.example` template is tracked); `deploy.sh` `chmod 600`s it on creation; the script explicitly never prints secret values, only key names. |
| SQLite multi-writer risk | Correctly mitigated: `replicas: 1` + `strategy: Recreate` (not `RollingUpdate`) on the API Deployment, with an explicit comment warning against ever raising replica count — a second replica would corrupt/lock the single SQLite file. |
| Image provenance | `imagePullPolicy: Never` on all three Deployments — images are built locally and loaded directly into `kind`, never pulled from a registry, eliminating a supply-chain vector (no risk of a registry serving a tampered image under the same tag). |
| Lockfile-frozen installs | Every Dockerfile runs `pnpm install --frozen-lockfile` — a build can never silently drift onto different dependency versions than what's checked into `pnpm-lock.yaml`. |

## Cross-reference: dependency vulnerabilities apply to these images too

The Critical/High findings in `DEPENDENCY_SECURITY_REPORT.md` (`next@15.0.0`, bundled `multer@2.0.2`) are baked into whatever gets built from these exact Dockerfiles — fixing the dependency versions is a prerequisite for these container images being production-safe, independent of the infrastructure config itself being sound.

## Not covered in this pass

- No actual image vulnerability scan (e.g. Trivy/Grype) was run against the built images — only a source-level dependency audit (see `DEPENDENCY_SECURITY_REPORT.md`). No such scanner was available/installed in this environment.
- No live deployment was performed — `deploy.sh` was read and reasoned about, not executed (it targets a real EC2 instance; running it was out of scope and would require explicit approval plus a real AWS target).
- Kubernetes RBAC configuration (service account permissions within the cluster) was not reviewed — the manifests don't define any custom RBAC, meaning default/no additional restriction beyond the namespace itself; low priority for a single-tenant 3-service deployment but worth a look before scaling.
