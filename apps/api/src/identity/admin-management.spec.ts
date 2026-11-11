/**
 * RBAC admin-management regression tests: creating admins with a granular
 * role, changing roles, and activating/deactivating accounts - with a focus
 * on the privilege-escalation rules (Phase C's most security-critical logic).
 */
import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IdentityService } from './identity.service';

function makePrisma(overrides: any = {}) {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any;
}

function makeEmailService() {
  return { sendWelcomeEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmailOtpEmail: vi.fn() } as any;
}

function makeAdminAuditLog() {
  return { log: vi.fn().mockResolvedValue(undefined), list: vi.fn() } as any;
}

const SUPER_ADMIN_ACTOR = { id: 'actor_super', email: 'super@store.com', adminRole: 'SUPER_ADMIN' as const };
const ORDER_MANAGER_ACTOR = { id: 'actor_om', email: 'om@store.com', adminRole: 'ORDER_MANAGER' as const };

describe('IdentityService.createAdmin', () => {
  it('a SUPER_ADMIN can create another SUPER_ADMIN', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null); // email not taken
    prisma.user.create.mockResolvedValue({
      id: 'new_admin', email: 'new@store.com', role: 'admin', adminRole: 'SUPER_ADMIN',
      firstName: null, lastName: null, password: 'hash', isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });
    const auditLog = makeAdminAuditLog();
    const service = new IdentityService(prisma, makeEmailService(), auditLog);

    const result = await service.createAdmin('new@store.com', 'Password1!', undefined, undefined, 'SUPER_ADMIN', SUPER_ADMIN_ACTOR);

    expect(result.adminRole).toBe('SUPER_ADMIN');
    expect(auditLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.create', actorId: 'actor_super' }));
  });

  it('a non-SUPER_ADMIN cannot create a SUPER_ADMIN (privilege escalation blocked)', async () => {
    const prisma = makePrisma();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(
      service.createAdmin('new@store.com', 'Password1!', undefined, undefined, 'SUPER_ADMIN', ORDER_MANAGER_ACTOR),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('a non-SUPER_ADMIN CAN create a restricted role (e.g. another ORDER_MANAGER)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new_admin', email: 'new@store.com', role: 'admin', adminRole: 'ORDER_MANAGER',
      firstName: null, lastName: null, password: 'hash', isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    const result = await service.createAdmin('new@store.com', 'Password1!', undefined, undefined, 'ORDER_MANAGER', ORDER_MANAGER_ACTOR);

    expect(result.adminRole).toBe('ORDER_MANAGER');
  });

  it('rejects an invalid adminRole value', async () => {
    const prisma = makePrisma();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(
      service.createAdmin('new@store.com', 'Password1!', undefined, undefined, 'OWNER' as any, SUPER_ADMIN_ACTOR),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('IdentityService.changeAdminRole', () => {
  it('a non-SUPER_ADMIN cannot promote anyone to SUPER_ADMIN', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'target', role: 'admin', adminRole: 'ORDER_MANAGER', email: 'target@store.com' });
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.changeAdminRole('target', 'SUPER_ADMIN', ORDER_MANAGER_ACTOR)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('a non-SUPER_ADMIN cannot demote an existing SUPER_ADMIN', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'target', role: 'admin', adminRole: 'SUPER_ADMIN', email: 'target@store.com' });
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.changeAdminRole('target', 'ORDER_MANAGER', ORDER_MANAGER_ACTOR)).rejects.toThrow(ForbiddenException);
  });

  it('refuses to demote the last active SUPER_ADMIN, even when the actor is a SUPER_ADMIN', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'target', role: 'admin', adminRole: 'SUPER_ADMIN', email: 'target@store.com' });
    prisma.user.count.mockResolvedValue(0); // no other active super admins
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.changeAdminRole('target', 'ORDER_MANAGER', SUPER_ADMIN_ACTOR)).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows demoting a SUPER_ADMIN when another active SUPER_ADMIN remains', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'target', role: 'admin', adminRole: 'SUPER_ADMIN', email: 'target@store.com' });
    prisma.user.count.mockResolvedValue(1); // one other active super admin exists
    prisma.user.update.mockResolvedValue({ id: 'target', role: 'admin', adminRole: 'ORDER_MANAGER', email: 'target@store.com', password: 'hash' });
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    const result = await service.changeAdminRole('target', 'ORDER_MANAGER', SUPER_ADMIN_ACTOR);

    expect(result.adminRole).toBe('ORDER_MANAGER');
    expect((result as any).password).toBeUndefined();
  });

  it('404s when the target is not an admin at all', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'target', role: 'customer', adminRole: null, email: 'c@store.com' });
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.changeAdminRole('target', 'ORDER_MANAGER', SUPER_ADMIN_ACTOR)).rejects.toThrow(NotFoundException);
  });
});

describe('IdentityService.setAdminStatus', () => {
  it('refuses to deactivate the last active SUPER_ADMIN', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'target', role: 'admin', adminRole: 'SUPER_ADMIN', email: 'target@store.com' });
    prisma.user.count.mockResolvedValue(0);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.setAdminStatus('target', false, SUPER_ADMIN_ACTOR)).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows deactivating a non-SUPER_ADMIN admin freely', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'target', role: 'admin', adminRole: 'ORDER_MANAGER', email: 'target@store.com' });
    prisma.user.update.mockResolvedValue({ id: 'target', role: 'admin', adminRole: 'ORDER_MANAGER', isActive: false, password: 'hash' });
    const auditLog = makeAdminAuditLog();
    const service = new IdentityService(prisma, makeEmailService(), auditLog);

    const result = await service.setAdminStatus('target', false, SUPER_ADMIN_ACTOR);

    expect(result.isActive).toBe(false);
    expect(auditLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.deactivate' }));
  });
});
