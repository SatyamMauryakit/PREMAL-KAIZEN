import { Controller, Get, Put, Post, Delete, Param, Body, Request, UseGuards, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerService } from './customer.service';
import { CartService } from './cart.service';
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
  constructor(
    private customerService: CustomerService,
    private cartService: CartService,
  ) {}

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
   * Update customer profile: name and mobile number (a plain, unverified
   * contact field - see CustomerService.updateProfile). Email goes through
   * the dedicated OTP-gated change flow below.
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
  // EMAIL ADDRESS CHANGE (OTP-gated)
  // ========================================================================

  /** POST /api/customer/email/request-update - send an OTP to a new email address. */
  @Throttle({ default: { limit: 5, ttl: 60000 }, otp: { limit: 10, ttl: 900000 } })
  @Post('email/request-update')
  async requestEmailUpdate(@Request() req: any, @Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    const userId = this.extractUserId(req);
    return this.customerService.requestEmailUpdate(userId, body.email);
  }

  /** POST /api/customer/email/verify-update - verify the OTP and commit the new email address. */
  @Throttle({ default: { limit: 10, ttl: 60000 }, otp: { limit: 10, ttl: 900000 } })
  @Post('email/verify-update')
  async verifyEmailUpdate(@Request() req: any, @Body() body: { otp: string }) {
    if (!body.otp) {
      throw new BadRequestException('OTP is required');
    }
    const userId = this.extractUserId(req);
    return this.customerService.verifyEmailUpdate(userId, body.otp);
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
  // CART SYNC ENDPOINTS (Section 3: admin cart visibility)
  // ========================================================================
  //
  // The storefront's own cart UI is localStorage-driven and unaffected by
  // these routes - this is a one-way background mirror so admins can see
  // what's in a logged-in customer's cart. userId always comes from the
  // verified session (never the request body), so a customer can only ever
  // read or write their own persisted cart - never another customer's.

  /** GET /api/customer/cart */
  @Get('cart')
  async getCart(@Request() req: any) {
    const userId = this.extractUserId(req);
    return this.cartService.getCartForUser(userId);
  }

  /** PUT /api/customer/cart - replaces the persisted cart with the given items. */
  @Put('cart')
  async syncCart(
    @Request() req: any,
    @Body() body: { items: Array<{ productId: string; quantity: number; selectedSize?: string; selectedColor?: string }> },
  ) {
    const userId = this.extractUserId(req);
    return this.cartService.syncCart(userId, Array.isArray(body.items) ? body.items : []);
  }

  /** DELETE /api/customer/cart - called once the local cart is cleared (e.g. after checkout). */
  @Delete('cart')
  async clearCart(@Request() req: any) {
    const userId = this.extractUserId(req);
    return this.cartService.clearCart(userId);
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
