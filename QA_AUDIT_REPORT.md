# QA Audit Report — PREMAL KAIZEN

**Date:** 2026-11-07
**Branch audited:** `chore/production-hardening` (working tree as-is, including uncommitted changes)
**Scope of this pass:** Static analysis + existing automated tests (requested priority) + live local dynamic testing (API, auth, IDOR, rate-limiting, CORS, uploads, browser QA on storefront + admin public pages), as agreed with the requester.
**Not in scope for this pass** (see "Not Covered" below): authenticated admin-panel UI testing, live Razorpay payment flow, load/performance testing, a new Playwright E2E suite, production/Docker/K8s config review, full dependency CVE audit.

---

## 1. Dashboard

| Metric | Result |
|---|---|
| Modules reviewed | Storefront (Next.js), Admin (Next.js), API (NestJS + Prisma/SQLite dev DB) |
| Static analysis | ESLint, `tsc --noEmit` across all 3 workspaces |
| Existing unit tests run | 24 API spec files, 3 storefront spec files, 1 admin spec file |
| Tests passing (before fix) | 231 / 231 |
| Tests passing (after fix) | **238 / 238** (7 new regression tests added) |
| Lint errors found | 1 (fixed) |
| Lint warnings | ~296 (not fixed — style-only, see §4) |
| Type errors | 0 |
| Bugs found (functional) | 0 confirmed — storefront and public admin pages all render correctly, no console errors, no broken links/images, no horizontal overflow at 375px or 1280px |
| Security findings | 1 Medium (insecure file upload extension handling) — **fixed and verified** |
| Security controls verified working | IDOR protection, auth/session handling, rate limiting, CORS, password-reset enumeration resistance, admin-bootstrap self-disable, server-authoritative pricing |
| Live servers used | API :3002, Storefront :3000, Admin :3001 (SQLite dev DB, Razorpay in test-key mode, stopped after testing) |

**Verdict:** No functional defects found in the areas tested. One real, fixed security issue (file-upload extension spoofing). The codebase shows deliberate, documented security engineering (ownership checks with 404-not-403, server-side price authority, generic auth error messages, rate limiting on sensitive endpoints) — this is a well-built application, not a greenfield audit target.

---

## 2. Static Analysis (Phase 3)

```
pnpm -r run lint       → 1 error (fixed), ~296 warnings (unused vars, etc. — style only)
pnpm -r run type-check → 0 errors across api, admin, storefront
```

The one lint **error** was `no-control-regex` in `apps/api/src/invoices/invoice-pdf.service.ts` — a deliberate control-character stripper used to sanitize text before it's embedded in a generated PDF (prevents PDF/string injection). Not a bug; ESLint can't know the control-char match is intentional. Fixed by suppressing the rule on that line with a justifying comment, not by changing the regex (changing it would weaken the sanitization).

The ~296 warnings are overwhelmingly `no-unused-vars` and similar style issues. These were **not** fixed in this pass — per the audit guardrails ("don't refactor beyond what the task requires"), bulk-fixing hundreds of lint warnings across someone else's in-progress branch is a separate, deliberate cleanup task, not a QA bug fix. Flagging as a residual item if the team wants a follow-up pass.

## 3. Existing Automated Test Suites (Phase 4)

| Workspace | Files | Tests | Result |
|---|---|---|---|
| `apps/api` | 24 | 163 → 170 | ✅ all pass |
| `apps/storefront` | 3 | 58 | ✅ all pass |
| `apps/admin` | 1 | 10 | ✅ all pass |

Coverage is concentrated in the API (auth, payments, orders, inventory, promotions, uploads, CORS/throttle/admin-guard config) and is notably good for a project this size — including tests for the exact kind of security config (CORS allow-list, throttle wiring, admin guard) that's often left untested. Storefront/admin coverage is thin (pricing/checkout-settings logic and one admin auth-service test) — no component or page-level tests exist yet in either Next.js app, and there is no Playwright/E2E suite in the repo.

## 4. Live Dynamic Testing (Phases 5–9, scoped)

Ran all three apps locally (SQLite dev DB, existing seed data, Razorpay in test-key mode — no real charges). Full detail in `SECURITY_AUDIT_REPORT.md`; functional summary:

**API, verified against the real seeded dev DB with two throwaway test accounts:**
- Registration: rejects weak passwords (<8 chars), normalizes email case, generic (non-enumerating) responses on both register-conflict and password-reset.
- Login/session: opaque session tokens, `httpOnly` + `SameSite=strict` cookie, `/me` correctly rejects missing/garbage tokens with 401.
- **IDOR**: created a real order as "User A," confirmed "User B" gets 404 (not 403, by design — avoids confirming the order exists) on the order, its invoice JSON, *and* its invoice PDF download. Order list for User B does not leak User A's order ID.
- **Pricing integrity**: order creation uses server-stored product price, ignores any client-supplied price.
- **Rate limiting**: login throttled after ~8 rapid requests (limit configured at 10/60s) — works.
- **CORS**: preflight from an unlisted origin gets no `Access-Control-Allow-Origin` header; `localhost:3000` is allowed with credentials — works as designed.
- **Admin bootstrap**: self-disables once an admin exists (409 Conflict) — verified both via API and the admin UI ("Administrator Already Exists" screen).
- Security headers (Helmet): HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`, etc. all present on API responses.

**Storefront (10+ pages, desktop 1280px + mobile 375px):**
Home, Shop, Product detail, About, Contact, FAQ, Shipping, Returns, Cart, Checkout (empty-cart state), Login, Register, 404, unauthenticated `/account` (redirects to login with return URL), unauthenticated `/wishlist` (renders a proper guest empty-state, not a redirect — this is a legitimate design choice since wishlist has no account-only data exposure, not a bug). No console errors, no broken images, no horizontal scroll at either viewport, real 404 status + page for unknown routes, invalid-login shows a generic non-enumerating error message.

**Admin (public/unauthenticated surface only — no admin credentials were available to this session):**
Root redirects through `/admin` → `/auth/login`; login and signup pages render cleanly; signup correctly shows "Administrator Already Exists" rather than a live signup form. No console errors.

## 5. Not Covered In This Pass

Flagging explicitly, per the audit's own quality-gate rule that a clean pass doesn't mean zero risk:

- **Authenticated admin panel** (products, orders, inventory, promotions, customers, analytics, settings UI) — no admin password was available to this session.
- **Live Razorpay payment flow** (order→pay→webhook) — unit tests for this exist and pass (`payments.service.spec.ts`, `razorpay.service.spec.ts`), but no live Razorpay test-mode checkout was driven through the browser.
- **Load/performance testing** — not run; needs explicit scope/limit agreement per the audit ground rules.
- **New Playwright/E2E suite** — none exists in the repo; writing one was out of scope for this pass (user chose "static analysis + existing tests" + light live testing, not full suite authoring).
- **Dependency CVE / SCA scan** (`npm audit` / Snyk-equivalent) — not run.
- **Production/Docker/K8s config review** — `deploy/k8s/*`, Dockerfiles not reviewed this pass.
- Two throwaway test accounts (`qausera@test.com`, `qauserb@test.com`) and one COD test order were created in the local SQLite dev DB during IDOR testing. Harmless (local dev DB only), but mention if you want them cleaned up.

See `SECURITY_AUDIT_REPORT.md` for the full security findings and `FIXES_IMPLEMENTED.md` for what was changed.
