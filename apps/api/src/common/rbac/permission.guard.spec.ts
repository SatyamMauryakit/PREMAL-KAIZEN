import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';

function makeContext(request: any, metadata: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function makeReflector(metadata: string | undefined) {
  return { getAllAndOverride: vi.fn().mockReturnValue(metadata) } as any;
}

describe('PermissionGuard', () => {
  it('allows the request through when the route has no @RequirePermission()', () => {
    const guard = new PermissionGuard(makeReflector(undefined));
    const request = { user: { role: 'admin', adminRole: 'ORDER_MANAGER' } };

    expect(guard.canActivate(makeContext(request, undefined))).toBe(true);
  });

  it('rejects when req.user is missing entirely (AuthGuard should have run first, but defense in depth)', () => {
    const guard = new PermissionGuard(makeReflector('products:manage'));
    const request = {};

    expect(() => guard.canActivate(makeContext(request, 'products:manage'))).toThrow(ForbiddenException);
  });

  it('rejects a non-admin role even if adminRole is somehow set', () => {
    const guard = new PermissionGuard(makeReflector('products:manage'));
    const request = { user: { role: 'customer', adminRole: 'SUPER_ADMIN' } };

    expect(() => guard.canActivate(makeContext(request, 'products:manage'))).toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN passes every permission check regardless of the required permission', () => {
    const guard = new PermissionGuard(makeReflector('admins:manage'));
    const request = { user: { role: 'admin', adminRole: 'SUPER_ADMIN' } };

    expect(guard.canActivate(makeContext(request, 'admins:manage'))).toBe(true);
  });

  it('allows a role that holds the required permission', () => {
    const guard = new PermissionGuard(makeReflector('orders:process'));
    const request = { user: { role: 'admin', adminRole: 'ORDER_MANAGER' } };

    expect(guard.canActivate(makeContext(request, 'orders:process'))).toBe(true);
  });

  it('rejects a role that does not hold the required permission', () => {
    const guard = new PermissionGuard(makeReflector('admins:manage'));
    const request = { user: { role: 'admin', adminRole: 'ORDER_MANAGER' } };

    expect(() => guard.canActivate(makeContext(request, 'admins:manage'))).toThrow(ForbiddenException);
  });

  it('rejects an admin whose adminRole is null (pre-migration edge case / malformed data)', () => {
    const guard = new PermissionGuard(makeReflector('orders:view'));
    const request = { user: { role: 'admin', adminRole: null } };

    expect(() => guard.canActivate(makeContext(request, 'orders:view'))).toThrow(ForbiddenException);
  });

  it('rejects an unrecognized adminRole value rather than silently allowing', () => {
    const guard = new PermissionGuard(makeReflector('orders:view'));
    const request = { user: { role: 'admin', adminRole: 'NOT_A_REAL_ROLE' } };

    expect(() => guard.canActivate(makeContext(request, 'orders:view'))).toThrow(ForbiddenException);
  });
});
