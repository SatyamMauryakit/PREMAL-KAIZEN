# RELEASE-CHECKLIST.md

Date: 2026-11-11. Each item marked only on the basis of an actual check performed
(this pass or earlier this engagement, as noted) — never assumed.

- [x] Production code audit completed — `CODE-AUDIT.md`.
- [x] Critical bugs fixed — the known real bugs found this engagement (variant-selector
      stuck bug, cart-not-clearing-on-order, login-without-OTP, hero hover/wrapping,
      shop pagination/whitespace) are all fixed and live-verified.
- [x] No unresolved release-blocking security issues — `SECURITY-REPORT.md`; the only
      open dependency findings are confirmed dev-tooling-only.
- [x] API contracts verified — `API-CONTRACT-REPORT.md`, with an honest coverage key
      (live/unit/read) rather than a blanket claim.
- [x] Authentication and authorization verified — mandatory OTP, IDOR checks, rate
      limiting all live-tested this pass.
- [x] SQLite schema/migrations validated for the chosen architecture —
      `DATABASE-READINESS.md`. (PostgreSQL migrations explicitly out of scope this
      round — see `GITHUB-RELEASE-SUMMARY.md`.)
- [x] Razorpay integration verified — signature + independent API cross-check,
      webhook idempotency, live test-mode payment earlier this engagement.
- [ ] **S3 integration verified** — N/A for the chosen architecture (`STORAGE_DRIVER=local`
      is active; the S3 adapter exists in code but is unused and therefore not
      verified live). Not a blocker for this architecture; would need verification
      before ever switching `STORAGE_DRIVER=s3`.
- [ ] **Production Docker images build** — Dockerfiles inspected and confirmed correct
      (`DOCKER-READINESS.md`), but the actual `docker build` was **not run** this pass
      (local Docker daemon unavailable). This is a real open item, not checked off
      falsely — will be exercised as the first step of `deploy.sh` on the real EC2 host.
- [x] Production-like smoke tests pass — live OTP login, cart/checkout/order-clear,
      IDOR, brute-force lockout all re-run and passed this pass.
- [x] Regression tests pass — 386/386, unchanged baseline, `TEST-RESULTS.md`.
- [x] No production secrets committed — `.env`/`.env.example` checked,
      `seed-test-admin.js` and DB backup files added to `.gitignore` this pass
      specifically because they weren't excluded before.
- [x] Deployment scripts validated — `deploy.sh` read in full, matches the chosen
      architecture, previously documented as tested.
- [x] Health checks working — `/api/health` live-confirmed (200), Dockerfile
      `HEALTHCHECK` directives hit real endpoints.
- [ ] **Rollback scripts validated** — honestly, **not validated**, because a dedicated
      rollback script doesn't exist yet for this architecture. See `ROLLBACK.md` for
      the manual procedure that exists today and the recommended follow-up.
- [x] Documentation completed — this file plus the other 9 in `docs/production/`.

## Final status

**READY FOR GITHUB RELEASE, WITH TWO OPEN ITEMS CARRIED FORWARD HONESTLY:**
Docker images haven't been built locally (daemon unavailable — will be verified on the
real EC2 host, which is where they're built anyway in this architecture) and there is
no automated rollback script yet (manual procedure documented, real follow-up work).
Neither blocks a GitHub push of reviewed, tested, working code — they block declaring
the **EC2 deployment itself** fully de-risked. See `GITHUB-RELEASE-SUMMARY.md` for the
exact status statement and what still needs separate authorization.
