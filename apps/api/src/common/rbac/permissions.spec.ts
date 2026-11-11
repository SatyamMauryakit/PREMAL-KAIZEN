import { describe, it, expect } from 'vitest';
import { ADMIN_ROLES, ROLE_PERMISSIONS, PERMISSIONS, roleHasPermission, isAdminRole } from './permissions';

describe('RBAC permission map', () => {
  it('defines exactly the five roles required by the brief', () => {
    expect(ADMIN_ROLES).toEqual([
      'SUPER_ADMIN',
      'PRODUCT_MANAGER',
      'ORDER_MANAGER',
      'SUPPORT_MANAGER',
      'CONTENT_MANAGER',
    ]);
  });

  it('isAdminRole rejects anything not in the role list', () => {
    expect(isAdminRole('SUPER_ADMIN')).toBe(true);
    expect(isAdminRole('super_admin')).toBe(false);
    expect(isAdminRole('OWNER')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it('SUPER_ADMIN holds every defined permission', () => {
    for (const permission of PERMISSIONS) {
      expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain(permission);
    }
  });

  it('only SUPER_ADMIN can manage admins - no other role holds admins:manage', () => {
    for (const role of ADMIN_ROLES) {
      if (role === 'SUPER_ADMIN') continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain('admins:manage');
    }
  });

  it('only SUPER_ADMIN can hard-delete orders', () => {
    for (const role of ADMIN_ROLES) {
      if (role === 'SUPER_ADMIN') continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain('orders:delete');
    }
  });

  it('only SUPER_ADMIN can view financial settings (payment provider status)', () => {
    for (const role of ADMIN_ROLES) {
      if (role === 'SUPER_ADMIN') continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain('settings:financial');
    }
  });

  it('PRODUCT_MANAGER holds merchandising permissions but not orders/customers/settings', () => {
    const perms = ROLE_PERMISSIONS.PRODUCT_MANAGER;
    expect(perms).toContain('products:manage');
    expect(perms).toContain('categories:manage');
    expect(perms).toContain('inventory:manage');
    expect(perms).not.toContain('orders:process');
    expect(perms).not.toContain('customers:manage');
    expect(perms).not.toContain('settings:manage');
  });

  it('ORDER_MANAGER can process orders but cannot manage products, customers, or admins', () => {
    const perms = ROLE_PERMISSIONS.ORDER_MANAGER;
    expect(perms).toContain('orders:view');
    expect(perms).toContain('orders:process');
    expect(perms).not.toContain('products:manage');
    expect(perms).not.toContain('customers:manage');
    expect(perms).not.toContain('admins:manage');
  });

  it('SUPPORT_MANAGER can view customers/orders but cannot manage products or settings', () => {
    const perms = ROLE_PERMISSIONS.SUPPORT_MANAGER;
    expect(perms).toContain('customers:view');
    expect(perms).toContain('customers:manage');
    expect(perms).toContain('enquiries:view');
    expect(perms).not.toContain('products:manage');
    expect(perms).not.toContain('settings:manage');
  });

  it('CONTENT_MANAGER is restricted to content/review moderation only', () => {
    const perms = ROLE_PERMISSIONS.CONTENT_MANAGER;
    expect(perms).toContain('content:manage');
    expect(perms).toContain('reviews:moderate');
    expect(perms).not.toContain('orders:view');
    expect(perms).not.toContain('customers:view');
    expect(perms).not.toContain('products:manage');
  });

  describe('roleHasPermission', () => {
    it('returns false for a null/undefined role', () => {
      expect(roleHasPermission(null, 'products:manage')).toBe(false);
      expect(roleHasPermission(undefined, 'products:manage')).toBe(false);
    });

    it('returns true only when the role list actually contains the permission', () => {
      expect(roleHasPermission('ORDER_MANAGER', 'orders:process')).toBe(true);
      expect(roleHasPermission('ORDER_MANAGER', 'products:manage')).toBe(false);
    });
  });
});
