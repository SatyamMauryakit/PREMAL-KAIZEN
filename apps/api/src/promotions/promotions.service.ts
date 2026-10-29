import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CheckoutItem {
  productId: string;
  categoryId?: string;
  quantity: number;
  price: number; // Price per unit in paise
}

interface DiscountCalculation {
  promotionId?: string;
  couponCode?: string;
  originalSubtotal: number;
  discountAmount: number;
  finalSubtotal: number;
  discountPercentage?: number;
}

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * List all promotions with pagination
   */
  async findAll(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    status?: 'active' | 'scheduled' | 'expired' | 'disabled';
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      isArchived: false,
    };

    if (filters?.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Handle status filtering
    if (filters?.status) {
      const now = new Date();
      if (filters.status === 'active') {
        whereClause.isActive = true;
        whereClause.startDate = { lte: now };
        whereClause.OR = [{ expiryDate: null }, { expiryDate: { gte: now } }];
      } else if (filters.status === 'scheduled') {
        whereClause.startDate = { gt: now };
      } else if (filters.status === 'expired') {
        whereClause.expiryDate = { lt: now };
      } else if (filters.status === 'disabled') {
        whereClause.isActive = false;
      }
    }

    const [promotions, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.promotion.count({ where: whereClause }),
    ]);

    // Enrich with status
    const enriched = promotions.map(p => ({
      ...p,
      status: this.getPromotionStatus(p),
      remainingUsage: p.totalUsageLimit ? p.totalUsageLimit - p.usageCount : null,
    }));

    return {
      data: enriched,
      total,
      page,
      pageSize: limit,
    };
  }

  /**
   * Get promotion by ID
   */
  async findById(id: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        coupons: true,
      },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    return {
      ...promotion,
      status: this.getPromotionStatus(promotion),
      remainingUsage: promotion.totalUsageLimit ? promotion.totalUsageLimit - promotion.usageCount : null,
    };
  }

  /**
   * Create a new promotion
   */
  async create(data: any) {
    // Validate required fields
    if (!data.name || !data.type || data.value === undefined) {
      throw new BadRequestException('name, type, and value are required');
    }

    if (!['percentage', 'fixed_amount', 'free_shipping'].includes(data.type)) {
      throw new BadRequestException('Invalid promotion type');
    }

    // Validate value based on type
    if (data.type === 'percentage') {
      if (data.value < 0 || data.value > 100) {
        throw new BadRequestException('Percentage must be between 0 and 100');
      }
    } else if (data.type === 'fixed_amount') {
      if (data.value < 0) {
        throw new BadRequestException('Fixed amount must be non-negative');
      }
    }

    // Check if name is unique
    const existing = await this.prisma.promotion.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new BadRequestException('A promotion with this name already exists');
    }

    const promotion = await this.prisma.promotion.create({
      data: {
        name: data.name,
        description: data.description || null,
        type: data.type,
        value: data.value,
        maxDiscount: data.maxDiscount || null,
        minSubtotal: data.minSubtotal || null,
        firstOrderOnly: data.firstOrderOnly || false,
        eligibleProductIds: data.eligibleProductIds || [],
        eligibleCategoryIds: data.eligibleCategoryIds || [],
        excludedProductIds: data.excludedProductIds || [],
        excludedCategoryIds: data.excludedCategoryIds || [],
        startDate: data.startDate ? new Date(data.startDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        isActive: data.isActive || false,
        totalUsageLimit: data.totalUsageLimit || null,
        perCustomerLimit: data.perCustomerLimit || null,
        code: data.code?.toUpperCase() || null,
      },
    });

    return {
      ...promotion,
      status: this.getPromotionStatus(promotion),
    };
  }

  /**
   * Update a promotion
   */
  async update(id: string, data: any) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    // If changing name, check uniqueness
    if (data.name && data.name !== promotion.name) {
      const existing = await this.prisma.promotion.findUnique({ where: { name: data.name } });
      if (existing) {
        throw new BadRequestException('A promotion with this name already exists');
      }
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        name: data.name || promotion.name,
        description: data.description !== undefined ? data.description : promotion.description,
        type: data.type || promotion.type,
        value: data.value !== undefined ? data.value : promotion.value,
        maxDiscount: data.maxDiscount !== undefined ? data.maxDiscount : promotion.maxDiscount,
        minSubtotal: data.minSubtotal !== undefined ? data.minSubtotal : promotion.minSubtotal,
        firstOrderOnly: data.firstOrderOnly !== undefined ? data.firstOrderOnly : promotion.firstOrderOnly,
        eligibleProductIds: data.eligibleProductIds || promotion.eligibleProductIds,
        eligibleCategoryIds: data.eligibleCategoryIds || promotion.eligibleCategoryIds,
        excludedProductIds: data.excludedProductIds || promotion.excludedProductIds,
        excludedCategoryIds: data.excludedCategoryIds || promotion.excludedCategoryIds,
        startDate: data.startDate ? new Date(data.startDate) : promotion.startDate,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : promotion.expiryDate,
        isActive: data.isActive !== undefined ? data.isActive : promotion.isActive,
        totalUsageLimit: data.totalUsageLimit || promotion.totalUsageLimit,
        perCustomerLimit: data.perCustomerLimit || promotion.perCustomerLimit,
        code: data.code ? data.code.toUpperCase() : promotion.code,
      },
    });

    return {
      ...updated,
      status: this.getPromotionStatus(updated),
    };
  }

  /**
   * Activate/deactivate a promotion
   */
  async toggleActive(id: string, isActive: boolean) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: { isActive },
    });

    return {
      ...updated,
      status: this.getPromotionStatus(updated),
    };
  }

  /**
   * Validate and apply a coupon code
   * Returns discount calculation if valid, error if invalid
   */
  async validateAndApplyCoupon(
    couponCode: string,
    userId: string,
    cartItems: CheckoutItem[],
    subtotal: number
  ): Promise<DiscountCalculation> {
    const normalizedCode = couponCode.toUpperCase().trim();

    // Check if coupon exists and is active
    const coupon = await this.prisma.couponCode.findUnique({
      where: { code: normalizedCode },
      include: { promotion: true },
    });

    if (!coupon) {
      throw new BadRequestException('Coupon code is invalid');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('This coupon code is no longer active');
    }

    const promotion = coupon.promotion;
    if (!promotion.isActive) {
      throw new BadRequestException('This promotion is no longer active');
    }

    // Check expiry dates
    const now = new Date();
    if (promotion.startDate && promotion.startDate > now) {
      throw new BadRequestException('This promotion is not yet active');
    }

    if (promotion.expiryDate && promotion.expiryDate < now) {
      throw new BadRequestException('This coupon code has expired');
    }

    if (coupon.expiryDate && coupon.expiryDate < now) {
      throw new BadRequestException('This coupon code has expired');
    }

    // Check usage limits
    if (promotion.totalUsageLimit && promotion.usageCount >= promotion.totalUsageLimit) {
      throw new BadRequestException('This promotion has reached its usage limit');
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon code has reached its usage limit');
    }

    // Check per-customer limit
    if (promotion.perCustomerLimit || coupon.perCustomerLimit) {
      const customerUsageCount = await this.prisma.couponRedemption.count({
        where: {
          userId,
          status: 'completed',
          couponCode: {
            promotionId: promotion.id,
          },
        },
      });

      const limit = coupon.perCustomerLimit || promotion.perCustomerLimit;
      if (customerUsageCount >= limit) {
        throw new BadRequestException('You have already used this promotion the maximum number of times');
      }
    }

    // Check minimum subtotal
    if (promotion.minSubtotal && subtotal < promotion.minSubtotal) {
      const minAmount = (promotion.minSubtotal / 100).toFixed(2);
      throw new BadRequestException(`Minimum order amount of ₹${minAmount} required for this promotion`);
    }

    // Check product/category eligibility
    const itemsEligible = await this.checkEligibility(cartItems, promotion);
    if (!itemsEligible) {
      throw new BadRequestException('No eligible items in cart for this promotion');
    }

    // Calculate discount
    const discountAmount = this.calculateDiscount(subtotal, promotion);

    return {
      promotionId: promotion.id,
      couponCode: normalizedCode,
      originalSubtotal: subtotal,
      discountAmount,
      finalSubtotal: Math.max(0, subtotal - discountAmount),
      discountPercentage: promotion.type === 'percentage' ? promotion.value : undefined,
    };
  }

  /**
   * Redeem a coupon after order placement
   * Should be called after order is confirmed
   */
  async redeemCoupon(
    couponCode: string,
    userId: string,
    orderId: string,
    discountAmount: number
  ) {
    const normalizedCode = couponCode.toUpperCase().trim();

    const coupon = await this.prisma.couponCode.findUnique({
      where: { code: normalizedCode },
      include: { promotion: true },
    });

    if (!coupon) {
      throw new BadRequestException('Coupon not found');
    }

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Check if already redeemed (idempotency)
      const existing = await tx.couponRedemption.findFirst({
        where: {
          couponCodeId: coupon.id,
          userId,
          orderId,
        },
      });

      if (existing) {
        return existing; // Already redeemed, return existing
      }

      // Create redemption record
      const redemption = await tx.couponRedemption.create({
        data: {
          couponCodeId: coupon.id,
          userId,
          orderId,
          status: 'completed',
          discountAmount,
        },
      });

      // Increment usage counts
      await tx.couponCode.update({
        where: { id: coupon.id },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });

      await tx.promotion.update({
        where: { id: coupon.promotionId },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });

      return redemption;
    });

    return result;
  }

  /**
   * Release a coupon redemption (e.g., on order cancellation or refund)
   */
  async releaseRedemption(couponCode: string, userId: string, orderId: string) {
    const normalizedCode = couponCode.toUpperCase().trim();

    const coupon = await this.prisma.couponCode.findUnique({
      where: { code: normalizedCode },
    });

    if (!coupon) return; // Silently ignore if coupon doesn't exist

    const redemption = await this.prisma.couponRedemption.findFirst({
      where: {
        couponCodeId: coupon.id,
        userId,
        orderId,
      },
    });

    if (!redemption) return; // Already released

    await this.prisma.$transaction(async (tx) => {
      // Mark as refunded
      await tx.couponRedemption.update({
        where: { id: redemption.id },
        data: { status: 'refunded' },
      });

      // Decrement usage counts
      await tx.couponCode.update({
        where: { id: coupon.id },
        data: {
          usageCount: {
            decrement: 1,
          },
        },
      });

      const promotion = await tx.promotion.findUnique({
        where: { id: coupon.promotionId },
      });

      if (promotion) {
        await tx.promotion.update({
          where: { id: promotion.id },
          data: {
            usageCount: {
              decrement: 1,
            },
          },
        });
      }
    });
  }

  /**
   * Create coupon codes for a promotion
   */
  async createCouponCodes(
    promotionId: string,
    count: number = 1,
    options?: {
      usageLimit?: number;
      expiryDate?: Date;
      description?: string;
    }
  ) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = this.generateCouponCode();
      codes.push({
        code: code.toUpperCase(),
        promotionId,
        usageLimit: options?.usageLimit || null,
        expiryDate: options?.expiryDate || null,
        description: options?.description || null,
      });
    }

    const created = await this.prisma.couponCode.createMany({
      data: codes,
      skipDuplicates: true,
    });

    return {
      createdCount: created.count,
      codes: codes.map(c => c.code),
    };
  }

  /**
   * Private helper methods
   */

  private getPromotionStatus(promotion: any): string {
    const now = new Date();

    if (promotion.isArchived) return 'archived';
    if (!promotion.isActive) return 'disabled';

    if (promotion.startDate && promotion.startDate > now) return 'scheduled';
    if (promotion.expiryDate && promotion.expiryDate < now) return 'expired';

    return 'active';
  }

  private async checkEligibility(items: CheckoutItem[], promotion: any): Promise<boolean> {
    // If no restrictions, all items are eligible
    if (promotion.eligibleProductIds.length === 0 && promotion.eligibleCategoryIds.length === 0) {
      return true;
    }

    // Check if at least one item is eligible
    for (const item of items) {
      const isProductEligible = promotion.eligibleProductIds.length === 0 || promotion.eligibleProductIds.includes(item.productId);
      const isCategoryEligible = promotion.eligibleCategoryIds.length === 0 || promotion.eligibleCategoryIds.includes(item.categoryId);

      const isProductExcluded = promotion.excludedProductIds.includes(item.productId);
      const isCategoryExcluded = promotion.excludedCategoryIds.includes(item.categoryId);

      if (!isProductExcluded && !isCategoryExcluded) {
        if (isProductEligible || isCategoryEligible) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateDiscount(subtotal: number, promotion: any): number {
    let discount = 0;

    if (promotion.type === 'percentage') {
      discount = Math.floor((subtotal * promotion.value) / 100);
      // Apply max discount cap if set
      if (promotion.maxDiscount) {
        discount = Math.min(discount, promotion.maxDiscount);
      }
    } else if (promotion.type === 'fixed_amount') {
      discount = promotion.value;
    } else if (promotion.type === 'free_shipping') {
      // Free shipping discount is handled separately
      return 0; // Not applicable to subtotal
    }

    // Never let discount exceed subtotal
    return Math.min(discount, subtotal);
  }

  private generateCouponCode(): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 10;
    let code = '';

    for (let i = 0; i < length; i++) {
      code += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return code;
  }
}
