# PRODUCTION_SECURITY_CHECKLIST.md

Date: 2026-11-11. Builds on `docs/production/SECURITY-REPORT.md` from the prior
hardening pass (still valid, not superseded) — this file focuses specifically on
Issue E's secrets audit and the production-networking requirements from this pass.

## Secrets — audited against actual code, not assumed

- [x] **No production secrets in Git.** `deploy/k8s/02-secret.yaml` (the real one,
  with actual values) is gitignored; only `02-secret.example.yaml` (placeholders) is
  tracked. `apps/api/.env` is gitignored and was never tracked.
- [x] **No hardcoded admin passwords anywhere in application code.** The admin
  account is created exclusively through `IdentityService.bootstrapFirstAdmin`
  (self-disables permanently once any admin exists) or `createAdmin` (requires an
  already-authenticated SUPER_ADMIN) — both hash the password via the same bcrypt
  path every account uses, confirmed by code read.
- [x] **`JWT_SECRET` verified NOT used by the authentication implementation** — grep
  confirms zero matches outside `.env`/the Secret template itself. Sessions are a
  random opaque token in the `Session` table (`crypto.randomBytes`-based, confirmed),
  not a signed JWT. This is existing, working behavior — not something that needs
  fixing, just something worth knowing so nobody assumes rotating `JWT_SECRET` has any
  security effect today.
- [x] **Placeholder values are no longer silently treated as valid.**
  `deploy.sh` now explicitly reports Razorpay/SMTP as **DISABLED** (not just "a
  warning") when still placeholders, and `DEPLOY_MODE=production` **hard-fails**
  deployment if either is still a placeholder — these integrations are load-bearing
  for real customer use (OTP login needs SMTP; checkout needs Razorpay).
  `DEPLOY_MODE=staging` (the default) keeps the previous graceful-degradation
  behavior for local/test use.
- [x] **Secret values are never printed** — confirmed in both the old and new
  `deploy.sh`: every check greps for key *names* and whether a value is still the
  literal placeholder string, never logs the actual value.
- [ ] **AWS Secrets Manager / SSM Parameter Store** — recommended, **not
  implemented**. The current mechanism (a local, gitignored, `chmod 600` YAML file on
  the EC2 host) is acceptable for a single-instance deployment but is a real
  improvement opportunity: it means the secret's blast radius is "anyone with root/SSH
  on this one EC2 instance," versus a properly-scoped IAM role reading from Secrets
  Manager. Implementing this requires an IAM role + Secrets Manager setup — an AWS
  change requiring your separate approval, not done here.

## Authentication / OTP / webhook verification — re-confirmed this pass by code read

- **OTP**: mandatory two-step login (password never alone creates a session),
  max-5-attempt lockout, single-use tokens — unchanged since the prior hardening pass,
  re-confirmed present in `identity.service.ts`.
- **Admin authentication**: bcrypt-hashed passwords, admin accounts bypass the OTP
  step by design (no OTP UI in the admin app — documented, deliberate), the bootstrap
  endpoint is the only unauthenticated admin-creation path and self-disables
  permanently.
- **Razorpay webhook signature validation**: HMAC verified over the **raw** request
  body (`app.use(NestFactory.create(..., { rawBody: true }))` in `main.ts`), confirmed
  in `payments.service.ts`'s `handleWebhook` — plus an independent re-fetch of the
  payment from Razorpay's own API before ever marking an order paid (defense in
  depth, not signature-verification alone).
- **SMTP**: gracefully degrades (logs, never crashes) when unconfigured; when
  configured, every send is logged success/fail without ever logging the credential.

## Production networking requirements (documented, not yet implemented)

None of the following exist in this repo yet — flagged honestly as open work, not
glossed over:

- [ ] HTTPS / TLS anywhere.
- [ ] HTTP→HTTPS redirect.
- [ ] A reverse proxy or load balancer in front of the NodePorts.
- [ ] Correct proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`) being read by the
      API — not currently needed since there's no proxy yet, but will matter the
      moment one is added (Nest's `trust proxy` equivalent / Express setting).
- [ ] A real domain for storefront/admin/api (deliberately not invented — see
      `PRODUCTION_DEPLOYMENT_GUIDE.md` for the exact placeholders to replace once you
      have one).

## Already satisfied (verified, not assumed)

- [x] CORS allowlist (not a wildcard) — `createCorsOriginValidator` in
  `common/config/cors.ts`, driven by `CORS_ALLOWED_ORIGINS`, which `deploy.sh` renders
  to the actual storefront/admin URLs at deploy time.
- [x] Rate limiting on auth-sensitive routes (`@Throttle`), confirmed via
  `throttle-wiring.spec.ts` and a live brute-force test in the prior hardening pass.
- [x] Request size limits — Express/Nest's default body-parser limits apply; no
  custom oversized-payload handling was found necessary or missing.
- [x] Admin route protection — `AuthGuard` + `AdminGuard` + `PermissionGuard` on every
  admin-only controller, confirmed by code read across `customer-admin`, `inventory`,
  `promotions`, `settings`, `admin-management` controllers.
- [x] No public database access — SQLite is a local file on the EC2 host inside the
  kind node, never exposed via any Service/NodePort. Postgres/RDS, once adopted, must
  stay in a private subnet with a security group that only allows the API's own
  security group — not done yet since RDS doesn't exist yet, but the requirement is
  recorded here for when it does.
- [x] NodePorts are not unnecessarily exposed — only 3 ports exist (30000/30001/30002),
  all documented, with the admin port (30001) specifically called out as not-for-public
  exposure (SSH tunnel recommended instead).
- [x] Non-root containers, resource requests/limits, fixed security contexts on every
  Deployment — confirmed by reading all 3 manifests directly this pass (unchanged,
  already correct from the prior hardening pass).

## Read-only root filesystem / dropped capabilities — audited, not yet applied

Checked this pass whether `readOnlyRootFilesystem: true` and `capabilities: {drop:
[ALL]}` could be added to the 3 Deployments without breaking anything. **Not applied
in this pass** — doing so safely requires verifying every directory each app actually
writes to at runtime (Next.js's `.next` build output is baked into the image and not
written to at runtime, so frontends are likely safe; the API writes to the mounted
`uploads/` and `prisma/dev.db` paths, which are already PVC-backed, but NestJS/Node
itself may write temp files elsewhere e.g. `/tmp`). This needs an actual test run
against a live container (blocked on the same local Docker-daemon unavailability noted
elsewhere) before enabling in a way that doesn't silently break pod startup — flagged
as a real, scoped follow-up rather than applied speculatively, consistent with "do not
blindly apply production security settings if they prevent the application from
starting."
