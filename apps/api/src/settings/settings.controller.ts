import { Controller, Get, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SettingsService, StoreSettingsDTO, ShippingMethod } from './settings.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

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
}
