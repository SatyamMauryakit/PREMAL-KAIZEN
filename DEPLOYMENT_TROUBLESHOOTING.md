# DEPLOYMENT_TROUBLESHOOTING.md

Date: 2026-11-11. Practical runbook. Always `export KUBECONFIG=~/.kube/premal-kaizen.config`
first — this cluster deliberately never touches any other kubeconfig/context on the host.

## "Deployment failed at the migration stage"

```bash
kubectl -n premal-kaizen logs job/premal-api-migrate --all-containers
kubectl -n premal-kaizen describe job/premal-api-migrate
```
The API Deployment is deliberately left scaled to 0 when this happens — the app never
starts against a database with unverified migrations. Fix the root cause (common
ones: a migration file genuinely incompatible with existing data, a permissions issue
on the mounted `dev.db`), then rerun `./deploy.sh` — it deletes the old failed Job and
tries again cleanly. **Never** work around this by manually running `prisma migrate
reset` or `db push --force-reset` against the mounted file — both are destructive and
exactly what this script is built to avoid.

## "`curl http://<public-ip>:30002/...` times out, but everything else looks fine"

This is very likely **not a bug** — see `DEPLOYMENT_AUDIT_REPORT.md` Issue A. Check in
this order:
1. `curl http://127.0.0.1:30002/api/health` **on the EC2 host itself** — if this
   works, the app and cluster are fine.
2. Run the exact same curl from a machine that is **not** this EC2 instance (your
   laptop, a phone on cellular data, etc.). If that also fails, it's a real external
   reachability problem — check the EC2 security group next (`30002` must allow your
   IP or `0.0.0.0/0`), then the instance's own OS firewall (`sudo ufw status` /
   `sudo iptables -L`).
3. If the host-curling-its-own-public-IP case is specifically what's failing while
   step 2 succeeds, that's the expected, harmless hairpin-NAT limitation — not
   something to "fix."

## "`storageclass.storage.k8s.io \"premal-local\" not found`"

Should no longer happen — `deploy/k8s/03-pvc.yaml` now defines the `StorageClass`
object. If you still see this on an existing cluster from before this fix: rerun
`./deploy.sh` (it reapplies `03-pvc.yaml`, which is purely additive and safe), or
manually: `kubectl apply -f deploy/k8s/03-pvc.yaml`. This does **not** touch the
existing PV's `hostPath` or any data already on disk.

## "Pod stuck in `Pending`"

```bash
kubectl -n premal-kaizen describe pod -l app=<premal-api|premal-storefront|premal-admin>
```
Look at the `Events` section at the bottom. Common causes on this single-node setup:
insufficient CPU/memory on the node for the requested `resources.requests` (check
`kubectl top nodes` if metrics-server is installed, or just `free -m`/`nproc` on the
EC2 host against the thresholds in `PRODUCTION_DEPLOYMENT_GUIDE.md`), or (for the API
specifically) the PVC not yet `Bound` — check `kubectl -n premal-kaizen get pvc`.

## "Pod stuck in `CrashLoopBackOff`"

```bash
kubectl -n premal-kaizen logs <pod-name> --previous
```
`--previous` is important — it shows the log from the crashed instance, not the
freshly-restarted one that hasn't logged anything yet. For the API specifically, a
crash loop right after a schema change almost always means the migration Job didn't
actually run or didn't actually succeed before the Deployment was applied — re-check
Stage 6's output from your last `./deploy.sh` run.

## "`pnpm: not found` inside a container"

Expected and correct — `pnpm` is deliberately not installed in any runtime image (see
`DEPLOYMENT_AUDIT_REPORT.md` Issue B). Use `node_modules/.bin/<tool>` directly, or
`npx <tool>` (npm/npx does ship with the base `node` image), never `pnpm exec` inside
a running container.

## "I need to roll back to a previous release"

See `docs/production/ROLLBACK.md` from the prior hardening pass — still accurate, not
superseded by this pass. Short version: `git checkout <previous-good-commit>` on the
EC2 host, rerun `./deploy.sh` (it rebuilds and retags images from that commit). A
schema migration from the bad release is **not** automatically undone by a code
rollback — restore from a pre-deploy `dev.db` backup separately if that's also needed.

## "How do I check what release is actually running?"

```bash
kubectl -n premal-kaizen get deployment premal-api -o jsonpath='{.spec.template.spec.containers[0].image}'
```
This now shows the real release tag (`premal-api:<git-sha>-<timestamp>`), not just
`:local` — introduced in this pass specifically so this question has a real answer.

## "Is this actually production-ready?"

Only if every item in `docs/production/RELEASE-CHECKLIST.md` (prior pass) AND this
pass's open items (HTTPS/domain, AWS Secrets Manager, the PostgreSQL migration if you
want it) are resolved. `deploy.sh` itself refuses to print "DEPLOYMENT SUCCESSFUL"
unless migrations and localhost health checks both genuinely passed — but that's a
narrower claim than "ready for real customers," which also needs the networking/domain
work this script deliberately doesn't automate.
