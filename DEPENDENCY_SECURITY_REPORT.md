# Dependency Security Report — PREMAL KAIZEN

**Date:** 2026-11-07
**Tool:** `pnpm audit` (GitHub Advisory Database, via the pnpm workspace lockfile — covers all 4 workspace projects: root, api, admin, storefront)
**Scope:** Vulnerability scan only. No packages were upgraded. No malicious-package scanner (e.g. Socket.dev) was available in this environment — flagged as a residual gap below.

## Summary

| Severity | Count |
|---|---|
| Critical | 8 |
| High | 29 |
| Moderate | 39 |
| Low | 11 |
| **Total advisories** | **87** |

`pnpm install --frozen-lockfile --dry-run` confirms the lockfile is internally consistent and up to date (pnpm's own supply-chain policy check also passed) — these are genuine known-CVE findings against currently-installed versions, not a lockfile drift issue.

**This is a large number, but it concentrates into a small number of root causes.** Fixing 3 packages resolves the large majority of the critical/high count.

---

## Root cause #1 — `next@15.0.0` pinned exactly, no range (CRITICAL)

**Affected:** `apps/storefront`, `apps/admin` (both pin `"next": "15.0.0"` exactly — confirmed by reading both `package.json` files)
**This single pinned version accounts for 8 of 8 Critical advisories and most of the High advisories** found in the scan, including:

- **Unauthenticated RCE** in the React Flight protocol (GHSA-9qr9-h5gf-34mp) — fixed in 15.0.7
- **Unauthenticated RCE** on Windows-hosted servers (GHSA-p293-qw3h-jr36) — fixed in 15.5.24
- **Unauthenticated RCE** in the Image Optimization API via AVIF files (GHSA-2xp9-vwfh-vxw4) — fixed in 15.5.24
- **Unauthenticated RCE** in the Image Optimization API via SVG files (GHSA-2464-fhr4-w9xw) — fixed in 15.5.28
- **Authorization bypass** in Next.js Middleware (GHSA-f82v-jwr5-mffw) — fixed in 15.2.8
- Multiple SSRF, DoS, and middleware-bypass advisories, all fixed by 15.5.16–15.5.28

**Why this matters in practice:** this is the live production framework for both customer-facing apps, not a dev-only tool. The Image Optimization RCEs are two-click findings on an exact-pinned vulnerable version — notably, `next.config.ts` currently has no `next/image` usage anywhere in the codebase (confirmed via code comment in `apps/storefront/next.config.ts`), which narrows but does not eliminate exposure (Next's image optimization route can still exist/be reachable depending on deployment).

**Remediation:** upgrade `next` to `>=15.5.28` in both `apps/storefront/package.json` and `apps/admin/package.json`. **This is a same-major-version (15.x) upgrade, not a major-version jump** — lower breaking-change risk than a 15→16 move, but still a real version bump across ~16 patch/minor releases, so it should be tested (build + the existing test suites + a manual smoke pass) before trusting it blindly. **Not applied in this audit** — flagging for your approval per the "no upgrades with breaking-change risk without approval" rule.

## Root cause #2 — `multer@2.0.2` bundled transitively via `@nestjs/platform-express` (HIGH)

**Affected:** `apps/api` — confirmed via `pnpm why multer`, **two separate multer installs exist in this workspace**:
- `multer@2.5.0` — apps/api's own direct dependency (`package.json: "multer": "^2.5.0"`), used only for `memoryStorage()` in `uploads.controller.ts`. **Not vulnerable.**
- `multer@2.0.2` — bundled transitively by `@nestjs/platform-express@10.4.22` (via `@nestjs/core`/`@nestjs/throttler`). **This is the version NestJS's `FileInterceptor` decorator actually instantiates and runs against the live multipart stream** for `POST /api/uploads/image` — i.e., the vulnerable version is the one actually processing untrusted file uploads on the one endpoint in this app that accepts them.

Advisories hitting 2.0.2 (all fixed by 2.5.0, already satisfied by the *other* installed copy): DoS via incomplete cleanup, resource exhaustion, uncontrolled recursion, deeply-nested field names, crafted multipart field names, oversized array index in field names, and a pending-async-fileFilter-after-teardown DoS.

**Why High, not Critical:** the endpoint is admin-only (`AuthGuard` + `AdminGuard`, verified in `SECURITY_AUDIT_REPORT.md`), so exploitation requires an authenticated admin session — these are resource-exhaustion/DoS vectors against the Node process, not RCE or data exposure. Still a real risk: a compromised or malicious admin session (or a future endpoint that reuses `FileInterceptor` without the admin gate) could degrade or crash the API with a crafted multipart request.

**Remediation:** add a pnpm `overrides` entry forcing `multer` to `>=2.5.0` workspace-wide (a well-established technique for exactly this situation — forces the transitive copy to the safe version without touching `@nestjs/platform-express`'s declared version or requiring a NestJS upgrade). This is **not a major-version change** (multer stays on 2.x) and carries low breaking-change risk. **Not applied** — flagging for approval.

## Root cause #3 — dev-only tooling (vitest/vite/tinypool, `@nestjs/cli` transitive deps)

**Affected:** all three apps' `devDependencies` only — `vitest`, `vite`, `tinypool` (2 Critical prototype-pollution-to-RCE advisories), plus `@nestjs/cli`'s own transitive deps (`glob`, `picomatch`, `tmp`) in `apps/api`.

**Why these are lower real-world risk despite "Critical" labels:** these only run on a developer's machine during `pnpm test`/`pnpm dev`/`pnpm lint` — **they are never deployed to a production server or exposed to any end user or attacker**, because they aren't part of the built application bundle. The Tinypool/Vitest RCE specifically requires the Vitest UI server to be running and reachable, which it isn't in any normal workflow here. They should still be updated as routine hygiene, but they do not represent production attack surface the way `next` and the bundled `multer` do.

**Remediation:** `vitest` → `>=3.2.6` (currently on 1.x per the lockfile — this **would** be a major-version jump across all three workspaces' dev dependencies, so per the "no automatic major upgrades" rule, this needs your explicit go-ahead and should be done as its own change with the test suites re-run immediately after, since Vitest 1→3 can change config/API surface). `@nestjs/cli` transitive issues resolve by updating `@nestjs/cli` itself (dev-only; lower priority).

## Remaining advisories (Moderate/Low)

`postcss`, `sharp` (bundled by `next`, used for image optimization — not directly imported by app code), `zod`, `@nestjs/core`, `ajv`, `file-type`, `qs`, `esbuild`, `webpack`, `deepmerge` — all transitive, all resolved as a side effect of the `next` and dev-tooling upgrades above. No standalone action needed beyond those two upgrades.

## What was NOT checked (residual risk / tooling gaps)

- **No malicious/typosquatted-package scanner was run** (e.g. Socket.dev, `npm audit signatures`) — `pnpm`'s own lockfile supply-chain policy check passed, which is reassuring but not equivalent to a dedicated malicious-package scan. No such tool was available in this environment; recommend adding one to CI if supply-chain risk is a concern.
- **Unused-dependency analysis** (e.g. `depcheck`) was not run — flagged as a nice-to-have cleanup item, not a security concern, and skipped to stay within this pass's scope.
- Advisory data reflects the GitHub Advisory Database at the time of this scan; re-run `pnpm audit` periodically, not just once.

## Recommended action (needs your approval before I touch anything)

1. **Priority 1:** `next` → `>=15.5.28` in `apps/storefront` and `apps/admin` (same major version; real RCE/auth-bypass fixes; requires a rebuild + full retest afterward).
2. **Priority 2:** pin `multer` to `>=2.5.0` via a workspace-level pnpm `override` (no version declarations change; low risk; removes the vulnerable transitive copy actually used by the upload endpoint).
3. **Priority 3 (optional, higher effort):** `vitest`/`vite`/`tinypool` major-version upgrade across all three workspaces' dev dependencies — dev-only exposure, lower urgency, but worth scheduling.

I have not applied any of these — say the word and I'll do #1 and #2 (lower-risk, same-major-version changes) and immediately re-run the full test suite + a smoke pass to confirm nothing broke, before touching #3.
