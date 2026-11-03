import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

/**
 * CustomerService
 * Manages customer profiles and addresses.
 * This service owns:
 * - Customer profile data (name, email, phone)
 * - Delivery addresses for Indian customers
 * - Profile updates with verification
 */
@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

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
   * Update customer profile
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

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName ?? user.firstName,
        lastName: data.lastName ?? user.lastName,
        phoneNumber: data.phoneNumber ?? user.phoneNumber,
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
