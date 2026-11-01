import { Controller, Get, Post, Put, Param, Query, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('api/promotions')
export class PromotionsController {
  constructor(private promotionsService: PromotionsService) {}

  @UseGuards(AuthGuard, AdminGuard)
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

  @UseGuards(AuthGuard, AdminGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.promotionsService.findById(id);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Post()
  async create(@Body() body: any) {
    if (!body.name || !body.type) {
      throw new BadRequestException('name and type are required');
    }
    return this.promotionsService.create(body);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.promotionsService.update(id, body);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Put(':id/toggle')
  async toggleActive(@Param('id') id: string, @Body() body: any) {
    if (body.isActive === undefined) {
      throw new BadRequestException('isActive is required');
    }
    return this.promotionsService.toggleActive(id, body.isActive);
  }

  @UseGuards(AuthGuard, AdminGuard)
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

  @Post(':id/redeem')
  async redeemCoupon(@Param('id') promotionId: string, @Body() body: any) {
    if (!body.couponCode || !body.userId || !body.orderId || body.discountAmount === undefined) {
      throw new BadRequestException('couponCode, userId, orderId, and discountAmount are required');
    }

    return this.promotionsService.redeemCoupon(
      body.couponCode,
      body.userId,
      body.orderId,
      parseInt(body.discountAmount)
    );
  }

  @Post(':id/release')
  async releaseCoupon(@Param('id') promotionId: string, @Body() body: any) {
    if (!body.couponCode || !body.userId || !body.orderId) {
      throw new BadRequestException('couponCode, userId, and orderId are required');
    }

    await this.promotionsService.releaseRedemption(body.couponCode, body.userId, body.orderId);
    return { success: true };
  }
}
