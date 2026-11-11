# Fixes Implemented — QA Pass 2026-11-07

Two changes made, both verified by running the affected test suites before and after.

## 1. Lint error: `no-control-regex` in invoice PDF generator

**File:** `apps/api/src/invoices/invoice-pdf.service.ts`
**Change:** Added `// eslint-disable-next-line no-control-regex` with a justifying comment on the control-character-stripping regex used to sanitize text before PDF embedding.
**Why not changed differently:** The regex's job *is* to match control characters — "fixing" it by rewriting the pattern would remove the sanitization it exists for. Suppressing the specific rule, with the reason documented inline, is the correct fix.
**Verification:** `pnpm -r run lint` now reports 0 errors (warnings-only) across all three workspaces.

## 2. Security: insecure file upload extension handling (Medium)

**Files:**
- `apps/api/src/uploads/upload-validation.ts` — added `safeExtensionFor(mimetype)` mapping each allow-listed MIME type to a fixed extension.
- `apps/api/src/uploads/storage/local-storage.adapter.ts` — saved filename now uses `safeExtensionFor(file.mimetype)` instead of `extname(file.originalname)`.
- `apps/api/src/uploads/storage/s3-storage.adapter.ts` — same change for the S3 object key.
- `apps/api/src/uploads/upload-validation.spec.ts`, `local-storage.adapter.spec.ts`, `s3-storage.adapter.spec.ts` — updated/added tests, including a regression test proving a `mimetype: image/jpeg` + `originalname: payload.html` request is saved with a `.jpg` extension, never `.html`.

Full rationale and severity assessment in `SECURITY_AUDIT_REPORT.md`.

**Verification:**
```
apps/api/src/uploads/*  → 36/36 pass (7 new tests)
Full API suite          → 170/170 pass (was 163/163 before)
tsc --noEmit            → 0 errors
```

No other files were modified. No business logic, API contracts, or database schema were changed — both fixes are additive/defensive and change no existing behavior for valid (non-spoofed) requests.
