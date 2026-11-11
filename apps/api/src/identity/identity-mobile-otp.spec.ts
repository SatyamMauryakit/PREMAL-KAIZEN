/**
 * Mobile OTP regression tests (Section 4 of the mega-prompt).
 * Mirrors identity-otp.spec.ts's email-OTP coverage exactly: send, rate
 * limiting, verify success/wrong/expired, and provider-unconfigured safety.
 * No real SMS is sent — SmsService is mocked.
 */
import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { IdentityService } from './identity.service';
import * as bcrypt from 'bcrypt';

function makePrisma(overrides: any = {}) {
  return {
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'user_1', phoneNumber: '+919876543210', phoneVerified: null }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    verificationToken: {
      findFirst: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockImplementation(({ data }) => ({ id: 'tok_1', ...data })),
    },
    ...overrides,
  } as any;
}

function makeEmailService() {
  return { sendWelcomeEmail: vi.fn().mockResolvedValue(true), sendEmailOtpEmail: vi.fn().mockResolvedValue(true) } as any;
}

function makeSmsService() {
  return { sendMobileOtp: vi.fn().mockResolvedValue(true) } as any;
}

function makeAdminAuditLog() {
  return { log: vi.fn(), list: vi.fn() } as any;
}

describe('IdentityService.sendMobileOtp', () => {
  it('creates a hashed OTP token and calls SmsService.sendMobileOtp', async () => {
    const prisma = makePrisma();
    const smsService = makeSmsService();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), smsService);

    const result = await service.sendMobileOtp('+919876543210');

    expect(result.message).toContain('Verification code sent');
    expect(prisma.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'mobile_otp', email: '+919876543210' }) }),
    );
    expect(smsService.sendMobileOtp).toHaveBeenCalledWith('+919876543210', expect.any(String), 5);
  });

  it('normalizes a bare 10-digit Indian number by prefixing +91', async () => {
    const prisma = makePrisma();
    const smsService = makeSmsService();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), smsService);

    await service.sendMobileOtp('9876543210');

    expect(prisma.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: '+919876543210' }) }),
    );
  });

  it('does NOT expose the OTP in the response', async () => {
    const prisma = makePrisma();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), makeSmsService());

    const result = await service.sendMobileOtp('+919876543210');

    expect((result as any).otp).toBeUndefined();
    expect((result as any).code).toBeUndefined();
  });

  it('stores the OTP as a bcrypt hash, not plaintext', async () => {
    const prisma = makePrisma();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), makeSmsService());

    await service.sendMobileOtp('+919876543210');

    const storedToken = prisma.verificationToken.create.mock.calls[0][0].data.token;
    expect(storedToken).toMatch(/^\$2[aby]\$/);
  });

  it('enforces a resend cooldown within 60 seconds', async () => {
    const recentToken = { id: 'tok_old', email: '+919876543210', type: 'mobile_otp', token: 'hash', expiresAt: new Date(Date.now() + 300_000), createdAt: new Date(Date.now() - 30_000) };
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(recentToken);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), makeSmsService());

    await expect(service.sendMobileOtp('+919876543210')).rejects.toThrow(BadRequestException);
  });

  it('returns the same anti-enumeration message for a phone number with no account', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const smsService = makeSmsService();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), smsService);

    const result = await service.sendMobileOtp('+919876543210');

    expect(result.message).toContain('If an account exists');
    expect(smsService.sendMobileOtp).not.toHaveBeenCalled();
  });

  it('returns immediately when the mobile number is already verified', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ id: 'user_1', phoneNumber: '+919876543210', phoneVerified: new Date() });
    const smsService = makeSmsService();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), smsService);

    const result = await service.sendMobileOtp('+919876543210');

    expect(result.message).toContain('already verified');
    expect(smsService.sendMobileOtp).not.toHaveBeenCalled();
  });

  it('never throws even when SmsService is not configured (provider-gated, non-blocking)', async () => {
    const prisma = makePrisma();
    // Simulate SmsService.sendMobileOtp resolving false (unconfigured) rather than throwing -
    // matches the real SmsService's never-throw contract.
    const smsService = { sendMobileOtp: vi.fn().mockResolvedValue(false) } as any;
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), smsService);

    await expect(service.sendMobileOtp('+919876543210')).resolves.toBeDefined();
  });
});

describe('IdentityService.verifyMobileOtp', () => {
  async function makeTokenRow(plainOtp: string, overrides: any = {}) {
    const hash = await bcrypt.hash(plainOtp, 10);
    return {
      id: 'tok_1',
      email: '+919876543210',
      type: 'mobile_otp',
      token: hash,
      expiresAt: new Date(Date.now() + 300_000),
      createdAt: new Date(),
      attempts: 0,
      ...overrides,
    };
  }

  it('marks phoneVerified and deletes the token on correct OTP', async () => {
    const otp = '123456';
    const tokenRow = await makeTokenRow(otp);
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(tokenRow);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), makeSmsService());

    const result = await service.verifyMobileOtp('+919876543210', otp);

    expect(result.message).toContain('verified');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phoneVerified: expect.any(Date) }) }),
    );
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: 'tok_1' } });
  });

  it('throws on incorrect OTP and increments the attempt counter', async () => {
    const tokenRow = await makeTokenRow('123456');
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(tokenRow);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), makeSmsService());

    await expect(service.verifyMobileOtp('+919876543210', '999999')).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.verificationToken.update).toHaveBeenCalledWith({
      where: { id: 'tok_1' },
      data: { attempts: { increment: 1 } },
    });
  });

  it('invalidates the code after too many incorrect attempts', async () => {
    const tokenRow = await makeTokenRow('123456', { attempts: 5 });
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(tokenRow);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), makeSmsService());

    await expect(service.verifyMobileOtp('+919876543210', '123456')).rejects.toThrow(/too many/i);
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: 'tok_1' } });
  });

  it('throws when the OTP has expired (and cleans up the expired token)', async () => {
    const tokenRow = await makeTokenRow('123456', { expiresAt: new Date(Date.now() - 1000) });
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(tokenRow);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), makeSmsService());

    await expect(service.verifyMobileOtp('+919876543210', '123456')).rejects.toThrow(BadRequestException);
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: 'tok_1' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws when no pending OTP exists', async () => {
    const prisma = makePrisma();
    prisma.verificationToken.findFirst.mockResolvedValue(null);
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), makeSmsService());

    await expect(service.verifyMobileOtp('+919876543210', '123456')).rejects.toThrow(BadRequestException);
  });
});

describe('IdentityService.register - optional phone number', () => {
  it('stores the normalized phone number and auto-sends a mobile OTP when provided', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique = vi.fn().mockResolvedValue(null); // no existing account with this email
    prisma.user.create = vi.fn().mockResolvedValue({
      id: 'user_2', email: 'new@example.com', firstName: null, lastName: null, phoneNumber: '+919876543210',
      emailVerified: null, phoneVerified: null, role: 'customer', isActive: true, lastLogin: null,
      createdAt: new Date(), updatedAt: new Date(), password: '$2b$10$hash',
    });
    const smsService = makeSmsService();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), smsService);

    await service.register('new@example.com', 'Password1!', 'New', 'User', '9876543210');

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phoneNumber: '+919876543210' }) }),
    );
    // sendMobileOtp is fire-and-forget (.catch()) and does a real bcrypt.hash
    // internally (libuv threadpool, not just microtasks) before reaching the SMS
    // call - poll instead of a fixed sleep so this isn't flaky under load.
    await vi.waitFor(() => expect(smsService.sendMobileOtp).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('never sends a mobile OTP when no phone number is given (backward compatible)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    prisma.user.create = vi.fn().mockResolvedValue({
      id: 'user_3', email: 'nophone@example.com', firstName: null, lastName: null, phoneNumber: null,
      emailVerified: null, phoneVerified: null, role: 'customer', isActive: true, lastLogin: null,
      createdAt: new Date(), updatedAt: new Date(), password: '$2b$10$hash',
    });
    const smsService = makeSmsService();
    const service = new IdentityService(prisma, makeEmailService(), makeAdminAuditLog(), smsService);

    await service.register('nophone@example.com', 'Password1!');

    // No wait needed: register() only calls sendMobileOtp inside an `if (phoneNumber)`
    // guard, synchronously skipped when no phone is given - nothing async to race.
    expect(smsService.sendMobileOtp).not.toHaveBeenCalled();
  });
});
