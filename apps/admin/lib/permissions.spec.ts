import { describe, it, expect } from 'vitest';
import { ADMIN_ROLES, ROLE_PERMISSIONS, roleHasPermission } from './permissions';

describe('frontend permission mirror (nav/route-guard UX only, not a security boundary)', () => {
  it('defines the same five roles as the backend', () => {
    expect(ADMIN_ROLES).toEqual([
      'SUPER_ADMIN',
      'PRODUCT_MANAGER',
      'ORDER_MANAGER',
      'SUPPORT_MANAGER',
      'CONTENT_MANAGER',
    ]);
  });

  it('only SUPER_ADMIN holds admins:manage, so the Administrators tab stays hidden for everyone else', () => {
    for (const role of ADMIN_ROLES) {
      if (role === 'SUPER_ADMIN') continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain('admins:manage');
    }
  });

  it('roleHasPermission matches ROLE_PERMISSIONS membership', () => {
    expect(roleHasPermission('ORDER_MANAGER', 'orders:process')).toBe(true);
    expect(roleHasPermission('ORDER_MANAGER', 'settings:manage')).toBe(false);
    expect(roleHasPermission(null, 'dashboard:view')).toBe(false);
  });
});
