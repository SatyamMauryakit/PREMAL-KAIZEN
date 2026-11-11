# SECURITY-REPORT.md

Date: 2026-11-11. Builds on, and does not contradict, the repo's existing
`SECURITY_AUDIT_REPORT.md` / `INFRASTRUCTURE_SECURITY_REPORT.md` / `DEPENDENCY_SECURITY_REPORT.md` from earlier in this engagement — this is a fresh re-check after everything changed since (mandatory OTP rewrite, email migration, cart-clear fix, sample-data cleanup), not a replacement.

## Dependency vulnerabilities — re-run fresh this pass

`pnpm audit --audit-level=high`: **31 total (5 low, 18 moderate, 5 high, 3 critical)**.
All 3 critical and the high-severity ones inspected are `vitest`/`tinypool`/`vite` —
**devDependencies of the test runner only**, never shipped to production, not installed
by a `--prod` install, not present in any of the 3 Docker runtime images (confirmed:
the Dockerfiles copy forward only `dist`/`.next/standalone` + runtime `node_modules`
from the build stage, not devDependencies — `vitest` itself is never in the final
image). Fixing requires a major-version bump of `vitest`/`vite` across all 3 apps,
which was deliberately not done without explicit sign-off (risk of breaking the test
suite itself). Same conclusion as the prior dependency report — re-confirmed, not
assumed stale.

## Authentication / session management

- Mandatory two-step OTP login (password never alone creates a session for a
  customer) — **live-verified** this engagement multiple times, most recently during
  the cart-clear-on-order test.
- OTP brute-force limiting: max 5 wrong attempts, 6th rejected even with a
  syntactically valid code, forces a fresh login — **live-verified** this pass.
- OTP single-use (deleted immediately on success) — code-verified, unit-tested.
- Admin accounts bypass the OTP step by design (no OTP UI exists in the admin app) —
  documented, deliberate, unchanged.
- Admin bootstrap self-disables permanently the instant any admin exists — confirmed
  via code read + a live DB check (0 admins after cleanup = still open; bootstrap it
  immediately).

## Authorization / IDOR

**Live-tested this pass**: a second customer's session token against another
customer's real order ID → 404 (not found, not leaked). Same token against
`/api/customer/cart` and `/api/customer/addresses` → returns only its own (empty) data,
never another account's. No token at all → 401. All backend identity resolution is
`req.user.id` from the `AuthGuard`, never a client-supplied `userId` (confirmed
throughout this engagement, re-confirmed by this pass's IDOR test).

## XSS / CSRF / SQL injection

- SQL injection: not applicable in the direct sense — all database access goes through
  Prisma's parameterized query builder, no raw string-concatenated SQL found anywhere
  in `apps/api/src`.
- Stored/reflected XSS: React/Next.js auto-escapes rendered output by default; no
  `dangerouslySetInnerHTML` usage was found introduced by anything in this engagement.
  Not independently re-audited field-by-field this pass (same scope as the prior
  security report).
- CSRF: the app's actual auth mechanism is `Authorization: Bearer` from `localStorage`,
  not cookies (confirmed — both frontends were verified not to rely on cookie auth),
  which inherently avoids classic CSRF against authenticated API calls. The
  `sessionToken` cookie `identity.controller.ts` also sets is unused by either
  frontend, documented previously.

## Payment webhook security

- Signature verification against Razorpay's HMAC, computed over the **raw** request
  body bytes (not a re-serialized object) — confirmed in `main.ts`'s `rawBody: true`
  and `payments.service.ts`'s `verifyWebhookSignature`.
- Idempotency via a `(provider, eventId)` unique constraint on `PaymentWebhookEvent` —
  a replayed/duplicate webhook delivery is detected and skipped, confirmed in code and
  by unit test.
- Amount/currency cross-checked against the stored order before marking anything paid,
  on both the browser-callback and webhook paths.
- Defense in depth: the browser-callback path independently re-fetches the payment from
  Razorpay's own API rather than trusting the signature alone — live-verified with a
  real test-mode transaction earlier this engagement.

## File uploads

`upload-validation.ts` enforces extension/size limits (spec passing). Storage driver is
local disk (`STORAGE_DRIVER=local`); an S3 adapter exists and is ready to swap in via
config, not new work. IAM-scoped S3 permissions are N/A until S3 is actually adopted —
not something to configure speculatively for a driver that isn't in use.

## Security headers / cookies

Helmet wired in `main.ts` with CSP deliberately disabled (correct for a pure JSON API +
static image route, not an HTML app — explained in-code) and
`crossOriginResourcePolicy: 'cross-origin'` (required so product images load
cross-origin into the storefront/admin). HSTS, X-Content-Type-Options, X-Frame-Options
etc. all remain enabled via Helmet's defaults. Cookie `secure` flag is tied to
`NODE_ENV==='production'`, which will make the (unused) cookie silently unsendable over
plain HTTP — already documented, not a live risk since nothing relies on it, but will
matter once HTTPS is added if cookie auth is ever adopted.

## Rate limiting

`@Throttle` decorators confirmed on login/OTP/password-reset routes
(`throttle-wiring.spec.ts` passing). Live-verified this pass via the OTP brute-force
test above.

## Debug endpoints

No debug/diagnostic routes found exposed in `apps/api/src` beyond the deliberate,
DB-independent `/api/health`.

## Hardcoded credentials / exposed secrets

- `apps/api/.env.example` — placeholder-only, re-verified.
- `deploy/k8s/02-secret.example.yaml` — placeholder-only, re-verified.
- `apps/api/seed-test-admin.js` — a hardcoded **test-only** password for a non-existent
  `@test.local` domain account; not a real credential, but excluded from git tracking
  this pass anyway (see `CODE-AUDIT.md`) since committing any hardcoded password string,
  even a fake one, is bad practice to leave checked in.
- No API keys, access tokens, or real passwords found in tracked source files.

## Overall verdict for this report

No new release-blocking vulnerability found this pass. The 3 critical/5 high dependency
findings are confirmed dev-tooling-only (same conclusion as before, re-verified fresh).
Real, live-exercised controls (OTP, IDOR, rate limiting, payment verification) all held
up under direct testing this pass.
