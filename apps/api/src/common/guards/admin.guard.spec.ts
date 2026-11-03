import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function makeContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

function makePrismaWithSession(session: any) {
  return { session: { findUnique: vi.fn().mockResolvedValue(session) } } as any;
}

/**
 * Covers "Unauthorized attempts to change Payment Settings": the admin Payment
 * Settings endpoints (SettingsController) are protected by @UseGuards(AuthGuard,
 * AdminGuard) at the controller level, so this guard's behavior is exactly what
 * stands between an unauthorized caller and a settings change.
 */
describe('AdminGuard', () => {
  it('rejects a request with no session token at all', async () => {
    const guard = new AdminGuard(makePrismaWithSession(null));
    const request: any = { headers: {}, cookies: {} };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired session', async () => {
    const guard = new AdminGuard(
      makePrismaWithSession({
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'u1', role: 'admin', isActive: true },
      }),
    );
    const request: any = { headers: { authorization: 'Bearer expired-token' }, cookies: {} };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a valid, logged-in session that is NOT an admin', async () => {
    const guard = new AdminGuard(
      makePrismaWithSession({
        token: 'customer-token',
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', role: 'customer', isActive: true, password: 'hash' },
      }),
    );
    const request: any = { headers: { authorization: 'Bearer customer-token' }, cookies: {} };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('rejects a disabled admin account', async () => {
    const guard = new AdminGuard(
      makePrismaWithSession({
        token: 'disabled-admin-token',
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', role: 'admin', isActive: false, password: 'hash' },
      }),
    );
    const request: any = { headers: { authorization: 'Bearer disabled-admin-token' }, cookies: {} };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('allows a valid, active admin session through and populates req.user without the password', async () => {
    const guard = new AdminGuard(
      makePrismaWithSession({
        token: 'admin-token',
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', role: 'admin', isActive: true, password: 'super-secret-hash' },
      }),
    );
    const request: any = { headers: { authorization: 'Bearer admin-token' }, cookies: {} };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.user.role).toBe('admin');
    expect(request.user.password).toBeUndefined();
  });
});
