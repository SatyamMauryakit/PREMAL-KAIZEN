import { BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { maskDestination } from '../common/logging/redact';

const otpLogger = new Logger('OtpEvents');

/**
 * Structured security/audit logging for OTP lifecycle events - destination
 * is always masked and the OTP value is never available to this function in
 * the first place, so it can never leak here. Used for generation, delivery,
 * verification outcomes, rate-limit violations, and lockouts (Section 9 of
 * the OTP hardening spec).
 */
export function logOtpEvent(
  event:
    | 'otp_issued'
    | 'otp_delivered'
    | 'otp_delivery_failed'
    | 'otp_verify_success'
    | 'otp_verify_incorrect'
    | 'otp_expired'
    | 'otp_locked_out'
    | 'otp_rate_limited',
  details: { purpose: string; destination: string; provider?: string },
): void {
  const line = `[${event}] purpose=${details.purpose} destination=${maskDestination(details.destination)}${details.provider ? ` provider=${details.provider}` : ''}`;
  if (event === 'otp_delivery_failed' || event === 'otp_locked_out') otpLogger.warn(line);
  else otpLogger.log(line);
}

/**
 * Turns a provider's delivery result into a thrown error - "accepted the
 * request" is never reported as success unless the provider actually
 * confirmed delivery. Call sites that fire an OTP send as a non-blocking,
 * best-effort side effect (e.g. register() auto-sending both verification
 * codes at account-creation time) wrap that call in `.catch(() => undefined)`
 * so this thrown error never blocks the operation itself - only an EXPLICIT
 * "send me a code" action (the send-otp/send-mobile-otp/resend endpoints,
 * and the phone/email-change request endpoints) lets this error reach the
 * customer as a real, actionable response.
 */
export function assertDelivered(delivered: boolean, purpose: string, destination: string): void {
  logOtpEvent(delivered ? 'otp_delivered' : 'otp_delivery_failed', { purpose, destination });
  if (!delivered) {
    throw new BadRequestException("We couldn't send your OTP right now. Please try again.");
  }
}

/**
 * Shared OTP hardening primitives used by every OTP purpose in the app
 * (registration email/mobile, login, phone-number change, email-address
 * change). Centralized here so the security rules - hashing, expiry,
 * attempt limits, resend cooldown, hourly send cap, and the 15-minute
 * lockout after too many wrong guesses - are enforced identically
 * everywhere, instead of being re-implemented per call site.
 *
 * A destination+purpose pair identifies one "challenge slot": at most one
 * active VerificationToken row can exist for a given (destination, type)
 * at a time (a new send deletes the previous one), which is also why
 * historical send counts live in the separate append-only OtpSendLog table
 * rather than being derived from VerificationToken rows directly.
 */

export const OTP_DIGITS = 6;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_HOUR = 5;
export const OTP_LOCKOUT_MINUTES = 15;
const BCRYPT_ROUNDS = 10;

export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(OTP_DIGITS, '0');
}

/** Throws if (destination, purpose) is currently locked out from a prior max-attempts violation. */
export async function assertNotLockedOut(
  prisma: PrismaService,
  destination: string,
  purpose: string,
): Promise<void> {
  const lockout = await prisma.otpLockout.findUnique({
    where: { destination_purpose: { destination, purpose } },
  });
  if (lockout && lockout.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((lockout.lockedUntil.getTime() - Date.now()) / 60000);
    throw new BadRequestException(
      `Too many incorrect attempts. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
    );
  }
}

/** Throws if a resend was issued within the cooldown window. Also enforces the hourly send cap. */
export async function assertCanSend(
  prisma: PrismaService,
  destination: string,
  purpose: string,
  cooldownSeconds: number = OTP_RESEND_COOLDOWN_SECONDS,
): Promise<void> {
  await assertNotLockedOut(prisma, destination, purpose);

  const existing = await prisma.verificationToken.findFirst({
    where: { email: destination, type: purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    const elapsedMs = Date.now() - existing.createdAt.getTime();
    if (elapsedMs < cooldownSeconds * 1000) {
      throw new BadRequestException(`Please wait ${cooldownSeconds} seconds before requesting a new code.`);
    }
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentThisHour = await prisma.otpSendLog.count({
    where: { destination, purpose, createdAt: { gte: oneHourAgo } },
  });
  if (sentThisHour >= OTP_MAX_SENDS_PER_HOUR) {
    logOtpEvent('otp_rate_limited', { purpose, destination });
    throw new BadRequestException(
      'You have requested too many verification codes recently. Please try again in a little while.',
    );
  }
}

/**
 * Generates, hashes and persists a fresh OTP for (destination, purpose), replacing any
 * prior pending one. Does NOT send it - the caller delivers `otp` (plaintext, returned
 * only to the caller - never logged, never persisted) via email/SMS and decides how to
 * report delivery failure. Call `assertCanSend` first.
 */
export async function issueOtp(
  prisma: PrismaService,
  params: { destination: string; purpose: string; userId?: string | null; expiryMinutes: number },
): Promise<{ otp: string; expiresAt: Date }> {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + params.expiryMinutes * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { email: params.destination, type: params.purpose } });
  await prisma.verificationToken.create({
    data: {
      email: params.destination,
      token: otpHash,
      type: params.purpose,
      userId: params.userId ?? null,
      expiresAt,
    },
  });
  await prisma.otpSendLog.create({ data: { destination: params.destination, purpose: params.purpose } });
  logOtpEvent('otp_issued', { purpose: params.purpose, destination: params.destination });

  return { otp, expiresAt };
}

export interface VerifyOtpResult {
  userId: string | null;
}

/**
 * Verifies a submitted OTP for (destination, purpose) and consumes it (single-use -
 * deleted on success). On the attempt that reaches OTP_MAX_ATTEMPTS, writes a 15-minute
 * lockout for this destination+purpose before throwing, so a fresh resend immediately
 * afterward cannot be used to reset the attempt counter and keep brute-forcing.
 */
export async function verifyAndConsumeOtp(
  prisma: PrismaService,
  params: { destination: string; purpose: string; otp: string },
): Promise<VerifyOtpResult> {
  await assertNotLockedOut(prisma, params.destination, params.purpose);

  const tokenRow = await prisma.verificationToken.findFirst({
    where: { email: params.destination, type: params.purpose },
  });

  if (!tokenRow) {
    throw new BadRequestException('No pending verification code found. Please request a new one.');
  }

  if (tokenRow.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { id: tokenRow.id } });
    logOtpEvent('otp_expired', { purpose: params.purpose, destination: params.destination });
    throw new BadRequestException('Your OTP has expired. Please request a new OTP.');
  }

  if (tokenRow.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.verificationToken.delete({ where: { id: tokenRow.id } });
    await lockOut(prisma, params.destination, params.purpose);
    throw new BadRequestException('Too many incorrect attempts. Please request a new OTP.');
  }

  const isValid = await bcrypt.compare(params.otp.trim(), tokenRow.token);

  if (!isValid) {
    const nextAttempts = tokenRow.attempts + 1;
    await prisma.verificationToken.update({
      where: { id: tokenRow.id },
      data: { attempts: { increment: 1 } },
    });
    logOtpEvent('otp_verify_incorrect', { purpose: params.purpose, destination: params.destination });
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      await lockOut(prisma, params.destination, params.purpose);
    }
    throw new BadRequestException('The OTP you entered is incorrect. Please try again.');
  }

  await prisma.verificationToken.delete({ where: { id: tokenRow.id } });
  logOtpEvent('otp_verify_success', { purpose: params.purpose, destination: params.destination });
  return { userId: tokenRow.userId };
}

async function lockOut(prisma: PrismaService, destination: string, purpose: string): Promise<void> {
  const lockedUntil = new Date(Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000);
  await prisma.otpLockout.upsert({
    where: { destination_purpose: { destination, purpose } },
    update: { lockedUntil },
    create: { destination, purpose, lockedUntil },
  });
  logOtpEvent('otp_locked_out', { purpose, destination });
}
