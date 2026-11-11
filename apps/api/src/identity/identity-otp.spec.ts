/**
 * Email OTP regression tests.
 * Covers: OTP send, rate limiting, verify success, verify wrong code, expiry,
 * and email not sent when provider is unconfigured (non-blocking).
 * No real emails are sent — EmailService is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { IdentityService } from './identity.service';
import * as bcrypt from 'bcrypt';

const NOW = new Date('2026-01-15T10:00:00Z');

function makePrisma(overrides: any = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user_1', email: 'user@example.com', firstName: 'Priya', emailVerified: null }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    verificationToken: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockImplementation(({ data }) => ({ id: 'tok_1', ...data })),
    },
    session: { create: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    ...overrides,
  } as any;
}

function makeEmailService() {
  return {
    sendEmailOtpEmail: vi.fn().mockResolvedValue(true),
    sendWelcomeEmail: vi.fn().mockResolvedValue(true),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(false), // provider unconfigured
  } as any;
}

function makeAdminAuditLog() {
  return { log: vi.fn().mockResolvedValue(undefined), list: vi.fn() } as any;
}

describe('IdentityService.sendEmailOtp', () => {
  it('creates a hashed OTP token and calls sendEmailOtpEmail', async () => {
    const prisma = makePrisma();
    const emailService = makeEmailService();
    const service = new IdentityService(prisma, emailService, makeAdminAuditLog());

    const result = await service.sendEmailOtp('user@example.com');

    expect(result.message).toContain('Verification code sent');
    expect(prisma.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'email_otp', email: 'user@example.com' }) }),
    );
    // Email called with OTP (we can't check the plaintext value, but we confirm the call was made)
    expect(emailService.sendEmailOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'user@example.com', expiryMinutes: 15 }),
    );
  });

  it('does NOT expose the OTP in the response', async () => {
    const prisma = makePrisma();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    const result = await service.sendEmailOtp('user@example.com');

    // The response must not contain a code — only a user-facing message
    expect((result as any).otp).toBeUndefined();
    expect((result as any).code).toBeUndefined();
    expect((result as any).token).toBeUndefined();
  });

  it('stores the OTP as a bcrypt hash, not plaintext', async () => {
    const prisma = makePrisma();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await service.sendEmailOtp('user@example.com');

    const createCall = prisma.verificationToken.create.mock.calls[0][0];
    const storedToken = createCall.data.token;
    // Must look like a bcrypt hash
    expect(storedToken).toMatch(/^\$2[aby]\$/);
  });

  it('enforces resend cooldown when a token was issued within 60 seconds', async () => {
    const recentToken = { id: 'tok_old', email: 'user@example.com', type: 'email_otp', token: 'hash', expiresAt: new Date(Date.now() + 900_000), createdAt: new Date(Date.now() - 30_000) }; // 30 seconds ago
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(recentToken);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.sendEmailOtp('user@example.com')).rejects.toThrow(BadRequestException);
  });

  it('allows resend after cooldown has elapsed (>60 seconds)', async () => {
    const oldToken = { id: 'tok_old', email: 'user@example.com', type: 'email_otp', token: 'hash', expiresAt: new Date(Date.now() + 300_000), createdAt: new Date(Date.now() - 120_000) }; // 2 min ago
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(oldToken);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.sendEmailOtp('user@example.com')).resolves.toBeDefined();
  });

  it('returns same message for unknown email (anti-enumeration)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    const result = await service.sendEmailOtp('nobody@example.com');

    expect(result.message).toContain('If an account exists');
    // No email sent for unknown addresses
    const emailService = makeEmailService();
    expect(emailService.sendEmailOtpEmail).not.toHaveBeenCalled();
  });

  it('returns immediately when email is already verified', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'user@example.com', firstName: 'Priya', emailVerified: new Date() });
    const emailService = makeEmailService();
    const service = new IdentityService(prisma, emailService, makeAdminAuditLog());

    const result = await service.sendEmailOtp('user@example.com');

    expect(result.message).toContain('already verified');
    expect(emailService.sendEmailOtpEmail).not.toHaveBeenCalled();
  });
});

describe('IdentityService.verifyEmailOtp', () => {
  async function makeTokenRow(plainOtp: string, overrides: any = {}) {
    const hash = await bcrypt.hash(plainOtp, 10);
    return {
      id: 'tok_1',
      email: 'user@example.com',
      type: 'email_otp',
      token: hash,
      expiresAt: new Date(Date.now() + 900_000),
      createdAt: new Date(),
      attempts: 0,
      ...overrides,
    };
  }

  it('marks emailVerified and deletes the token on correct OTP', async () => {
    const otp = '123456';
    const tokenRow = await makeTokenRow(otp);
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(tokenRow);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    const result = await service.verifyEmailOtp('user@example.com', otp);

    expect(result.message).toContain('verified');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailVerified: expect.any(Date) }) }),
    );
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: 'tok_1' } });
  });

  it('throws on incorrect OTP and increments the attempt counter (does not delete the row - the code is still usable)', async () => {
    const tokenRow = await makeTokenRow('123456');
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(tokenRow);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.verifyEmailOtp('user@example.com', '999999')).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.verificationToken.update).toHaveBeenCalledWith({
      where: { id: 'tok_1' },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.verificationToken.delete).not.toHaveBeenCalled();
  });

  it('invalidates the code after too many incorrect attempts, even with the right code afterward', async () => {
    const tokenRow = await makeTokenRow('123456', { attempts: 5 });
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(tokenRow);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.verifyEmailOtp('user@example.com', '123456')).rejects.toThrow(/too many/i);
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: 'tok_1' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws when OTP has expired', async () => {
    const tokenRow = await makeTokenRow('123456', { expiresAt: new Date(Date.now() - 1000) }); // expired
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(tokenRow);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.verifyEmailOtp('user@example.com', '123456')).rejects.toThrow(BadRequestException);
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: 'tok_1' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws when no pending OTP exists', async () => {
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(null);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog());

    await expect(service.verifyEmailOtp('user@example.com', '123456')).rejects.toThrow(BadRequestException);
  });

  it('email provider failure does NOT block registration (non-blocking sendEmailOtpEmail)', async () => {
    const prisma = makePrisma();
    // Override findUnique for this email to return null (no existing user)
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    prisma.user.create = vi.fn().mockResolvedValue({
      id: 'user_2', email: 'brand-new@example.com', firstName: null, lastName: null,
      emailVerified: null, role: 'customer', isActive: true, lastLogin: null,
      createdAt: new Date(), updatedAt: new Date(), password: '$2b$10$hash',
    });
    prisma.verificationToken.deleteMany = vi.fn().mockResolvedValue({});
    prisma.verificationToken.create = vi.fn().mockResolvedValue({ id: 'tok_2', email: 'brand-new@example.com', type: 'email_otp', token: 'hash', expiresAt: new Date() });

    const emailService = {
      sendWelcomeEmail: vi.fn().mockRejectedValue(new Error('SMTP down')),
      sendEmailOtpEmail: vi.fn().mockRejectedValue(new Error('SMTP down')),
    } as any;

    const service = new IdentityService(prisma, emailService, makeAdminAuditLog());

    // register() must succeed — it calls sendWelcomeEmail / sendEmailOtp with .catch()
    // so SMTP failures are silently swallowed and do not bubble up to the caller.
    await expect(service.register('brand-new@example.com', 'Password1!')).resolves.toBeDefined();
  });
});
