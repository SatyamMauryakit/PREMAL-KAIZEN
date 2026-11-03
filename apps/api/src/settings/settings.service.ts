import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../payments/razorpay.service';

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  price: number; // in paise
  freeShippingThreshold?: number; // in paise
  estimatedDays?: number;
  enabled: boolean;
}

export interface StoreSettingsDTO {
  storeName?: string;
  storeEmail?: string;
  storePhone?: string;
  businessAddress?: string;
  businessState?: string;
  gstin?: string;
  timezone?: string;
  locale?: string;
  currency?: string;
  shippingMethods?: ShippingMethod[];
  defaultTaxRate?: number;
  taxCalculationMode?: 'inclusive' | 'exclusive';
  guestCheckoutEnabled?: boolean;
  minimumOrderValue?: number;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  orderConfirmationEnabled?: boolean;
  paymentNotificationsEnabled?: boolean;
  shippingNotificationsEnabled?: boolean;
  lowStockNotificationsEnabled?: boolean;
  stripeEnabled?: boolean;
  razorpayEnabled?: boolean;
  codEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
}

@Injectable()
export class SettingsService {
  private readonly SINGLETON_ID = 'singleton';

  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
  ) {}

  async getSettings() {
    let settings = await this.prisma.storeSettings.findUnique({
      where: { id: this.SINGLETON_ID },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await this.prisma.storeSettings.create({
        data: {
          id: this.SINGLETON_ID,
          storeName: 'PREMAL KAIZEN',
          storeEmail: 'support@premalkaizen.com',
          storePhone: '+91-XXX-XXX-XXXX',
          timezone: 'Asia/Kolkata',
          locale: 'en-IN',
          currency: 'INR',
          shippingMethods: JSON.stringify(this.getDefaultShippingMethods()),
        },
      });
    }

    return this.formatSettings(settings);
  }

  async updateSettings(updates: StoreSettingsDTO, adminId: string) {
    // Validate input
    this.validateSettings(updates);

    const currentSettings = await this.prisma.storeSettings.findUnique({
      where: { id: this.SINGLETON_ID },
    });

    if (!currentSettings) {
      throw new NotFoundException('Store settings not found');
    }

    // Prepare update data
    const updateData: any = {
      ...updates,
      lastModifiedBy: adminId,
      lastModifiedAt: new Date(),
    };

    // Handle shipping methods (convert to JSON if provided)
    if (updates.shippingMethods) {
      updateData.shippingMethods = JSON.stringify(updates.shippingMethods);
    }

    // Update settings
    const updated = await this.prisma.storeSettings.update({
      where: { id: this.SINGLETON_ID },
      data: updateData,
    });

    // Create audit log for significant changes
    await this.auditSettingsChanges(
      currentSettings,
      updated,
      adminId,
      updates
    );

    return this.formatSettings(updated);
  }

  async getShippingMethods(): Promise<ShippingMethod[]> {
    const settings = await this.getSettings();
    return settings.shippingMethods || this.getDefaultShippingMethods();
  }

  async updateShippingMethods(methods: ShippingMethod[], adminId: string) {
    // Validate shipping methods
    if (!Array.isArray(methods)) {
      throw new BadRequestException('Shipping methods must be an array');
    }

    for (const method of methods) {
      if (!method.name) {
        throw new BadRequestException('Each shipping method must have a name');
      }
      if (typeof method.price !== 'number' || method.price < 0) {
        throw new BadRequestException('Shipping method price must be a non-negative number (in paise)');
      }
    }

    return this.updateSettings({ shippingMethods: methods }, adminId);
  }

  async getTaxRate(): Promise<{ rate: number; mode: 'inclusive' | 'exclusive' }> {
    const settings = await this.getSettings();
    return {
      rate: settings.defaultTaxRate || 0,
      mode: settings.taxCalculationMode || 'exclusive',
    };
  }

  async updateTaxConfiguration(
    rate: number,
    mode: 'inclusive' | 'exclusive',
    adminId: string
  ) {
    if (rate < 0 || rate > 100) {
      throw new BadRequestException('Tax rate must be between 0 and 100');
    }

    return this.updateSettings(
      { defaultTaxRate: rate, taxCalculationMode: mode },
      adminId
    );
  }

  async calculateTax(amount: number): Promise<number> {
    const { rate, mode } = await this.getTaxRate();

    if (rate === 0) {
      return 0;
    }

    if (mode === 'inclusive') {
      // Tax is already included in amount
      return Math.round((amount * rate) / (100 + rate));
    } else {
      // Tax is exclusive, calculate on top
      return Math.round((amount * rate) / 100);
    }
  }

  async getNotificationPreferences() {
    const settings = await this.getSettings();
    return {
      orderConfirmationEnabled: settings.orderConfirmationEnabled,
      paymentNotificationsEnabled: settings.paymentNotificationsEnabled,
      shippingNotificationsEnabled: settings.shippingNotificationsEnabled,
      lowStockNotificationsEnabled: settings.lowStockNotificationsEnabled,
      emailNotificationsEnabled: settings.emailNotificationsEnabled,
      smsNotificationsEnabled: settings.smsNotificationsEnabled,
    };
  }

  async updateNotificationPreferences(prefs: any, adminId: string) {
    return this.updateSettings(prefs, adminId);
  }

  async isMaintenanceMode(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.maintenanceMode || false;
  }

  async setMaintenanceMode(enabled: boolean, message: string, adminId: string) {
    return this.updateSettings(
      { maintenanceMode: enabled, maintenanceMessage: message },
      adminId
    );
  }

  /**
   * Real, read-only provider configuration status for the admin Payment Settings UI -
   * never exposes the actual key/secret values, only whether they're present. The
   * website-level enable/disable toggle (razorpayEnabled) is independent of this:
   * an admin can enable Razorpay in settings before credentials are configured, but
   * orders.service.ts will refuse to actually create a Razorpay order until both the
   * toggle is on AND the credentials are present.
   */
  async getPaymentProviderStatus() {
    const settings = await this.getSettings();
    return {
      razorpay: {
        enabled: !!settings.razorpayEnabled,
        configured: this.razorpayService.isConfigured(),
        webhookConfigured: this.razorpayService.isWebhookConfigured(),
      },
      cod: {
        enabled: settings.codEnabled !== false,
      },
    };
  }

  async getAuditLog(limit: number = 50, offset: number = 0) {
    return this.prisma.settingsAuditLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== PRIVATE HELPERS ==========

  private validateSettings(updates: StoreSettingsDTO) {
    if (updates.storeEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.storeEmail)) {
        throw new BadRequestException('Invalid store email format');
      }
    }

    if (updates.timezone) {
      // Basic timezone validation
      if (!this.isValidTimezone(updates.timezone)) {
        throw new BadRequestException('Invalid timezone');
      }
    }

    if (updates.defaultTaxRate !== undefined) {
      if (updates.defaultTaxRate < 0 || updates.defaultTaxRate > 100) {
        throw new BadRequestException('Tax rate must be between 0 and 100');
      }
    }

    if (updates.minimumOrderValue !== undefined) {
      if (updates.minimumOrderValue < 0) {
        throw new BadRequestException('Minimum order value cannot be negative');
      }
    }
  }

  private isValidTimezone(tz: string): boolean {
    // Common timezones list (can be expanded)
    const validTimezones = [
      'Asia/Kolkata',
      'UTC',
      'America/New_York',
      'Europe/London',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Asia/Singapore',
      'Asia/Dubai',
    ];
    return validTimezones.includes(tz);
  }

  private formatSettings(raw: any) {
    return {
      ...raw,
      shippingMethods: this.parseJSON(raw.shippingMethods, []),
    };
  }

  private parseJSON(value: string | null, fallback: any = null) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  private getDefaultShippingMethods(): ShippingMethod[] {
    return [
      {
        id: 'standard',
        name: 'Standard Shipping',
        description: 'Delivery in 5-7 business days',
        price: 5000, // ₹50
        estimatedDays: 6,
        enabled: true,
      },
      {
        id: 'express',
        name: 'Express Shipping',
        description: 'Delivery in 2-3 business days',
        price: 10000, // ₹100
        estimatedDays: 2,
        enabled: true,
      },
      {
        id: 'overnight',
        name: 'Overnight Shipping',
        description: 'Next business day delivery',
        price: 20000, // ₹200
        estimatedDays: 1,
        enabled: false,
      },
    ];
  }

  private async auditSettingsChanges(
    before: any,
    after: any,
    adminId: string,
    updates: StoreSettingsDTO
  ) {
    const changedFields = Object.keys(updates);

    for (const field of changedFields) {
      const beforeValue = (before as any)[field];
      const afterValue = (after as any)[field];

      // Skip if no actual change
      if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
        continue;
      }

      await this.prisma.settingsAuditLog.create({
        data: {
          setting: field,
          previousValue: JSON.stringify(beforeValue),
          newValue: JSON.stringify(afterValue),
          changedBy: adminId,
        },
      });
    }
  }
}
