/**
 * Frontend mirror of apps/api/src/common/rbac/permissions.ts - used ONLY to
 * decide what to show/hide in the UI (nav visibility, route guards, disabled
 * buttons). This is never the actual security boundary: every protected API
 * route independently re-checks the same permission server-side via
 * PermissionGuard, so hiding something here never substitutes for that.
 */

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'PRODUCT_MANAGER',
  'ORDER_MANAGER',
  'SUPPORT_MANAGER',
  'CONTENT_MANAGER',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  PRODUCT_MANAGER: 'Product Manager',
  ORDER_MANAGER: 'Order Manager',
  SUPPORT_MANAGER: 'Support Manager',
  CONTENT_MANAGER: 'Content Manager',
};

export type Permission =
  | 'dashboard:view'
  | 'analytics:view'
  | 'settings:financial'
  | 'products:view'
  | 'products:manage'
  | 'categories:manage'
  | 'inventory:manage'
  | 'uploads:manage'
  | 'promotions:manage'
  | 'orders:view'
  | 'orders:process'
  | 'orders:delete'
  | 'customers:view'
  | 'customers:manage'
  | 'enquiries:view'
  | 'reviews:moderate'
  | 'content:manage'
  | 'settings:view'
  | 'settings:manage'
  | 'admins:manage';

const ALL_PERMISSIONS: Permission[] = [
  'dashboard:view', 'analytics:view', 'settings:financial',
  'products:view', 'products:manage', 'categories:manage', 'inventory:manage', 'uploads:manage', 'promotions:manage',
  'orders:view', 'orders:process', 'orders:delete',
  'customers:view', 'customers:manage', 'enquiries:view',
  'reviews:moderate', 'content:manage',
  'settings:view', 'settings:manage', 'admins:manage',
];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  PRODUCT_MANAGER: [
    'dashboard:view', 'products:view', 'products:manage', 'categories:manage', 'inventory:manage', 'uploads:manage', 'promotions:manage',
  ],
  ORDER_MANAGER: ['dashboard:view', 'orders:view', 'orders:process'],
  SUPPORT_MANAGER: ['dashboard:view', 'customers:view', 'customers:manage', 'enquiries:view', 'orders:view'],
  CONTENT_MANAGER: ['dashboard:view', 'content:manage', 'reviews:moderate'],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function roleHasPermission(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
