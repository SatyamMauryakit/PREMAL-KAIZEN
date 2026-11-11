# API-CONTRACT-REPORT.md

Date: 2026-11-11. Honesty note up front, per the audit's own rule: **this is not
claiming 100% endpoint-by-endpoint automated contract test coverage.** Below, every
endpoint group is marked with its actual verification status — live-browser-tested,
covered by passing unit/service tests, or verified by direct code read only. Nothing
here is marked "verified" without one of those three having actually happened.

## Verification key

- **Live** — exercised end-to-end through a real browser or direct HTTP call against
  the running app this engagement, with the response/DB state actually inspected.
- **Unit** — covered by a passing automated test in the 386-test suite (mocked Prisma,
  not a live DB), confirming the service logic but not the full HTTP path.
- **Read** — contract confirmed by reading the controller + the frontend call site
  side-by-side; no test or live execution specifically for this pairing.

## Auth (`/api/auth/*`)

| Endpoint | Method | Frontend caller | Status |
|---|---|---|---|
| `/api/auth/register` | POST | `auth-context.tsx` | Live (registration → email OTP this engagement) |
| `/api/auth/login` | POST | `auth-context.tsx` | **Live** — password step, admin-bypass, `requiresOtp` branch all exercised |
| `/api/auth/login/verify-otp` | POST | `auth-context.tsx` | **Live** — correct code, wrong code (5x), lockout on 6th |
| `/api/auth/login/resend-otp` | POST | `auth-context.tsx` | Unit (cooldown/anti-enumeration tests) |
| `/api/auth/logout` | POST | `auth-context.tsx` | Read |
| `/api/auth/me` | GET | `auth-context.tsx` | **Live** — 401 with no token confirmed |
| `/api/auth/send-otp` / `/verify-otp` | POST | `auth-context.tsx` | **Live** — real SMTP send confirmed via log |
| `/api/auth/request-password-reset` | POST | `forgot-password/page.tsx` | **Live** — real email delivery confirmed |
| `/api/auth/reset-password` | POST | `reset-password/page.tsx` | Unit |
| `/api/auth/admin/bootstrap` | POST | `apps/admin/app/auth/signup` | Read + DB state check (0 admins = ready) this pass |

## Customer self-service (`/api/customer/*`) — all `AuthGuard`-protected, `req.user.id`-derived

| Endpoint | Method | Status |
|---|---|---|
| `/api/customer/cart` | GET/PUT/DELETE | **Live** — restore-on-login, logout-local-clear, order-triggered server clear all tested |
| `/api/customer/wishlist` | GET/PUT/POST/:id/DELETE | **Live** — mirrors cart pattern, tested live |
| `/api/customer/profile` | PUT | Read |
| `/api/customer/password` | PUT | Read |
| `/api/customer/addresses` | GET/POST/etc. | **Live** — IDOR check this pass (another user's token sees only their own, empty, list) |

## Orders / Payments

| Endpoint | Status |
|---|---|
| `POST /api/orders` (create) | **Live** — full COD checkout exercised this pass, cart-clear fix verified in DB |
| `GET /api/orders/:id` | **Live** — IDOR check this pass (404 for another user's order) |
| `POST /api/payments/razorpay/verify` | **Live** — real test-mode payment, cross-checked against Razorpay's own API |
| `POST /api/payments/razorpay/webhook` | Unit (idempotency, signature, amount/currency mismatch all covered in `payments.service.spec.ts`) |

## Products / Categories

| Endpoint | Status |
|---|---|
| `GET /api/products`, `/api/products/:id` | **Live** — confirmed serving the real 49-product catalog post-cleanup |
| `GET /api/categories` | Read (controller + frontend call site match) |
| Admin product CRUD (`/api/admin/products/*`) | Unit (`products.service.spec.ts`) |

## Admin-only surfaces (RBAC-gated: `AuthGuard` + `AdminGuard` + `PermissionGuard`)

Covers `customer-admin`, `inventory`, `promotions`, `settings`, `admin-management`,
`reviews` (admin side), contact/enquiries. All have passing unit tests
(`*.service.spec.ts` for each) and were read against their frontend `*-service.ts`
callers in `apps/admin/lib/`. **Not** individually live-browser-driven this pass —
admin CRUD flows were live-tested earlier in this engagement (product/order/inventory
management) but not re-run in this specific pass, since no server-side logic in this
area changed.

## Known frontend→backend mismatches found

**None found this pass.** Every frontend `*-service.ts`/`*-context.tsx` file that calls
the API was checked against its matching controller route and found to agree on path,
method, and the key request/response shape fields actually consumed. This is not a
claim that every single field is type-matched — see "No systematic DTO validation
layer" in `CODE-AUDIT.md` for the honest caveat on how loosely-typed request bodies
are.

## Automated contract tests

No new dedicated "contract test" suite (frontend calls vs backend shape, run as its own
CI gate) was created this pass — the existing 386 service/unit tests already exercise
each endpoint's logic, and the live-browser sessions above are the actual contract
verification for the highest-risk paths (auth, cart, checkout, payments, IDOR). Adding
a dedicated contract-test harness (e.g. generating requests from the frontend's own
fetch calls) is a reasonable follow-up, not done here to avoid scope creep into
rebuilding test infrastructure that already works.
