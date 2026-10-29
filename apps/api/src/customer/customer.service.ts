import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    // Validate new password
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newPassword },
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
        label: data.label,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        street1: data.street1,
        street2: data.street2 || null,
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
        label: data.label ?? address.label,
        firstName: data.firstName ?? address.firstName,
        lastName: data.lastName ?? address.lastName,
        phoneNumber: data.phoneNumber ?? address.phoneNumber,
        street1: data.street1 ?? address.street1,
        street2: data.street2 !== undefined ? data.street2 : address.street2,
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
    const required = ['label', 'firstName', 'lastName', 'phoneNumber', 'street1', 'city', 'state', 'postalCode', 'country'];
    for (const field of required) {
      if (!data[field]) {
        throw new BadRequestException(`${field} is required`);
      }
    }

    // Validate Indian phone number (10 digits)
    if (!/^\d{10}$/.test(data.phoneNumber.replace(/\D/g, ''))) {
      throw new BadRequestException('Phone number must be 10 digits');
    }

    // Validate postal code (6 digits for India)
    if (!/^\d{6}$/.test(data.postalCode.replace(/\D/g, ''))) {
      throw new BadRequestException('Postal code must be 6 digits for India');
    }
  }
}
