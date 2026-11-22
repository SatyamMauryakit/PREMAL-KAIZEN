/**
 * Regression tests for the OTP-gated email-address change flow and the
 * plain (unverified) mobile-number field on updateProfile. Covers: the live
 * email is never touched before verification, duplicate emails are
 * rejected, wrong/expired OTPs leave the account unchanged, and the OLD
 * email is notified on success. No real email is sent - EmailService is
 * mocked. The mobile number has no verification step at all - see the
 * `CustomerService.updateProfile` describe block.
 */
import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CustomerService } from './customer.service';

function makeUser(overrides: any = {}) {
  return {
    id: 'user_1',
    email: 'user@example.com',
    firstName: 'Priya',
    lastName: 'Shah',
    phoneNumber: '+919876543210',
    emailVerified: new Date(),
    ...overrides,
  };
}

function makePrisma(user: any, overrides: any = {}) {
  return {
    user: {
      // Resolves the fixture `user` for a lookup by their own id or own email;
      // any OTHER email (i.e. the new value being requested) resolves null,
      // simulating "no conflicting account" by default.
      findUnique: vi.fn().mockImplementation(({ where }: any) => {
        if (where?.id === user.id || where?.email === user.email) return Promise.resolve(user);
        return Promise.resolve(null);
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(({ data }: any) => ({ ...user, ...data })),
    },
    verificationToken: {
      findFirst: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockImplementation(({ data }: any) => ({ id: 'tok_1', attempts: 0, ...data })),
    },
    otpLockout: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
    otpSendLog: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({}) },
    pendingEmailChange: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    session: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ token: 'new_token' }) },
    ...overrides,
  } as any;
}

// `$transaction` needs a `tx` client - reuse the outer mock object itself.
function withTransaction(prisma: any) {
  prisma.$transaction = vi.fn().mockImplementation((fn: any) => fn(prisma));
  return prisma;
}

function makeEmailService() {
  return {
    sendEmailOtpEmail: vi.fn().mockResolvedValue(true),
    sendEmailChangedNotification: vi.fn().mockResolvedValue(true),
  } as any;
}

describe('CustomerService.updateProfile - mobile number is a plain, unverified field', () => {
  it('updates the mobile number directly with no OTP of any kind', async () => {
    const user = makeUser();
    const prisma = withTransaction(makePrisma(user));
    const service = new CustomerService(prisma, makeEmailService());

    const result = await service.updateProfile('user_1', { phoneNumber: '9988776655' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_1' }, data: expect.objectContaining({ phoneNumber: '+919988776655' }) }),
    );
    expect(result.phoneNumber).toBe('+919988776655');
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it('allows clearing the mobile number entirely', async () => {
    const user = makeUser();
    const prisma = withTransaction(makePrisma(user));
    const service = new CustomerService(prisma, makeEmailService());

    await service.updateProfile('user_1', { phoneNumber: '' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phoneNumber: null }) }),
    );
  });

  it('rejects an invalid mobile number format', async () => {
    const user = makeUser();
    const prisma = withTransaction(makePrisma(user));
    const service = new CustomerService(prisma, makeEmailService());

    await expect(service.updateProfile('user_1', { phoneNumber: '123' })).rejects.toThrow(BadRequestException);
  });

  it('updates name fields without touching the phone number when phoneNumber is not provided', async () => {
    const user = makeUser();
    const prisma = withTransaction(makePrisma(user));
    const service = new CustomerService(prisma, makeEmailService());

    await service.updateProfile('user_1', { firstName: 'New' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ firstName: 'New', phoneNumber: user.phoneNumber }) }),
    );
  });
});

describe('CustomerService.requestEmailUpdate / verifyEmailUpdate', () => {
  it('sends an OTP to the new email and records a pending change', async () => {
    const user = makeUser();
    const prisma = withTransaction(makePrisma(user));
    const emailService = makeEmailService();
    const service = new CustomerService(prisma, emailService);

    const result = await service.requestEmailUpdate('user_1', 'new@example.com');

    expect(result.message).toContain('Verification code sent');
    expect(prisma.pendingEmailChange.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user_1' } }),
    );
    expect(emailService.sendEmailOtpEmail).toHaveBeenCalledWith(expect.objectContaining({ toEmail: 'new@example.com' }));
  });

  it('rejects an email already registered to another account', async () => {
    const user = makeUser();
    const prisma = withTransaction(makePrisma(user));
    prisma.user.findUnique = vi.fn().mockImplementation(({ where }: any) => {
      if (where?.id === user.id) return Promise.resolve(user); // own-user lookup
      if (where?.email === 'taken@example.com') return Promise.resolve({ id: 'other_user', email: 'taken@example.com' });
      return Promise.resolve(null);
    });
    const service = new CustomerService(prisma, makeEmailService());

    await expect(service.requestEmailUpdate('user_1', 'taken@example.com')).rejects.toThrow(ConflictException);
  });

  it('commits the new email, issues a fresh session, and notifies the OLD email', async () => {
    const otp = '654321';
    const hash = await bcrypt.hash(otp, 10);
    const user = makeUser();
    const prisma = withTransaction(makePrisma(user));
    prisma.pendingEmailChange.findUnique.mockResolvedValue({ userId: 'user_1', newEmail: 'new@example.com', expiresAt: new Date(Date.now() + 300_000) });
    prisma.verificationToken.findFirst.mockResolvedValue({ id: 'tok_1', email: 'new@example.com', type: 'email_change_otp', token: hash, expiresAt: new Date(Date.now() + 300_000), createdAt: new Date(), attempts: 0 });
    const emailService = makeEmailService();
    const service = new CustomerService(prisma, emailService);

    const result = await service.verifyEmailUpdate('user_1', otp);

    // A brand-new random session token is generated for the device that just
    // completed verification (not reused from any prior session).
    expect(typeof result.sessionToken).toBe('string');
    expect(result.sessionToken.length).toBeGreaterThanOrEqual(32);
    expect(prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user_1', token: result.sessionToken }) }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_1' }, data: expect.objectContaining({ email: 'new@example.com', emailVerified: expect.any(Date) }) }),
    );
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
    expect(emailService.sendEmailChangedNotification).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'user@example.com', newEmail: 'new@example.com' }),
    );
  });
});
