/**
 * Login regression tests for the mandatory two-step login flow:
 *   1. POST /login - validates credentials, never issues a session for a
 *      customer (only `requiresOtp: true` once a fresh login OTP is sent).
 *   2. POST /login/verify-otp - the *only* place a customer session is ever
 *      created.
 * Admin accounts are exempt from step 2 entirely (the admin panel shares
 * this exact endpoint and has no OTP-entry UI - see IdentityService.login).
 */
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IdentityService } from './identity.service';

async function makeUser(overrides: any = {}) {
  const password = await bcrypt.hash('Password1!', 10);
  return {
    id: 'user_1',
    email: 'user@example.com',
    password,
    role: 'customer',
    adminRole: null,
    isActive: true,
    emailVerified: null,
    lastLogin: null,
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
}

function makePrisma(user: any, overrides: any = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue(user),
    },
    session: {
      create: vi.fn().mockResolvedValue({ id: 'sess_1', token: 'sometoken', expiresAt: new Date() }),
    },
    verificationToken: {
      findFirst: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockImplementation(({ data }: any) => ({ id: 'tok_1', attempts: 0, ...data })),
    },
    ...overrides,
  } as any;
}

function makeService(prisma: any) {
  const emailService = { sendWelcomeEmail: vi.fn(), sendEmailOtpEmail: vi.fn().mockResolvedValue(true) } as any;
  const adminAuditLog = { log: vi.fn(), list: vi.fn() } as any;
  return new IdentityService(prisma, emailService, adminAuditLog);
}

describe('IdentityService.login - step 1 (credentials)', () => {
  it('rejects a customer with an unverified email, even with the correct password', async () => {
    const user = await makeUser({ emailVerified: null });
    const prisma = makePrisma(user);
    const service = makeService(prisma);

    await expect(service.login('user@example.com', 'Password1!')).rejects.toThrow(ForbiddenException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('the EMAIL_NOT_VERIFIED rejection carries a machine-readable code and the email', async () => {
    const user = await makeUser({ emailVerified: null });
    const prisma = makePrisma(user);
    const service = makeService(prisma);

    try {
      await service.login('user@example.com', 'Password1!');
      expect.unreachable('should have thrown');
    } catch (err) {
      const response = (err as ForbiddenException).getResponse() as any;
      expect(response.code).toBe('EMAIL_NOT_VERIFIED');
      expect(response.email).toBe('user@example.com');
    }
  });

  it('a verified customer with the correct password gets requiresOtp:true, NEVER a session', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    const emailService = { sendWelcomeEmail: vi.fn(), sendEmailOtpEmail: vi.fn().mockResolvedValue(true) } as any;
    const service = new IdentityService(prisma, emailService, { log: vi.fn(), list: vi.fn() } as any);

    const result = await service.login('user@example.com', 'Password1!');

    expect(result).toEqual({
      requiresOtp: true,
      email: 'user@example.com',
      message: expect.any(String),
    });
    expect((result as any).sessionToken).toBeUndefined();
    expect(prisma.session.create).not.toHaveBeenCalled();
    // A real login OTP was actually issued and emailed.
    expect(prisma.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'login_otp', email: 'user@example.com' }) }),
    );
    expect(emailService.sendEmailOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'user@example.com', expiryMinutes: 5 }),
    );
  });

  it('admin accounts bypass the login-OTP step entirely and get a session directly', async () => {
    const user = await makeUser({ role: 'admin', adminRole: 'SUPER_ADMIN', emailVerified: null });
    const prisma = makePrisma(user);
    const service = makeService(prisma);

    const result = await service.login('user@example.com', 'Password1!');

    expect((result as any).sessionToken).toBe('sometoken');
    expect(prisma.session.create).toHaveBeenCalled();
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it('still rejects a wrong password before ever reaching the OTP step', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    const service = makeService(prisma);

    await expect(service.login('user@example.com', 'WrongPassword!')).rejects.toThrow(UnauthorizedException);
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it('does not spam a fresh OTP/email on a repeated login attempt within the cooldown window', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    const recentToken = { id: 'tok_old', email: 'user@example.com', type: 'login_otp', token: 'hash', attempts: 0, expiresAt: new Date(Date.now() + 300_000), createdAt: new Date(Date.now() - 10_000) };
    prisma.verificationToken.findFirst.mockResolvedValue(recentToken);
    const emailService = { sendWelcomeEmail: vi.fn(), sendEmailOtpEmail: vi.fn().mockResolvedValue(true) } as any;
    const service = new IdentityService(prisma, emailService, { log: vi.fn(), list: vi.fn() } as any);

    const result = await service.login('user@example.com', 'Password1!');

    expect((result as any).requiresOtp).toBe(true);
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
    expect(emailService.sendEmailOtpEmail).not.toHaveBeenCalled();
  });
});

describe('IdentityService.verifyLoginOtp - step 2 (the only place a customer session is created)', () => {
  async function makeLoginOtpRow(plainOtp: string, overrides: any = {}) {
    const hash = await bcrypt.hash(plainOtp, 10);
    return {
      id: 'tok_1',
      email: 'user@example.com',
      type: 'login_otp',
      token: hash,
      expiresAt: new Date(Date.now() + 300_000),
      createdAt: new Date(),
      attempts: 0,
      ...overrides,
    };
  }

  it('issues a real session on the correct code, and deletes the token (single-use)', async () => {
    const otp = '123456';
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    prisma.verificationToken.findFirst.mockResolvedValue(await makeLoginOtpRow(otp));
    const service = makeService(prisma);

    const result = await service.verifyLoginOtp('user@example.com', otp);

    expect(result.sessionToken).toBe('sometoken');
    expect(result.user.email).toBe('user@example.com');
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: 'tok_1' } });
  });

  it('rejects an incorrect code and increments the attempt counter, without issuing a session', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    prisma.verificationToken.findFirst.mockResolvedValue(await makeLoginOtpRow('123456'));
    const service = makeService(prisma);

    await expect(service.verifyLoginOtp('user@example.com', '999999')).rejects.toThrow(BadRequestException);
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(prisma.verificationToken.update).toHaveBeenCalledWith({
      where: { id: 'tok_1' },
      data: { attempts: { increment: 1 } },
    });
  });

  it('rejects an expired code, without issuing a session', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    prisma.verificationToken.findFirst.mockResolvedValue(await makeLoginOtpRow('123456', { expiresAt: new Date(Date.now() - 1000) }));
    const service = makeService(prisma);

    await expect(service.verifyLoginOtp('user@example.com', '123456')).rejects.toThrow(/expired/i);
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: 'tok_1' } });
  });

  it('rejects after too many incorrect attempts, even with the right code', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    prisma.verificationToken.findFirst.mockResolvedValue(await makeLoginOtpRow('123456', { attempts: 5 }));
    const service = makeService(prisma);

    await expect(service.verifyLoginOtp('user@example.com', '123456')).rejects.toThrow(/too many/i);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('rejects when no login OTP is pending at all (e.g. never requested, or a direct API call skipping step 1)', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    // findFirst already defaults to null in makePrisma - nothing pending.
    const service = makeService(prisma);

    await expect(service.verifyLoginOtp('user@example.com', '123456')).rejects.toThrow(BadRequestException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('a verified code cannot be replayed - the second verify attempt with the same code fails', async () => {
    const otp = '123456';
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    const tokenRow = await makeLoginOtpRow(otp);
    prisma.verificationToken.findFirst
      .mockResolvedValueOnce(tokenRow) // first verify: token is still there
      .mockResolvedValueOnce(null); // second verify: already deleted by the first
    const service = makeService(prisma);

    await expect(service.verifyLoginOtp('user@example.com', otp)).resolves.toBeDefined();
    await expect(service.verifyLoginOtp('user@example.com', otp)).rejects.toThrow(BadRequestException);
  });
});

describe('IdentityService.resendLoginOtp', () => {
  it('only sends a fresh code when a login OTP is already pending (never a password-free trigger for an arbitrary email)', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    // No pending token at all.
    const service = makeService(prisma);

    const result = await service.resendLoginOtp('user@example.com');

    expect(result.message).toContain('If a login is in progress');
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it('enforces the resend cooldown when a code was just issued', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    prisma.verificationToken.findFirst.mockResolvedValue({
      id: 'tok_1', email: 'user@example.com', type: 'login_otp', token: 'hash', attempts: 0,
      expiresAt: new Date(Date.now() + 300_000), createdAt: new Date(Date.now() - 10_000),
    });
    const service = makeService(prisma);

    await expect(service.resendLoginOtp('user@example.com')).rejects.toThrow(/wait/i);
  });

  it('sends a fresh code once the cooldown has elapsed and a login was already in progress', async () => {
    const user = await makeUser({ emailVerified: new Date() });
    const prisma = makePrisma(user);
    prisma.verificationToken.findFirst.mockResolvedValue({
      id: 'tok_1', email: 'user@example.com', type: 'login_otp', token: 'hash', attempts: 0,
      expiresAt: new Date(Date.now() + 300_000), createdAt: new Date(Date.now() - 120_000),
    });
    const emailService = { sendWelcomeEmail: vi.fn(), sendEmailOtpEmail: vi.fn().mockResolvedValue(true) } as any;
    const service = new IdentityService(prisma, emailService, { log: vi.fn(), list: vi.fn() } as any);

    const result = await service.resendLoginOtp('user@example.com');

    expect(result.message).toContain('new verification code has been sent');
    expect(emailService.sendEmailOtpEmail).toHaveBeenCalled();
  });
});
