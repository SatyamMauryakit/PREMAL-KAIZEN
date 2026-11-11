# Phase C — Admin Panel Audit & RBAC Architecture Proposal

Date: 2026-11-09
Scope: `apps/admin`, `apps/api` admin-facing modules, `User`/auth schema. Storefront is untouched and out of scope.

This is the **audit + proposed architecture** deliverable. No RBAC code has been written yet — implementation starts only after this is reviewed.

---

## 1. Current State Summary

### 1.1 Authentication/authorization model today

- `User.role` is a flat string: `'customer' | 'admin'`. No sub-roles, no permissions table, no enum.
- `AuthGuard` validates the session token (cookie or `Authorization: Bearer`), checks expiry and `isActive`, attaches the user to `req.user`.
- `AdminGuard` extends `AuthGuard` and adds one check: `req.user.role === 'admin'`. Binary — pinned by 5 tests in `admin.guard.spec.ts` that must keep passing unmodified.
- `IdentityService.createAdmin()` just calls `createUser(..., 'admin')`. No role selection exists anywhere in the stack.
- Admin login (`/api/auth/me`, `/api/auth/login`) returns `{id, email, firstName, lastName, role, emailVerified}` — no granular role field.
- **Every admin who exists today has unconditional access to every admin feature.** There is no concept of a restricted admin anywhere in the code.

### 1.2 Frontend (`apps/admin`)

- `apps/admin/app/admin/layout.tsx` (`ProtectedAdminLayout`) only checks "is there a valid admin session at all" via `adminAuthService.getCurrentAdmin()`. It does not branch on any role field. **Any authenticated admin can navigate directly to any `/admin/*` URL.**
- `components/Sidebar.tsx` renders a single hardcoded `navItems` array with zero conditional logic. **Every admin sees every nav item regardless of what they're allowed to do** — there is no visibility-by-permission today.
- "Add Administrator" form (`apps/admin/app/admin/settings/page.tsx`, Security tab, ~line 641): collects first name, email, password only. **No role/permission selection UI exists.** Submits straight to `POST /api/auth/admin/create`, which always creates a full, unrestricted admin.
- No admin-management list view exists (no way to see existing admins, deactivate one, or change their role, from the UI).

### 1.3 Backend admin surface (every `AdminGuard`-protected controller, confirmed by direct inspection)

| Controller | Route prefix | Current guard | Notes |
|---|---|---|---|
| `identity.controller.ts` | `POST /api/auth/admin/create` | `AuthGuard, AdminGuard` | Creates a new unrestricted admin. No escalation control. |
| `products.controller.ts` | `api/products` (mutating + `:id/full`) | `AuthGuard, AdminGuard` | Create/update/delete products, full (admin) product view. |
| `categories.controller.ts` | `api/categories` (mutating only) | `AuthGuard, AdminGuard` | Create/update/delete categories. |
| `inventory.controller.ts` | `api/inventory` (whole controller) | `AuthGuard, AdminGuard` | Stock adjust, thresholds, audit log. |
| `uploads.controller.ts` | `api/uploads` (whole controller) | `AuthGuard, AdminGuard` | Product image upload. |
| `orders.controller.ts` | `api/orders` (status/payment-status/shipping/notes/delete/invoice-generate) | `AuthGuard, AdminGuard` on mutating routes; `AuthGuard`-only + ownership check on read routes | Admin can view/update any order. Read routes correctly scope non-admins to their own orders already (404-on-mismatch pattern). |
| `customer-admin.controller.ts` | `api/admin/customers` (whole controller) | `AuthGuard, AdminGuard` | Customer list/detail/order history/export/activate-deactivate — full PII access. |
| `contact.controller.ts` | `api/contact/messages*` | `AuthGuard, AdminGuard` | Read customer enquiries (PII). |
| `admin-reviews.controller.ts` | `api/admin/reviews` (whole controller) | `AuthGuard, AdminGuard` | Moderate/remove reviews. |
| `promotions.controller.ts` | `api/promotions` (CRUD/stats/coupons) | `AuthGuard, AdminGuard` | Not currently assigned to any role in the brief — flagged below. |
| `analytics.controller.ts` | `api/admin/analytics` (whole controller) | `AuthGuard, AdminGuard` | Dashboard metrics, sales trend, product/promotion performance — financial data. |
| `settings.controller.ts` | `api/admin/settings` (whole controller) | `AuthGuard, AdminGuard` | Store settings, shipping, tax, maintenance mode, **payment provider status**, audit log. Highest-sensitivity surface. |

All 12 controllers use the exact same `@UseGuards(AuthGuard, AdminGuard)` with no further distinction — confirming the brief's premise that today's admin access is entirely flat.

### 1.4 Audit logging

- `SettingsAuditLog` model exists today (`setting`, `previousValue`, `newValue`, `changedBy`, `changeReason`, `createdAt`) but it is scoped **only** to store-settings changes (`SettingsService`). It has no concept of admin-management actions (who was created, whose role changed, who was deactivated) and isn't generic enough to reuse as-is for RBAC auditing without overloading its schema's intent.

### 1.5 Gaps I'm flagging honestly (not silently resolving)

1. **CONTENT_MANAGER has no backend to manage.** The brief lists "homepage banners, FAQ, website content, promotional content" for this role, but there is no CMS/banner/FAQ model anywhere in the schema — FAQ and shipping-info content on the storefront are hardcoded React content, not database-backed (confirmed during Phase B). I can create the permission (`content:manage`) and gate it for future use, but there is currently no protected endpoint for it to actually guard. I will not invent a CMS backend as part of an RBAC task — that's a separate feature. This will show as a role with permissions but no enforced routes yet, documented as such.
2. **Promotions/vouchers isn't assigned to any of the five roles in the brief.** The current nav has a whole "Vouchers & Discounts" section backed by `promotions.controller.ts`. I'm proposing it default to `PRODUCT_MANAGER` (closest fit — merchandising) and `SUPER_ADMIN`, unless you say otherwise.
3. **Enquiries (contact messages) isn't explicitly assigned either.** I'm proposing `SUPPORT_MANAGER` (closest fit — customer-facing communication), plus `SUPER_ADMIN`.

---

## 2. Proposed RBAC Architecture

### 2.1 Schema changes (additive only, no destructive migration)

```prisma
model User {
  // ...unchanged fields...
  role      String   @default("customer")   // UNCHANGED — stays the binary gate
  adminRole String?                          // NEW — null for customers; one of the 5 role keys for admins
}

model AdminAuditLog {
  id         String   @id @default(cuid())
  actorId    String              // admin who performed the action
  actorEmail String              // denormalized for readability if actor is later deleted
  action     String              // e.g. "admin.create", "admin.role_change", "admin.deactivate"
  targetId   String?             // affected user/entity id, if any
  details    String?             // JSON string of before/after or relevant context
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([action])
  @@index([createdAt])
}
```

- `User.role` is **never removed or renamed** — `AdminGuard`'s existing 5 pinned tests keep passing untouched, since they only ever assert on `role`.
- `adminRole` is purely additive and nullable. **Migration backfill step:** every existing row where `role = 'admin'` gets `adminRole = 'SUPER_ADMIN'` as part of the same migration (not a separate manual step) — this is the concrete mechanism that satisfies "do not lock out existing administrators."
- `AdminAuditLog` is a new, separate model from `SettingsAuditLog` (which keeps doing exactly what it does today for settings-value diffs). No duplicate systems — these log different kinds of events and I'm not merging them, but I'm also not building two overlapping "audit log" concepts for the same kind of event.

### 2.2 Permission model

Centralized, single source of truth — one new file, e.g. `apps/api/src/common/rbac/permissions.ts`:

```ts
export const PERMISSIONS = {
  // dashboard / financial
  'dashboard:view', 'analytics:view', 'financial:view',
  // products
  'products:view', 'products:manage', 'categories:manage', 'inventory:manage', 'uploads:manage',
  // orders
  'orders:view', 'orders:process', // status/shipping/notes/invoice
  // customers / support
  'customers:view', 'customers:manage', 'enquiries:view', 'returns:process',
  // reviews
  'reviews:moderate',
  // promotions
  'promotions:manage',
  // content (no backend yet — see gap #1 above)
  'content:manage',
  // settings
  'settings:view', 'settings:manage', 'settings:financial', // payment-provider status, tax
  // admin management (the escalation-sensitive one)
  'admins:manage',
} as const;

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN:      [/* every permission */],
  PRODUCT_MANAGER:  ['dashboard:view','products:view','products:manage','categories:manage','inventory:manage','uploads:manage','promotions:manage'],
  ORDER_MANAGER:    ['dashboard:view','orders:view','orders:process'],
  SUPPORT_MANAGER:  ['dashboard:view','customers:view','customers:manage','enquiries:view','returns:process','orders:view'],
  CONTENT_MANAGER:  ['dashboard:view','content:manage'],
};
```

- `SUPER_ADMIN` is the only role with `admins:manage` — this is the single mechanism that satisfies "prevent non-super-admins from assigning super-admin permissions" (and any other role): the escalation check is just "does the caller hold `admins:manage`," enforced in one place, not scattered.
- Each permission maps to specific existing routes per the controller table in §1.3 (full mapping table delivered as part of implementation PR, not duplicated here).

### 2.3 Guard design — layered, not replacing

```ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<Permission>('permission', context.getHandler());
    if (!required) return true; // no @RequirePermission() -> AdminGuard's binary check is sufficient
    const { user } = context.switchToHttp().getRequest();
    if (user.role !== 'admin') return false; // defense in depth, AdminGuard already guarantees this
    if (user.adminRole === 'SUPER_ADMIN') return true;
    return ROLE_PERMISSIONS[user.adminRole]?.includes(required) ?? false;
  }
}

export const RequirePermission = (perm: Permission) => SetMetadata('permission', perm);
```

Usage on an existing route — **additive decorator, existing guards untouched**:

```ts
@UseGuards(AuthGuard, AdminGuard, PermissionGuard)
@RequirePermission('products:manage')
@Post()
async create(...) { ... }
```

This means:
- `AuthGuard` and `AdminGuard` keep running exactly as they do today (nothing about their contract changes — the 5 pinned tests stay green).
- `PermissionGuard` runs third and is purely additive: routes without `@RequirePermission` are unaffected (back-compat for anything not yet migrated).
- No permission logic is duplicated in controllers/services — it's one guard + one map, used everywhere.

### 2.4 Admin management endpoints (new + hardened)

- `POST /api/auth/admin/create` — extended to accept `adminRole`, gated behind `admins:manage` (so only SUPER_ADMIN can create any admin, and specifically cannot be called by a non-super-admin to mint a `SUPER_ADMIN`). Writes an `AdminAuditLog` row.
- `GET /api/admin/admins` — new, `admins:manage` — list all admin users + their role + active status.
- `PUT /api/admin/admins/:id/role` — new, `admins:manage` — change an admin's `adminRole`. Explicit server-side check: **the caller must be `SUPER_ADMIN` to assign `SUPER_ADMIN`** (so the single existing `admins:manage` permission is not by itself sufficient for the highest-privilege assignment — a second, explicit check guards that specific case, directly satisfying the brief's most specific requirement). Logged.
- `PUT /api/admin/admins/:id/status` — new, `admins:manage` — activate/deactivate (reuses the existing `isActive` field already used by `customerAdminService.setAccountStatus`, same pattern). Logged. Guarded so a SUPER_ADMIN cannot deactivate themselves into a lockout if they're the last active SUPER_ADMIN (safety check).
- `GET /api/admin/admins/:id/activity` — new, `admins:manage` — reads `AdminAuditLog` filtered by `actorId`.

### 2.5 Frontend changes

- `ProtectedAdminLayout`: after confirming a session exists, also stash `adminRole` (already returned by `/api/auth/me` once the backend change ships) in a lightweight context/provider so pages and the sidebar can read it without each page re-fetching.
- `Sidebar.tsx`: `navItems` gains an optional `permission` field per item; items are filtered by a client-side permission map (the same `ROLE_PERMISSIONS` table, duplicated as a small frontend constant — this is UI convenience only, never trusted for security, which is why every backend route is independently guarded regardless of what the frontend hides).
- Per-page route guard: each `/admin/<section>/page.tsx` (or a small wrapper) checks the required permission for that section and redirects/shows a 403 state if absent — so a restricted admin can't land on a page by typing the URL even though the backend would reject their actual data calls anyway (defense in depth, not the primary security boundary).
- Settings page "Add Administrator" section becomes a full staff-management panel: create with role picker (only roles the current admin is allowed to grant — SUPER_ADMIN only control fully unlocked), list existing admins with role + active badge, change-role and deactivate actions, link to each admin's activity log.

---

## 3. What stays unchanged

- `AuthGuard`, `AdminGuard`, their existing tests, their existing behavior for every currently-working flow.
- `User.role` binary semantics — every piece of code checking `role === 'admin'` keeps working exactly as today.
- `SettingsAuditLog` and everything in `SettingsService`.
- All storefront code, all Phase B features, all Reviews code.
- No existing admin loses access as part of the migration — the backfill step assigns `SUPER_ADMIN` (full access) to every current admin before any permission check goes live.

## 4. Implementation plan (phase by phase, pending your go-ahead)

1. Prisma migration: additive `adminRole` on `User` + `AdminAuditLog` model + backfill existing admins to `SUPER_ADMIN`. Verify migration is pure-additive the same way Reviews' migration was verified (inspect generated SQL before applying).
2. Backend: `permissions.ts` (roles/map), `PermissionGuard` + `@RequirePermission()`, apply across the 12 controllers per §1.3/§2.2, extend `IdentityService`/`IdentityController` for role-aware admin creation + role/status management endpoints + `AdminAuditLog` writes, escalation checks.
3. Frontend: admin-role context, Sidebar permission filtering, per-page route guards, Settings page admin-management UI overhaul.
4. Testing (Task 5): unit tests for `PermissionGuard` + role map, integration tests hitting every protected endpoint as each of the 5 roles (permitted and denied cases) plus unauthenticated/customer cases, Prisma migration dry-run validation, full `tsc`/ESLint/test-suite/production build across `apps/api` and `apps/admin`.

No code changes have been made yet. Awaiting your confirmation (or adjustments — especially on the three flagged gaps in §1.5) before starting Phase 1.
