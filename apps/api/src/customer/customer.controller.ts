import { Controller, Get, Put, Post, Delete, Param, Body, Request, UseGuards, UnauthorizedException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { AuthGuard } from '../common/guards/auth.guard';

/**
 * CustomerController
 * REST API endpoints for customer profile and addresses.
 * Every route needs a real logged-in session - req.user is populated by
 * AuthGuard from the verified session token, never trusted from the client.
 */
@UseGuards(AuthGuard)
@Controller('api/customer')
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  // ========================================================================
  // PROFILE ENDPOINTS
  // ========================================================================

  /**
   * GET /api/customer/profile
   * Get customer profile
   */
  @Get('profile')
  async getProfile(@Request() req: any) {
    const userId = this.extractUserId(req);
    return this.customerService.getProfile(userId);
  }

  /**
   * PUT /api/customer/profile
   * Update customer profile
   */
  @Put('profile')
  async updateProfile(
    @Request() req: any,
    @Body() body: { firstName?: string; lastName?: string; phoneNumber?: string },
  ) {
    const userId = this.extractUserId(req);
    return this.customerService.updateProfile(userId, body);
  }

  /**
   * PUT /api/customer/password
   * Change password
   */
  @Put('password')
  async changePassword(@Request() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    const userId = this.extractUserId(req);
    return this.customerService.changePassword(userId, body.currentPassword, body.newPassword);
  }

  // ========================================================================
  // ADDRESS ENDPOINTS
  // ========================================================================

  /**
   * GET /api/customer/addresses
   * Get all customer addresses
   */
  @Get('addresses')
  async getAddresses(@Request() req: any) {
    const userId = this.extractUserId(req);
    return this.customerService.getAddresses(userId);
  }

  /**
   * GET /api/customer/addresses/:id
   * Get single address
   */
  @Get('addresses/:id')
  async getAddress(@Request() req: any, @Param('id') addressId: string) {
    const userId = this.extractUserId(req);
    return this.customerService.getAddress(userId, addressId);
  }

  /**
   * POST /api/customer/addresses
   * Create new address
   */
  @Post('addresses')
  async createAddress(@Request() req: any, @Body() body: any) {
    const userId = this.extractUserId(req);
    return this.customerService.createAddress(userId, body);
  }

  /**
   * PUT /api/customer/addresses/:id
   * Update address
   */
  @Put('addresses/:id')
  async updateAddress(@Request() req: any, @Param('id') addressId: string, @Body() body: any) {
    const userId = this.extractUserId(req);
    return this.customerService.updateAddress(userId, addressId, body);
  }

  /**
   * DELETE /api/customer/addresses/:id
   * Delete address
   */
  @Delete('addresses/:id')
  async deleteAddress(@Request() req: any, @Param('id') addressId: string) {
    const userId = this.extractUserId(req);
    return this.customerService.deleteAddress(userId, addressId);
  }

  // ========================================================================
  // Private helper
  // ========================================================================

  private extractUserId(req: any): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return userId;
  }
}
