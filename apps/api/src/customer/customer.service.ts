import { Injectable, BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';
import { assertCanSend, assertDelivered, issueOtp, verifyAndConsumeOtp } from '../identity/otp.utils';

const BCRYPT_ROUNDS = 10;
/** The email-address-change OTP expires in 5 minutes, same as every other OTP purpose. */
const CHANGE_OTP_EXPIRY_MINUTES = 5;

/**
 * CustomerService
 * Manages customer profiles and addresses.
 * This service owns:
 * - Customer profile data (name, email, phone)
 * - Delivery addresses for Indian customers
 * - Profile updates with verification
 * - OTP-gated email address changes (see requestEmailUpdate/verifyEmailUpdate):
 *   the live email on the User row is never touched until the OTP sent to the
 *   NEW address is verified - a PendingEmailChange row holds the requested
 *   value until then. The mobile number has no verification of any kind - it
 *   is a plain, permanently-stored contact field, directly editable via
 *   updateProfile below, exactly like firstName/lastName.
 */
@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Get customer profile
   * @param userId - User ID
   * @returns Customer profile without password
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update customer profile: name, and the mobile number (a plain,
   * permanently-stored contact field with no verification of any kind - it
   * is just lightly format-checked, never OTP-gated). Email remains a
   * verified, security-sensitive identifier and can only be changed through
   * the dedicated OTP-gated flow below (requestEmailUpdate/verifyEmailUpdate).
   * @param userId - User ID
   * @param data - Profile data to update
   * @returns Updated profile
   */
  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let normalizedPhone = user.phoneNumber;
    if (data.phoneNumber !== undefined) {
      if (data.phoneNumber.trim()) {
        normalizedPhone = this.normalizePhone(data.phoneNumber);
        if (!this.isValidPhone(normalizedPhone)) {
          throw new BadRequestException('Enter a valid mobile number with country code');
        }
      } else {
        normalizedPhone = null;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName ?? user.firstName,
        lastName: data.lastName ?? user.lastName,
        phoneNumber: normalizedPhone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        emailVerified: true,
      },
    });

    return updated;
  }

  // ========================================================================
  // EMAIL ADDRESS CHANGE (OTP-gated, pending-value indirection)
  // ========================================================================

  /** Step 1: request an email address change - mirrors requestPhoneUpdate exactly. */
  async requestEmailUpdate(userId: string, newEmail: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalized = newEmail.trim().toLowerCase();
    if (!this.isValidEmail(normalized)) {
      throw new BadRequestException('Enter a valid email address');
    }
    if (normalized === user.email) {
      throw new BadRequestException('This is already your email address.');
    }

    const conflict = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (conflict) {
      throw new ConflictException('This email address is already associated with another account.');
    }

    await assertCanSend(this.prisma, normalized, 'email_change_otp');
    const { otp, expiresAt } = await issueOtp(this.prisma, {
      destination: normalized,
      purpose: 'email_change_otp',
      userId,
      expiryMinutes: CHANGE_OTP_EXPIRY_MINUTES,
    });

    await this.prisma.pendingEmailChange.upsert({
      where: { userId },
      update: { newEmail: normalized, expiresAt, verifiedAt: null },
      create: { userId, newEmail: normalized, expiresAt },
    });

    const delivered = await this.emailService.sendEmailOtpEmail({
      toEmail: normalized,
      customerName: user.firstName || normalized,
      otp,
      expiryMinutes: CHANGE_OTP_EXPIRY_MINUTES,
    }).catch(() => false);
    assertDelivered(delivered, 'email_change_otp', normalized);

    return { message: 'Verification code sent to your new email address.' };
  }

  /**
   * Step 2: verify the OTP sent to the pending new email. Email doubles as
   * the login identifier, so on success every other active session for this
   * account is invalidated (a fresh session is issued for the device that
   * just completed verification) and the OLD email address is notified of
   * the change - a stronger response than the mobile-number case, since a
   * hijacked email change is a full account-takeover vector.
   */
  async verifyEmailUpdate(userId: string, otp: string): Promise<{ message: string; sessionToken: string }> {
    const pending = await this.prisma.pendingEmailChange.findUnique({ where: { userId } });
    if (!pending) {
      throw new BadRequestException('No pending email change found. Please start again.');
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingEmailChange.delete({ where: { userId } }).catch(() => undefined);
      throw new BadRequestException('Your email change request has expired. Please start again.');
    }

    await verifyAndConsumeOtp(this.prisma, { destination: pending.newEmail, purpose: 'email_change_otp', otp });

    const oldUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!oldUser) {
      throw new NotFoundException('User not found');
    }
    const oldEmail = oldUser.email;

    const updated = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.user.findUnique({ where: { email: pending.newEmail } });
      if (conflict) {
        throw new ConflictException('This email address is already associated with another account.');
      }
      const user = await tx.user.update({
        where: { id: userId },
        data: { email: pending.newEmail, emailVerified: new Date() },
      });
      await tx.pendingEmailChange.delete({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tx.session.create({ data: { userId, token, expiresAt } });
      return { user, token };
    });

    this.emailService.sendEmailChangedNotification({
      toEmail: oldEmail,
      customerName: updated.user.firstName || oldEmail,
      newEmail: updated.user.email,
    }).catch(() => undefined);

    return { message: 'Email address updated and verified successfully.', sessionToken: updated.token };
  }

  /**
   * Change password
   * @param userId - User ID
   * @param currentPassword - Current password (hashed)
   * @param newPassword - New password (hashed)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!currentPassword) {
      throw new BadRequestException('Current password is required');
    }

    // Support bcrypt hashes; fall back to legacy base64 hashes created before
    // the bcrypt migration (mirrors the same check used at login).
    const looksLikeBcryptHash = /^\$2[aby]\$/.test(user.password);
    const isCurrentPasswordValid = looksLikeBcryptHash
      ? await bcrypt.compare(currentPassword, user.password)
      : Buffer.from(currentPassword).toString('base64') === user.password;

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  // ========================================================================
  // ADDRESS MANAGEMENT
  // ========================================================================

  /**
   * Get all customer addresses
   * @param userId - User ID
   * @returns List of addresses
   */
  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get single address
   * @param userId - User ID
   * @param addressId - Address ID
   * @returns Address details
   */
  async getAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  /**
   * Create new address
   * @param userId - User ID
   * @param data - Address data
   * @returns Created address
   */
  async createAddress(
    userId: string,
    data: {
      label: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
      street1: string;
      street2?: string;
      landmark?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      isDefault?: boolean;
    },
  ) {
    // Validate required fields
    this.validateAddress(data);

    // If this is default, unset other defaults
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        userId,
        label: data.label || 'Home',
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        street1: data.street1,
        street2: data.street2 || null,
        landmark: data.landmark || null,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        isDefault: data.isDefault || false,
      },
    });

    return address;
  }

  /**
   * Update address
   * @param userId - User ID
   * @param addressId - Address ID
   * @param data - Address data to update
   * @returns Updated address
   */
  async updateAddress(
    userId: string,
    addressId: string,
    data: {
      label?: string;
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      street1?: string;
      street2?: string;
      landmark?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      isDefault?: boolean;
    },
  ) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        label: data.label || address.label,
        firstName: data.firstName ?? address.firstName,
        lastName: data.lastName ?? address.lastName,
        phoneNumber: data.phoneNumber ?? address.phoneNumber,
        street1: data.street1 ?? address.street1,
        street2: data.street2 !== undefined ? data.street2 : address.street2,
        landmark: data.landmark !== undefined ? data.landmark : address.landmark,
        city: data.city ?? address.city,
        state: data.state ?? address.state,
        postalCode: data.postalCode ?? address.postalCode,
        country: data.country ?? address.country,
        isDefault: data.isDefault !== undefined ? data.isDefault : address.isDefault,
      },
    });

    return updated;
  }

  /**
   * Delete address
   * @param userId - User ID
   * @param addressId - Address ID
   */
  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    // If deleted address was default, set another as default
    if (address.isDefault) {
      const firstAddress = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (firstAddress) {
        await this.prisma.address.update({
          where: { id: firstAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { message: 'Address deleted successfully' };
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  /** Light normalization: bare 10-digit Indian numbers get a +91 prefix; anything already prefixed is left as-is. */
  private normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    if (!trimmed.startsWith('+') && digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }
    return trimmed;
  }

  /** Loose E.164-style check after normalization: a leading '+' and 8-15 digits. */
  private isValidPhone(normalizedPhone: string): boolean {
    return /^\+[1-9]\d{7,14}$/.test(normalizedPhone);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private validateAddress(data: any) {
    // "label" is presented to customers as an optional nickname (e.g. "Home, Office, etc.")
    // on the storefront's address form, so it is not enforced here - see createAddress/updateAddress.
    const required = ['firstName', 'lastName', 'phoneNumber', 'street1', 'city', 'state', 'postalCode', 'country'];
    for (const field of required) {
      if (!data[field]) {
        throw new BadRequestException(`${field} is required`);
      }
    }

    // Validate Indian mobile number: 10 digits, starting 6-9. A leading "0" (old STD-style
    // dialing prefix) or an unambiguous "91"/"+91" country code is stripped first - but a bare
    // 10-digit number that merely starts with "91" (e.g. 9123456780) is a valid number on its
    // own and must not have those digits stripped.
    let mobileDigits = data.phoneNumber.replace(/[\s-]/g, '').replace(/^0/, '');
    if (mobileDigits.startsWith('+91')) {
      mobileDigits = mobileDigits.slice(3);
    } else if (mobileDigits.length === 12 && mobileDigits.startsWith('91')) {
      mobileDigits = mobileDigits.slice(2);
    }
    if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
      throw new BadRequestException('Enter a valid 10-digit Indian mobile number');
    }

    // Validate PIN code: 6 digits, first digit 1-9 (India has no PIN code starting with 0)
    if (!/^[1-9]\d{5}$/.test(data.postalCode.trim())) {
      throw new BadRequestException('Enter a valid 6-digit PIN code');
    }
  }
}
