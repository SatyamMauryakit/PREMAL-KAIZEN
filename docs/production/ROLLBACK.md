# ROLLBACK.md

Date: 2026-11-11. **Honest gap, not glossed over**: unlike the rest of this release's
checklist, there is currently **no dedicated, tested `rollback.sh` script** for the
single-EC2 architecture. The mega-prompt's Phase 5 asked for one as part of a
`deploy/production/scripts/` tree built for the 3-EC2 architecture that was explicitly
declined — building a new rollback script for the architecture actually in use is real,
not-yet-done follow-up work, not something safe to fabricate as "already validated" in
this report.

## What rollback looks like today (manual procedure)

Because `deploy.sh` builds images directly on the EC2 host from whatever Git commit is
checked out (no image registry, no version-tagged images), a rollback today means:

1. On the EC2 host, inside the cloned repo: `git log --oneline` to find the previous
   known-good commit.
2. `git checkout <previous-commit>` (or `git revert` if the bad change was already
   pushed and you want a clean history instead of a detached state).
3. Re-run `./deploy.sh` — it rebuilds all 3 images from that checked-out commit and
   re-applies the k8s manifests. `deploy.sh` is documented as safe to rerun at any time.
4. **Database**: since SQLite is a single file on the host's mounted data directory
   (not versioned alongside the code), a rollback does **not** automatically revert any
   schema migration that ran under the bad release. If the bad release included a
   destructive-in-spirit migration, the data itself needs its own recovery plan
   (restore from a pre-deploy backup — see below), separate from rolling back the code.
5. Verify health the same way as a fresh deploy (`/api/health`, `/` on both frontends).

## Backup-before-deploy recommendation

Before any production deploy that changes the schema, copy
`/opt/premal-kaizen/data/db/dev.db` to a timestamped backup on the host first (the same
pattern already used this engagement for the sample-data cleanup:
`backups/dev.db.pre-cleanup.<timestamp>.bak`). This is a manual step today, not yet
automated into `deploy.sh` itself.

## What IS safe and already true

- `deploy.sh` never resets the Kubernetes cluster, never overwrites an existing
  `02-secret.yaml`, and never touches the persistent data directory's existing
  contents beyond creating what's missing — confirmed by reading the script itself.
  This means a bad rerun can't itself destroy secrets or data; the risk is specifically
  around schema migrations outliving a code rollback, not the deploy script's own
  behavior.

## Recommended follow-up (not done in this pass)

A real `deploy/scripts/rollback.sh` that: snapshots the DB before every deploy
automatically, tags the exact commit that was last known-good, and can redeploy that
commit + restore that snapshot in one command. Flagging this clearly as the single
weakest point in an otherwise reasonably mature deployment setup, rather than
pretending it's solved.
