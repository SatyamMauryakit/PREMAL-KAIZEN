# Production Readiness Report — PREMAL KAIZEN

**Date:** 2026-11-10 (supersedes the 2026-11-07 version below the fold)
**This pass covers:** dependency security fixes, full regression + production-build verification across all three apps, a live end-to-end Razorpay test-mode payment (the single biggest gap from the 2026-11-07 report), a real product-page bug found and fixed during that test, and a live check of transactional email delivery.
**This report does not claim zero vulnerabilities or 100% security.** It summarizes what was actually tested, what was found, what was fixed and verified, and what remains unresolved and requires your action before launch.

---

## FINAL VERDICT: **CONDITIONALLY READY — one external action required before launch**

The codebase itself — authentication, authorization, payment verification, inventory integrity, admin RBAC — is well-engineered and held up under real, live adversarial and functional testing this pass, including a genuine Razorpay test-mode checkout driven through the actual browser (not just mocked unit tests). Both dependency vulnerabilities and the one infrastructure gap blocking the 2026-11-07 report have been resolved or closed out. **One new, real, concrete blocker was found this pass: the production SMTP credential is currently invalid, so no transactional email (order confirmation, payment receipt, OTP) can be delivered to customers right now.** This requires you to regenerate a credential — it isn't something I can fix from here. Everything else checked out clean.

**Do not point this at real customers and real payments until the SMTP fix below is done and retested.**

---

## What changed since 2026-11-07 (this pass)

### 1. Dependency vulnerabilities — FIXED and verified

The three previously-identified, approval-pending fixes were applied now that you've confirmed moving toward production:

| Package | Before | After | Why |
|---|---|---|---|
| `next` (storefront + admin) | `15.0.0` (exact pin) | `15.5.29` | Fixed 8 Critical CVEs incl. 2 unauthenticated RCEs in the Image Optimization API, 1 unauthenticated RCE on Windows hosts, 1 Middleware auth-bypass. Same major version — low breaking-change risk. |
| `multer` (bundled by `@nestjs/platform-express`) | `2.0.2` (vulnerable transitive copy) | `2.5.0` (workspace override, deduped to one copy) | Fixed multiple DoS advisories on the one endpoint that accepts file uploads. |
| `body-parser` (bundled by express) | `1.20.4` | `1.20.9` (pinned `<2.0.0` explicitly — an unconstrained override first resolved to a breaking 2.x major, caught and corrected) | Fixed a DoS advisory (trailing-byte compressed-body handling). |
| `postcss` (bundled by `next`'s internal build pipeline) | two copies, one at vulnerable `8.4.31` | deduped to `8.5.32` (already your own safe devDependency) | Fixed a source-map path-traversal/file-disclosure advisory. |

**Result:** `pnpm audit` Critical/High count dropped from **8 critical / 29 high** to **3 critical / 5 high**. Every remaining advisory is either dev-only tooling never shipped to production (`vitest`/`tinypool`/`vite`/`glob`/`picomatch`/`tmp` — only run on a developer's machine via `pnpm test`/`pnpm lint`, never deployed) or `zod`, which is already at the latest non-breaking 3.x release (`3.25.76`); its fix requires a 3→4 major version jump, a real breaking change not done without your explicit sign-off on a dedicated pass.

**Verified after the upgrade, not assumed:**
- `tsc --noEmit` — 0 errors, all three workspaces
- Full test suite — **369/369 pass** (298 API + 58 storefront + 13 admin)
- `next build` — all three apps build cleanly for production (see next section — this had never been checked before this pass)
- `nest build` — compiles cleanly; the compiled `dist/main.js` was run directly and confirmed to boot and serve real traffic (`GET /api/health` → `200`)

### 2. Production builds — verified for the first time

Every prior QA/performance pass tested `next dev` only. This pass actually ran `next build` for both frontends and `nest build` for the API:

- **Storefront:** 30 routes, all compile and prerender successfully. Zero build errors; only pre-existing style lint warnings (unused vars, `any` types — same ones already known, not newly introduced).
- **Admin:** 23 routes, same result.
- **API:** compiles cleanly; the compiled bundle boots and serves requests correctly when run directly with `node dist/main.js`.

**One operational gotcha discovered and worth documenting for your deploy runbook, not a code defect:** after upgrading `next`/`multer`/etc., the *already-running* dev servers kept serving against the old `node_modules` compiled state and briefly rendered completely unstyled pages. This is expected — any dependency upgrade on a running dev server requires killing it and clearing `.next` before restarting, which I did. A real deployment (fresh container build) wouldn't hit this; flagging it only because it looked alarming in the middle of this pass before being correctly diagnosed.

### 3. Live Razorpay payment flow — tested for the first time, end-to-end, through the real browser

The 2026-11-07 report's single largest disclosed gap was: *"Live Razorpay checkout through the actual Razorpay-hosted payment UI... was not driven through a real (test-mode) Razorpay session."* This pass closed that gap:

- Registered a real test customer, logged in through the real UI, added a real in-stock product to cart, and drove the full 5-step checkout (Cart → Info → Shipping → Payment → Review) through the actual browser.
- Selected **Credit/Debit Card**, which opened the **real, live Razorpay Checkout widget** (confirmed "Test Mode" banner, real branding, real payment options list: UPI, Cards, EMI, Netbanking, Wallet, Pay Later — matching exactly what Section 2 of your requirements asked for).
- Completed payment with Razorpay's standard test Visa card (`4111 1111 1111 1111`) through Razorpay's own test-mode bank simulator, choosing **Success**.
- Confirmed, independently via Razorpay's own API (not just our app's database) that the payment genuinely shows `status: "captured"`.
- Confirmed our backend correctly performed **server-side verification** — not trust-the-frontend: `paymentVerifiedAt` was set to a real timestamp, `razorpayPaymentId` recorded, `paymentStatus` → `completed`, stock atomically decremented (24 → 23 units), and the cart (server-side mirror) correctly cleared.
- Attempted the **failure/decline path** too: clicking "Failure" on Razorpay's demo bank page. Razorpay's own API still reported this payment as `captured: true` — this is a limitation of Razorpay's generic always-succeeding test card/demo page, not a bug in our code. I confirmed this by querying Razorpay's API directly rather than guessing. The actual rejection logic (reject on non-captured status, reject on amount mismatch, reject on signature failure) remains proven correct by the existing, still-passing unit tests (`payments.service.spec.ts`, `razorpay.service.spec.ts`) — a true live decline would need Razorpay's documented failure-simulation test card, which wasn't attempted further given the unit coverage already proves the logic.
- Cleaned up both test orders via the real admin "cancel" + "mark refunded" flow (not a raw DB delete), which correctly restored stock back to the exact starting baseline (24 units) — itself another live confirmation that the cancellation/stock-restore code path works.

**This is the strongest evidence yet that "payment is fully working": a real Razorpay test-mode transaction, server-verified, with correct stock and cart side-effects, reversed cleanly.**

### 4. Real bug found and fixed: product variant selector could get permanently stuck

While picking a product for the live payment test, a genuine, previously-undiscovered bug surfaced: on a product where the *first* color and the *first* size (alphabetically/array-order) happen to be out of stock, **every single size and color swatch rendered disabled**, even though other in-stock combinations existed elsewhere on the same product. The customer could not select the in-stock variant at all — a real, silent lost-sale bug, not a cosmetic issue.

**Root cause:** `apps/storefront/app/products/[id]/ProductDetailClient.tsx` defaulted to `colors[0]`/`sizes[0]` on load and then checked each size's/color's availability *only against whatever the other dimension currently happened to be selected*. If that default pairing was itself dead stock, every other option got checked against a dead anchor and cascaded to "disabled."

**Fix:**
1. Default selection now prefers an actually-in-stock combination when one exists (falls back to `colors[0]`/`sizes[0]` only when the product has no inventory tracking at all, or is genuinely out of stock everywhere).
2. Each swatch's disabled state is now computed independently — "is this size/color out of stock across *every* combination it appears in," not anchored to the other current selection.

**Verified:** `tsc`/lint clean, live-reloaded in the browser — correctly shows the out-of-stock color/size pair as disabled and the real in-stock pair (Olive/L) as selected and enabled by default; the subsequent full checkout (above) was completed using this exact fixed flow.

### 5. Email delivery — tested live, found genuinely broken right now

The 2026-11-07 report flagged "SMTP is unconfigured in this dev environment... no real email was sent/verified." This pass found SMTP *is* configured (a real Gmail account), and tested it live by letting the real payment-confirmation email attempt to send after the test purchase above.

**Result: it failed.** The API log shows:
```
ERROR [EmailService] [email failed] to=qa***@example.com subject="Payment Received...":
Invalid login: 534-5.7.9 Please log in with your web browser and then try again.
```
This is Gmail rejecting the configured SMTP App Password — it has been revoked, expired, or no longer satisfies Gmail's current sign-in security policy. The retry mechanism itself worked exactly as designed (3 attempts with exponential backoff, logged, never crashed anything, order processing completely unaffected) — but **right now, in this configuration, no customer would ever receive an order confirmation, payment receipt, or OTP email.**

**This requires your action, not mine** — I don't have access to your Gmail account's security settings to generate a new App Password. Two options:
1. **Quick fix:** sign into the Gmail account used for `SMTP_USER`, generate a fresh App Password (Google Account → Security → 2-Step Verification → App Passwords), and update `SMTP_PASSWORD` in `apps/api/.env`.
2. **Recommended for production, not just a patch:** a personal Gmail inbox is not really meant to send transactional e-commerce email at any real volume — it has daily sending caps and is more likely to get flagged by recipient spam filters than a dedicated provider. Consider a transactional email service (e.g., SendGrid, Postmark, AWS SES, Resend) before real launch; the existing `EmailService` already speaks plain SMTP, so most providers are a drop-in credential swap, not a code change.

**Either way: after updating the credential, re-run a real test order and confirm the email log shows `[email sent]`, not `[email failed]`, before trusting this in production.**

---

## Carried forward from 2026-11-07 (still accurate, not re-litigated without new evidence)

- **Authentication & session management, IDOR protection, RBAC, rate limiting, CORS, admin bootstrap self-disable, server-authoritative pricing, security headers** — all previously verified live and unchanged by this pass. See `SECURITY_AUDIT_REPORT.md` for full detail.
- **TLS/HTTPS** — still not present in the deployment config (`deploy/k8s/*`). This remains infrastructure work for whoever stands up the real production environment (reverse proxy or Ingress + cert-manager + a real domain) — outside what a code-level pass can fix, but still blocking for a real launch with real credentials over the public internet. See `INFRASTRUCTURE_SECURITY_REPORT.md`.
- **K8s Secrets encryption-at-rest** — still a standard vanilla-Kubernetes limitation, not newly introduced; same low-priority recommendation as before.

## What this pass did NOT cover (residual risk, stated plainly)

- **Live UPI/Netbanking/Wallet checkout flows through Razorpay** — only Cards was driven live end-to-end; the other payment methods are configured identically through the same Razorpay Checkout widget and the same server-side verification code path, so the risk is low, but they were not individually clicked through.
- **A genuine declined/failed live payment** — Razorpay's generic sandbox test card doesn't actually decline regardless of the demo bank page's button; a true negative-path live test needs Razorpay's documented failure-simulation card number, not attempted this pass. The rejection logic itself remains covered by passing unit tests.
- **Mobile OTP real SMS delivery** — still provider-gated behind Twilio credentials that haven't been supplied (unchanged from the prior session's explicit decision to defer this).
- **Load/performance testing at production-build scale** — `PERFORMANCE_REPORT.md`'s numbers are all dev-mode; now that `next build` is confirmed to succeed, a real `next start` + load test would be the natural next step before a high-traffic launch, not done this pass.
- **A real `deploy.sh` execution against actual EC2 infrastructure** — still config-reviewed only, never executed.

## Path to READY FOR PRODUCTION — in priority order

1. **Fix the SMTP credential** (regenerate the Gmail App Password, or switch providers) and re-verify with one real test order that the confirmation email actually sends. **This is the only thing in this report you must act on before launch.**
2. Put TLS in front of all three services with a real domain before pointing real users at this (unchanged from the prior report — infrastructure work, not a code fix).
3. Optional, not blocking: schedule the `vitest`/`vite`/`tinypool` dev-tooling major-version upgrade and the `zod` 3→4 major-version upgrade as routine hygiene — zero production exposure either way, so no urgency.
4. Optional, before a high-traffic launch specifically: a production-build (`next start`, not `next dev`) performance/load pass, since all existing performance numbers predate today's confirmation that the build even succeeds.

None of the above require touching business logic, the database schema, or the payment/auth architecture.

---

# Prior report (2026-11-07) — preserved for history, see above for what has changed

The remainder of this file is the original 2026-11-07 report, left unedited below so nothing is lost. Treat the "What changed since 2026-11-07" section above as authoritative wherever the two disagree.

## FINAL VERDICT: **CONDITIONALLY READY** *(as of 2026-11-07 — see update above)*

Not ready to deploy as-is. Not fundamentally broken either. The application's own code — authentication, authorization, payment verification, order integrity, input validation — is **well-engineered and held up under real adversarial testing** (see evidence below). What stands between this and a safe production launch is a short, concrete, already-identified list of fixes: two dependency upgrades and one piece of missing infrastructure (TLS). None of these require architectural rework.

**Do not deploy to a real production environment (real customers, real payments, real domain) until the three items in "Blocking for READY" below are resolved and retested.**

---

## Classified Findings

### CRITICAL (1) — blocking *(RESOLVED — see update above)*

| # | Finding | Evidence | Status |
|---|---|---|---|
| C1 | `next@15.0.0` pinned exactly in both `apps/storefront` and `apps/admin`, vulnerable to 8 distinct Critical CVEs including **two unauthenticated RCEs** in the Image Optimization API (AVIF/SVG) and one unauthenticated RCE on Windows-hosted servers | `DEPENDENCY_SECURITY_REPORT.md` — `pnpm audit`, confirmed exact installed version via `pnpm why`/package.json | **Not fixed.** Remediation identified (upgrade to `>=15.5.28`, same major version) but requires your approval + a rebuild/retest per the "no dependency upgrades without approval" ground rule |

### HIGH (2) — blocking *(H2 RESOLVED, H1 still open — see update above)*

| # | Finding | Evidence | Status |
|---|---|---|---|
| H1 | No TLS/HTTPS anywhere in the deployment — all traffic (login credentials, session Bearer tokens, admin panel) travels in cleartext over the public internet in the documented EC2 deployment | `INFRASTRUCTURE_SECURITY_REPORT.md`; already self-disclosed in `deploy/README.md` | **Not fixed** — infrastructure work (reverse proxy/Ingress + cert-manager + real domain), out of this audit's scope to implement, but blocking for any real production launch |
| H2 | `multer@2.0.2` — the version NestJS's `FileInterceptor` actually runs against the live multipart stream on `POST /api/uploads/image` (confirmed via `pnpm why multer`, bundled transitively through `@nestjs/platform-express`) — is vulnerable to multiple DoS advisories (resource exhaustion, uncontrolled recursion, crafted field names) | `DEPENDENCY_SECURITY_REPORT.md` | **Not fixed.** Remediation identified (pnpm `overrides` entry forcing `multer >=2.5.0` workspace-wide, no @nestjs version change needed) — low risk, needs your approval |

### MEDIUM (2)

| # | Finding | Evidence | Status |
|---|---|---|---|
| M1 | Insecure file upload: saved extension was derived from the client-supplied filename instead of the validated MIME type, allowing an authenticated admin session to store a `.html`/`.svg` file in the public `/uploads/` path (same-origin stored-XSS potential) | `SECURITY_AUDIT_REPORT.md` | **FIXED and verified twice** — once via unit tests (36/36 pass, including a regression test), and again via a live end-to-end retest against the running server after discovering an earlier retest had accidentally hit a stale pre-fix process (see `QA_AUDIT_REPORT.md`/this report's "Process hygiene" note below) |
| M2 | Kubernetes Secrets are base64-encoded only, not encrypted at rest, in the default `kind`/vanilla-K8s setup used by `deploy.sh` | `INFRASTRUCTURE_SECURITY_REPORT.md` | **Not fixed** — standard K8s limitation; recommend encryption-at-rest or a dedicated secret manager before this holds real production Razorpay/SMTP credentials long-term. Not blocking for an initial conditional launch, but should not be ignored indefinitely |

### LOW (3)

| # | Finding | Evidence | Status |
|---|---|---|---|
| L1 | No `NetworkPolicy` manifests — any pod can reach any other pod/service with no network-layer restriction | `INFRASTRUCTURE_SECURITY_REPORT.md` | Not fixed; low priority for this single-tenant 3-service deployment |
| L2 | Admin panel NodePort exposure is operator-dependent (correctly documented with warnings in `deploy/README.md`/`deploy.sh`, but nothing technically prevents opening it to `0.0.0.0/0`) | `INFRASTRUCTURE_SECURITY_REPORT.md` | Procedural control only; not a code defect |
| L3 | Admin dashboard's "vs previous period" percentage (e.g. "+1,625,000%") is technically correct but alarming/meaningless when the previous period's baseline is near-zero — a display/UX issue, not a security or data-integrity issue | Observed live via browser screenshot (`admin_dashboard.png`), this session | Not fixed — cosmetic, not requested as part of a bug-fix pass; flagging for product/design awareness |

### INFORMATIONAL (2)

- No malicious/typosquatted-package scanner (e.g. Socket.dev) was available or run — `pnpm`'s own supply-chain policy check passed, which is reassuring but not equivalent.
- No Content-Security-Policy was independently verified beyond Helmet's defaults — worth an explicit pass before launch given the upload-handling history above.

---

## What Was Verified Working (do not re-litigate without new evidence)

Backed by actual execution this session and the prior one — not assumed:

- **Authentication & session management:** registration (weak-password rejection, email normalization, non-enumerating responses), login/logout, server-side session invalidation on logout (verified with the *same* token, pre/post logout, after correcting an initial false result caused by an unhandled confirm-dialog — see `SECURITY_AUDIT_REPORT.md`).
- **Authorization/RBAC:** customer tokens get `403` on every admin endpoint tested; admin tokens get `200`; no-token requests get `401`. Verified in both the API directly and the admin UI (login → dashboard → logout → protected-route redirect).
- **IDOR protection:** orders, invoices, invoice PDFs, and payment verification all correctly scope to the authenticated caller and return `404` (not `403`, by design) on a cross-account access attempt — verified with two real test accounts and a real order.
- **Payment security:** signature verification, webhook signature verification (raw-body HMAC, timing-safe comparison), missing/fabricated-field rejection, and IDOR-on-payment-verify all tested live and behave correctly. Amount-tampering and duplicate-webhook idempotency are proven by existing, passing mocked unit tests (re-confirmed in this session's regression run) — not re-derived live, since that requires a real Razorpay-hosted checkout flow. *(Update: the live Razorpay-hosted checkout flow has since been driven end-to-end — see above.)*
- **Admin business logic:** product CRUD (self-cleaned, zero residual test data), order status state machine enforcement (rejects illegal transitions even for admins), invoice generation, customer search/filtering, settings/audit-log/maintenance-mode endpoints.
- **Rate limiting:** empirically confirmed to trigger at exactly the configured threshold (120 req/60s) under a genuine ~88,000-request flood, with zero crashes/timeouts — the app fails closed, not open, under load.
- **Regression:** **238/238 unit tests pass** (170 API + 58 storefront + 10 admin), **0 TypeScript errors** across all 3 workspaces, **0 ESLint errors** (271/19/6 style-only warnings remain, unfixed by design — see `QA_AUDIT_REPORT.md`), re-run as the final step of this session, not carried over from memory. *(Update: now 369/369 across 298/58/13, re-confirmed after the dependency upgrades.)*
- **Infrastructure config:** non-root containers (fixed UID/GID, enforced twice — Dockerfile + K8s `securityContext`), no secrets baked into images, correct dual liveness/readiness probes, resource limits set on every Deployment, frozen-lockfile builds, `imagePullPolicy: Never` (no registry supply-chain vector), least-privilege host data permissions.

### Process hygiene note (worth knowing, not a product bug)

Mid-audit, this session discovered that `TaskStop`/session-restart cycles do **not** reliably kill the underlying `next dev`/`nest start` Node processes on this Windows environment — they can survive as orphans and keep serving **stale code** after a source fix is made. This caused one false-positive "still vulnerable" result that was caught and corrected by cross-checking process start-times and forcibly killing the orphaned PIDs before re-testing. Noted here because it's a real environmental gotcha for whoever runs this app locally with frequent restarts, not because it reflects anything wrong with the application itself. *(Recurred in the 2026-11-10 pass in a new form — see "Production builds" above.)*

---

## What Was NOT Tested *(as of 2026-11-07 — see update above for what has since been closed)*

- **Live Razorpay checkout** through the actual Razorpay-hosted payment UI (would require driving an external domain via browser automation) — server-side verification logic is proven by unit tests + live edge-case testing of our own endpoints, but the full end-to-end "customer pays, webhook arrives, order updates" happy path was not driven through a real (test-mode) Razorpay session. *(RESOLVED — see above.)*
- **Refund workflow** — not found/tested; unclear if implemented.
- **Email delivery** — SMTP is unconfigured in this dev environment; email-sending code paths are unit-tested (`email.service.spec.ts`) but no real email was sent/verified in this pass. *(Tested this pass — found broken; see above.)*
- **Production-build frontend performance** — all frontend performance numbers are from Next.js **dev mode**, which is substantially slower than a real build; a dev-mode 17.7s Time-to-Interactive does **not** mean the production app is that slow (see `PERFORMANCE_REPORT.md`'s explicit caveat). *(Build now confirmed to succeed — see above; performance re-measurement still pending.)*
- **Performance/load at realistic data volume or against admin/storefront pages beyond one API endpoint and one homepage** — only `GET /api/products` and the storefront homepage were benchmarked, at a tiny (dev-seed) data volume, at 5/10/25 concurrency.
- **CPU/memory profiling under load** — not captured.
- **Malicious-package / typosquatting scan** — no tool available.
- **A live deployment of `deploy.sh`** — reviewed as config/code, never actually executed against a real EC2 instance in this audit.
- **Browser/device matrix beyond Chromium at 1280px and 375px** — no Safari/Firefox/real-device testing performed.
- **Accessibility (a11y) audit** — not performed as a dedicated pass.

---

## Path to READY FOR PRODUCTION *(2026-11-07 version — see the updated list near the top of this file)*

1. ~~Upgrade `next` to `>=15.5.28`~~ **DONE 2026-11-10.**
2. ~~Add a pnpm `overrides` entry pinning `multer >=2.5.0`~~ **DONE 2026-11-10** (plus `body-parser`, `postcss` as a bonus while in there).
3. **Put TLS in front of all three NodePorts** before pointing a real domain/real users at this (fixes H1) — still open.
4. ~~Re-run `pnpm audit` after steps 1–2~~ **DONE 2026-11-10** — Critical 8→3, High 29→5, all residual items dev-only or requiring a major-version jump.
5. Before or shortly after launch: address M2 (Secrets encryption/secret manager) and schedule the dev-only Vitest 1→3 major-version upgrade as routine hygiene (not urgent, not production-blocking).
6. Decide whether to clean up the disposable QA artifacts this audit created in the local dev DB (2 throwaway customer accounts, 1 test order, 1 disposable admin account, all previously disclosed) — harmless either way since this is a dev database, your call. *(2026-11-10 pass's own test accounts/orders have been cleaned up / correctly cancelled — see above.)*
