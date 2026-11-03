import { Controller, Get, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SettingsService, StoreSettingsDTO, ShippingMethod } from './settings.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

/**
 * Public, read-only checkout settings - no admin data (no GSTIN, no email/phone).
 * Lets the storefront show real shipping methods, tax rate and payment-gateway
 * availability instead of hardcoding assumptions the business hasn't configured.
 */
@Controller('api/storefront/settings')
export class PublicSettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('checkout')
  async getCheckoutSettings() {
    const settings = await this.settingsService.getSettings();
    return {
      shippingMethods: (settings.shippingMethods || []).filter((m: ShippingMethod) => m.enabled),
      taxRate: settings.defaultTaxRate || 0,
      taxMode: settings.taxCalculationMode || 'exclusive',
      razorpayEnabled: !!settings.razorpayEnabled,
      codEnabled: settings.codEnabled !== false,
      guestCheckoutEnabled: settings.guestCheckoutEnabled !== false,
      minimumOrderValue: settings.minimumOrderValue || 0,
      maintenanceMode: !!settings.maintenanceMode,
    };
  }

  /**
   * Real, admin-configured contact details - this is the only source the
   * storefront's footer/contact/about pages should use, instead of a
   * hardcoded guess at the business's real email or phone number.
   */
  @Get('contact')
  async getContactSettings() {
    const settings = await this.settingsService.getSettings();
    return {
      storeName: settings.storeName || 'PREMAL KAIZEN',
      storeEmail: settings.storeEmail || '',
      storePhone: settings.storePhone || '',
    };
  }
}

@UseGuards(AuthGuard, AdminGuard)
@Controller('api/admin/settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  /**
   * Get all store settings
   */
  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  /**
   * Update store settings
   */
  @Put()
  async updateSettings(@Body() updates: StoreSettingsDTO, @Req() req: any) {
    return this.settingsService.updateSettings(updates, req.user.id);
  }

  /**
   * Get shipping methods
   */
  @Get('shipping/methods')
  async getShippingMethods() {
    return this.settingsService.getShippingMethods();
  }

  /**
   * Update shipping methods
   */
  @Put('shipping/methods')
  async updateShippingMethods(@Body() methods: ShippingMethod[], @Req() req: any) {
    return this.settingsService.updateShippingMethods(methods, req.user.id);
  }

  /**
   * Get tax configuration
   */
  @Get('tax')
  async getTaxConfiguration() {
    return this.settingsService.getTaxRate();
  }

  /**
   * Update tax configuration
   */
  @Put('tax')
  async updateTaxConfiguration(
    @Body() data: { rate: number; mode: 'inclusive' | 'exclusive' },
    @Req() req: any
  ) {
    return this.settingsService.updateTaxConfiguration(
      data.rate,
      data.mode,
      req.user.id
    );
  }

  /**
   * Get notification preferences
   */
  @Get('notifications')
  async getNotifications() {
    return this.settingsService.getNotificationPreferences();
  }

  /**
   * Update notification preferences
   */
  @Put('notifications')
  async updateNotifications(@Body() prefs: any, @Req() req: any) {
    return this.settingsService.updateNotificationPreferences(prefs, req.user.id);
  }

  /**
   * Check maintenance mode
   */
  @Get('maintenance')
  async getMaintenanceMode() {
    const enabled = await this.settingsService.isMaintenanceMode();
    return { maintenanceMode: enabled };
  }

  /**
   * Set maintenance mode
   */
  @Put('maintenance')
  async setMaintenanceMode(
    @Body() data: { enabled: boolean; message: string },
    @Req() req: any
  ) {
    return this.settingsService.setMaintenanceMode(
      data.enabled,
      data.message,
      req.user.id
    );
  }

  /**
   * Get settings audit log
   */
  @Get('audit-log')
  async getAuditLog(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.settingsService.getAuditLog(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0
    );
  }

  /**
   * Calculate tax for given amount (helper endpoint)
   */
  @Get('tax/calculate/:amount')
  async calculateTax(@Param('amount') amount: string) {
    const paise = parseInt(amount);
    const tax = await this.settingsService.calculateTax(paise);
    return { amount: paise, tax };
  }

  /**
   * Real payment provider status for the Payment Settings UI - whether Razorpay
   * credentials/webhook secret are actually present, never their values.
   */
  @Get('payment-providers')
  async getPaymentProviderStatus() {
    return this.settingsService.getPaymentProviderStatus();
  }
}
