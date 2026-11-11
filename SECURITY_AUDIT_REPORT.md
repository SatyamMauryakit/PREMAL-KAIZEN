# Security Audit Report — PREMAL KAIZEN

**Date:** 2026-11-07
**Method:** Static code review of `apps/api` (NestJS) + live testing against a local instance (SQLite dev DB, Razorpay test keys, no production systems touched). Authorized local-only testing — no external scanning performed.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 (fixed) |
| Low | 0 |
| Informational | 2 |

---

## MEDIUM — Insecure file upload: extension derived from attacker-controlled filename

- **Status: FIXED and verified**
- **Affected files:** `apps/api/src/uploads/storage/local-storage.adapter.ts`, `apps/api/src/uploads/storage/s3-storage.adapter.ts`
- **Endpoint:** `POST /api/uploads/image` (admin-only — requires `AuthGuard` + `AdminGuard`)

### The vulnerability

`imageFileFilter` (in `upload-validation.ts`) only checks the multipart field's declared `mimetype`, which — like `originalname` — is sent by the client and is not verified against the file's actual bytes. That part is a standard, acceptable limitation of MIME-type allow-listing (full magic-byte sniffing is a reasonable future hardening step but not what made this exploitable).

The real bug was downstream: both storage adapters built the saved filename/S3 key using `extname(file.originalname)` — the **client-supplied filename** — while only `mimetype` had been validated. A request could declare `mimetype: "image/jpeg"` (passing the filter) while naming the file `payload.html` or `xss.svg`. The server would then write a randomly-named `.html`/`.svg` file into the publicly-served `/uploads/` static directory (local) or the S3 bucket (prod), executable as same-origin HTML/SVG+script if the direct URL were ever opened in a browser.

### Why Medium, not Critical/High

The endpoint requires an authenticated **admin** session (`AuthGuard` + `AdminGuard`) — this is not an anonymous or even a regular-customer-exploitable path. Severity reflects a real defense-in-depth gap with same-origin stored-XSS potential if an admin account is ever phished/compromised or a CSRF-adjacent vector is found elsewhere, not an immediately exploitable anonymous vulnerability. (CSRF against this endpoint specifically is separately mitigated: the session cookie is `httpOnly` + `SameSite=strict`.)

### Reproduction (proven via unit test, not live admin exploitation — no admin credentials were available to this session)

Existing test suite had, verbatim: `it('preserves the original file extension', ...)` asserting `banner.webp` + `image/webp` → `.webp` — this encoded the vulnerable behavior as "working as intended." Added a regression test that proves the mismatch case:

```ts
// originalname: 'payload.html', mimetype: 'image/jpeg' (passes the MIME allow-list)
// Before fix: saved key ended in .html
// After fix:  saved key ends in .jpg
```

### Fix implemented

Added `safeExtensionFor(mimetype)` to `upload-validation.ts` — a fixed map from the 4 allow-listed MIME types to their canonical extension (`.jpg`/`.png`/`.webp`/`.gif`), with a safe `.bin` fallback. Both storage adapters now derive the saved extension from the **validated MIME type**, never from client-supplied `originalname`.

### Retest result

```
apps/api/src/uploads/*  → 36/36 tests pass (7 new, including the regression test above)
Full API suite          → 170/170 pass
tsc --noEmit            → 0 errors
```

---

## Verified controls (no issue — documented as evidence of what was checked)

| Check | Result |
|---|---|
| IDOR — orders, invoices, invoice PDFs | Protected. Cross-account access returns 404 (deliberately, not 403, to avoid confirming existence); order list doesn't leak other users' order IDs. Verified live with two real test accounts and a real created order. |
| Price tampering | Order creation always re-reads product price server-side; client-supplied price is never trusted. |
| Auth — session validation | Opaque server-side session tokens; missing/invalid token → 401; `httpOnly` + `SameSite=strict` cookie limits XSS/CSRF cookie theft. |
| Password policy | Minimum 8 characters enforced server-side on registration. |
| User enumeration | Password-reset and registration-conflict responses are generic/identical regardless of whether the account exists. |
| Rate limiting | `@nestjs/throttler` applied to register/login/bootstrap/password-reset/OTP endpoints; empirically confirmed login throttles after a burst of requests. |
| CORS | Allow-list enforced; unlisted origins get no CORS headers; configured origins get scoped `Access-Control-Allow-Origin` + credentials. |
| Admin bootstrap | Self-disables once any admin exists (409 Conflict), verified via API and the admin UI. |
| SQL/NoSQL injection | Prisma ORM used throughout; only raw query found (`$queryRaw\`SELECT 1\`` in the health check) is a hardcoded literal, not interpolated — no injection surface. |
| Hardcoded secrets in source | None found (only test-fixture placeholder strings in `*.spec.ts`). Real secrets live in `.env` (git-ignored) — not printed in this audit. |
| Security headers | Helmet applied: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, `X-XSS-Protection: 0` (correct — modern guidance disables the legacy header, relies on CSP+nosniff instead), etc. |

## Informational (no action required / for awareness)

1. **No automated dependency/CVE scan was run** (`npm audit`, Snyk, or similar) — recommend adding one, especially given `razorpay`, `@aws-sdk/client-s3`, and `pdfkit` are all handling sensitive data paths (payments, file storage, PDF generation from user-influenced data).
2. **No Content-Security-Policy configured beyond Helmet's defaults** — Helmet ships a default CSP for HTML-serving apps, but worth explicitly verifying it's tuned for this API (which is mostly JSON) and for the two Next.js frontends separately, especially given the fixed upload issue's XSS angle — a strict CSP on the `/uploads/` origin would be a strong second layer of defense even with the extension fix in place.

## Out of scope for this pass

Authenticated admin-panel testing, live Razorpay checkout flow, load/DoS testing, external scanning, dependency CVE scan, and Docker/K8s/production config review. See `QA_AUDIT_REPORT.md` §5 for the full list and why.

**Note:** the items above were out of scope for *this section* of the report (written 2026-11-07, before Phase 2 testing). Authenticated admin-panel testing, payment security testing, and the dependency/infrastructure scans were subsequently completed — see the Phase 2 addendum below and the separate `DEPENDENCY_SECURITY_REPORT.md` / `INFRASTRUCTURE_SECURITY_REPORT.md`. This section is left unedited above to preserve the original findings as written; the summary table at the top of this file reflects only the original pass, not the additions below.

---

## Phase 2 Addendum (2026-11-07, continued pass) — Authenticated Admin & Payment Security

A disposable test-admin account was created directly in the local dev DB (via Prisma, the same mechanism the project's own `prisma/seed.ts` uses) for this testing, with the user's approval. No existing admin credentials were used or requested after that; the account can be removed on request.

### Admin RBAC — verified correct in both directions

| Test | Result |
|---|---|
| Customer-role token calls `GET /api/admin/customers` | `403 Forbidden — "Administrator access required"` |
| Customer-role token calls `GET /api/admin/analytics/dashboard` | `403 Forbidden` (same message) |
| No token at all calls an admin endpoint | `401 Unauthorized` |
| Admin token calls the same endpoints | `200 OK` with real data |
| Admin-only upload endpoint called with a customer token | `403 Forbidden` |

### Session invalidation on logout — verified working (and the first attempt gave a false result, corrected)

The browser's admin session token was captured directly from `localStorage` (`adminSessionToken` — the admin frontend authenticates via `Authorization: Bearer`, not cookies). That exact token was confirmed live (`200 OK` via `GET /api/auth/me`), then the UI's Logout button was used (after correctly handling its confirmation dialog — an initial attempt was blocked by an unhandled `confirm()` and produced a misleading "still valid" result purely because logout never actually ran; redone correctly below). The same token, reused after a real logout, returned **"Session expired" / 401** — confirming the server genuinely invalidates the session row on logout rather than relying on client-side token deletion alone.

### Order status state machine — enforced server-side even for admins

Attempting to force an order from `confirmed` directly to `delivered` (skipping intermediate states) via `PUT /api/orders/:id/status` as the test admin was correctly rejected: `400 Bad Request — "Cannot transition from confirmed to delivered"`. The status-transition graph in `orders.service.ts` is enforced regardless of caller role.

### Payment security (Razorpay, test-mode keys only — no real transactions)

Live-tested against the running API (code already reviewed in the original pass — `payments.service.ts`, `razorpay.service.ts`):

| Attack / edge case | Endpoint | Result |
|---|---|---|
| Missing required fields | `POST /api/payments/razorpay/verify` | `400` |
| Fabricated `razorpay_order_id` against an order with none on record | same | `400 — "This payment does not match the order on record"` |
| IDOR — verify someone else's order | same | `404 Not Found` (same not-403 pattern as orders/invoices) |
| Webhook with no `x-razorpay-signature` header | `POST /api/payments/razorpay/webhook` | `400 — "Invalid webhook signature"` (rejected before the payload is even parsed) |
| Webhook with a wrong/fabricated signature | same | `400` (same message) |
| Webhook with malformed JSON body | same | `400` (rejected by the framework's body parser before reaching the signature check) |

**Amount-tampering and duplicate-webhook-delivery idempotency were not re-tested live** in this pass — they require a real captured Razorpay payment ID to call `fetchPayment()` against, which isn't obtainable without going through Razorpay's actual hosted test checkout (a separate, larger browser-interactive flow). This exact logic is already proven correct by the existing mocked unit tests (`payments.service.spec.ts`, `razorpay.service.spec.ts`), which specifically assert on amount-mismatch and duplicate-webhook ("duplicate_ignored") behavior — confirmed passing again in this pass's regression run. Code reading confirms: `verifyPayment()` independently re-fetches the payment from Razorpay and cross-checks amount/currency/status before marking an order paid — **the client's callback alone is never trusted**, exactly as the audit required.

### No new vulnerabilities found in this addendum

Everything tested above behaved correctly. No change to the Medium/High/Critical counts in the summary table above.
