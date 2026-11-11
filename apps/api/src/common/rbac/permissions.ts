/**
 * Single source of truth for admin RBAC: the five granular admin roles and the
 * permission each one carries. Adding a new protected action should mean adding
 * one permission string here and one @RequirePermission() on the route - never
 * a hardcoded role/email check inside a controller or service.
 */

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'PRODUCT_MANAGER',
  'ORDER_MANAGER',
  'SUPPORT_MANAGER',
  'CONTENT_MANAGER',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export const PERMISSIONS = [
  // Dashboard / financial
  'dashboard:view',
  'analytics:view',
  'settings:financial',

  // Products & merchandising
  'products:view',
  'products:manage',
  'categories:manage',
  'inventory:manage',
  'uploads:manage',
  'promotions:manage',

  // Orders
  'orders:view',
  'orders:process',
  'orders:delete', // Hard-delete only - SUPER_ADMIN only, deliberately excluded from
                   // ORDER_MANAGER's list since the brief scopes that role to
                   // "eligible cancellations" (a status change), not permanent deletion.

  // Customers / support
  'customers:view',
  'customers:manage',
  'enquiries:view',

  // Reviews
  'reviews:moderate',

  // Content (no backend model exists yet - see ADMIN_AUDIT_PHASE_C.md gap #1;
  // this permission is defined so CONTENT_MANAGER is wired for when one is built)
  'content:manage',

  // Settings
  'settings:view',
  'settings:manage',

  // Admin/staff management - the escalation-sensitive permission. Held only by
  // SUPER_ADMIN. Assigning SUPER_ADMIN itself additionally requires the caller
  // to already be SUPER_ADMIN (checked explicitly in the admin-management
  // endpoints, not derived from this permission alone).
  'admins:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],

  PRODUCT_MANAGER: [
    'dashboard:view',
    'products:view',
    'products:manage',
    'categories:manage',
    'inventory:manage',
    'uploads:manage',
    'promotions:manage',
  ],

  ORDER_MANAGER: [
    'dashboard:view',
    'orders:view',
    'orders:process',
  ],

  SUPPORT_MANAGER: [
    'dashboard:view',
    'customers:view',
    'customers:manage',
    'enquiries:view',
    'orders:view',
  ],

  // Reviews aren't assigned to any role in the original brief; moderating
  // user-submitted review text is treated as website-content moderation, so
  // it's assigned here alongside content:manage (see ADMIN_AUDIT_PHASE_C.md).
  CONTENT_MANAGER: [
    'dashboard:view',
    'content:manage',
    'reviews:moderate',
  ],
};

export function roleHasPermission(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
