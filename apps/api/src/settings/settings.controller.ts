import { Controller, Get, Put, Body, Param, Query } from '@nestjs/common';
import { SettingsService, StoreSettingsDTO, ShippingMethod } from './settings.service';

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
  async updateSettings(@Body() updates: StoreSettingsDTO) {
    // In production, extract adminId from JWT token
    const adminId = 'admin-user-id';
    return this.settingsService.updateSettings(updates, adminId);
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
  async updateShippingMethods(@Body() methods: ShippingMethod[]) {
    const adminId = 'admin-user-id';
    return this.settingsService.updateShippingMethods(methods, adminId);
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
    @Body() data: { rate: number; mode: 'inclusive' | 'exclusive' }
  ) {
    const adminId = 'admin-user-id';
    return this.settingsService.updateTaxConfiguration(
      data.rate,
      data.mode,
      adminId
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
  async updateNotifications(@Body() prefs: any) {
    const adminId = 'admin-user-id';
    return this.settingsService.updateNotificationPreferences(prefs, adminId);
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
    @Body() data: { enabled: boolean; message: string }
  ) {
    const adminId = 'admin-user-id';
    return this.settingsService.setMaintenanceMode(
      data.enabled,
      data.message,
      adminId
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
}
