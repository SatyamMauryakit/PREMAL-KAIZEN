import { Controller, Get, Post, Put, Delete, Param, Query, Body, Req, BadRequestException, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';

@Controller('api/promotions')
export class PromotionsController {
  constructor(private promotionsService: PromotionsService) {}

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('promotions:manage')
  @Get('stats')
  async getStats() {
    return this.promotionsService.getStats();
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('promotions:manage')
  @Get()
  async findAll(@Query() query: any) {
    return this.promotionsService.findAll({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      search: query.search,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
      status: query.status,
    });
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('promotions:manage')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.promotionsService.findById(id);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('promotions:manage')
  @Post()
  async create(@Body() body: any) {
    if (!body.name || !body.type) {
      throw new BadRequestException('name and type are required');
    }
    return this.promotionsService.create(body);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('promotions:manage')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.promotionsService.update(id, body);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('promotions:manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.promotionsService.delete(id);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('promotions:manage')
  @Put(':id/toggle')
  async toggleActive(@Param('id') id: string, @Body() body: any) {
    if (body.isActive === undefined) {
      throw new BadRequestException('isActive is required');
    }
    return this.promotionsService.toggleActive(id, body.isActive);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('promotions:manage')
  @Post(':id/coupons')
  async createCouponCodes(
    @Param('id') promotionId: string,
    @Body() body: any
  ) {
    const count = body.count || 1;
    return this.promotionsService.createCouponCodes(promotionId, count, {
      usageLimit: body.usageLimit,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      description: body.description,
    });
  }

  // KNOWN RISK (flagged, not fixed here): this endpoint is unauthenticated and trusts
  // a client-supplied userId, because the real storefront checkout flow
  // (checkout-context.tsx) calls it today without sending an Authorization header.
  // Adding @UseGuards(AuthGuard) here would 401 every real coupon-apply attempt until
  // the frontend is updated to send a session token too - that's a coordinated
  // frontend+backend change outside this backend-only phase's scope. The blast radius
  // is read-only, though: validateAndApplyCoupon only reads and returns a discount
  // preview, it never redeems/mutates anything (see redeemCoupon/redeemCouponInTx
  // below, which do mutate and are properly guarded).
  @Post('validate-coupon')
  async validateCoupon(@Body() body: any) {
    if (!body.couponCode || !body.userId || !body.cartItems || !body.subtotal) {
      throw new BadRequestException('couponCode, userId, cartItems, and subtotal are required');
    }

    return this.promotionsService.validateAndApplyCoupon(
      body.couponCode,
      body.userId,
      body.cartItems,
      parseInt(body.subtotal)
    );
  }

  // Confirmed unused by any real client (grepped the storefront and admin apps) - the
  // actual checkout flow redeems coupons server-side from inside OrdersService's own
  // transaction, never through this HTTP route. It was previously unauthenticated
  // despite writing a real CouponRedemption row and incrementing usage counters from a
  // fully client-supplied userId/orderId - fixed to require login and use the caller's
  // own session id, consistent with every other mutating endpoint in this API.
  @UseGuards(AuthGuard)
  @Post(':id/redeem')
  async redeemCoupon(@Param('id') promotionId: string, @Body() body: any, @Req() req: any) {
    if (!body.couponCode || !body.orderId || body.discountAmount === undefined) {
      throw new BadRequestException('couponCode, orderId, and discountAmount are required');
    }

    return this.promotionsService.redeemCoupon(
      body.couponCode,
      req.user.id,
      body.orderId,
      parseInt(body.discountAmount)
    );
  }

  // Same fix as redeemCoupon above, for the same reason - also confirmed unused by any
  // real client.
  @UseGuards(AuthGuard)
  @Post(':id/release')
  async releaseCoupon(@Param('id') promotionId: string, @Body() body: any, @Req() req: any) {
    if (!body.couponCode || !body.orderId) {
      throw new BadRequestException('couponCode and orderId are required');
    }

    await this.promotionsService.releaseRedemption(body.couponCode, req.user.id, body.orderId);
    return { success: true };
  }
}
