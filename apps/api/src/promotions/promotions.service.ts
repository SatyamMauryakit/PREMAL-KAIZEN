import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CheckoutItem {
  productId: string;
  categoryId?: string;
  quantity: number;
  price: number; // Price per unit in paise
}

export interface DiscountCalculation {
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
    const page = Number(filters?.page) || 1;
    const limit = Number(filters?.limit) || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      isArchived: false,
    };

    if (filters?.search) {
      whereClause.OR = [
        { name: { contains: filters.search } },
        { code: { contains: filters.search } },
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
      ...this.deserializePromotion(p),
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
      ...this.deserializePromotion(promotion),
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

    // Validate discount cap / minimum order sanity
    if (data.maxDiscount !== undefined && data.maxDiscount !== null && data.maxDiscount < 0) {
      throw new BadRequestException('Max discount cap cannot be negative');
    }
    if (data.minSubtotal !== undefined && data.minSubtotal !== null && data.minSubtotal < 0) {
      throw new BadRequestException('Minimum order amount cannot be negative');
    }
    if (data.startDate && data.expiryDate && new Date(data.startDate) > new Date(data.expiryDate)) {
      throw new BadRequestException('Start date must be before expiry date');
    }

    if (data.code) {
      const existingCode = await this.prisma.couponCode.findUnique({ where: { code: data.code.toUpperCase() } });
      const existingPromoCode = await this.prisma.promotion.findFirst({ where: { code: data.code.toUpperCase() } });
      if (existingCode || existingPromoCode) {
        throw new BadRequestException('This voucher code is already in use');
      }
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
        eligibleProductIds: JSON.stringify(data.eligibleProductIds || []),
        eligibleCategoryIds: JSON.stringify(data.eligibleCategoryIds || []),
        excludedProductIds: JSON.stringify(data.excludedProductIds || []),
        excludedCategoryIds: JSON.stringify(data.excludedCategoryIds || []),
        startDate: data.startDate ? new Date(data.startDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        isActive: data.isActive || false,
        totalUsageLimit: data.totalUsageLimit || null,
        perCustomerLimit: data.perCustomerLimit || null,
        code: data.code?.toUpperCase() || null,
      },
    });

    // Redemption (validate-coupon/redeem) only ever looks at the CouponCode
    // table, so a promotion's own `code` needs a matching row there to
    // actually be redeemable - otherwise setting it here would silently do nothing.
    if (promotion.code) {
      await this.prisma.couponCode.create({
        data: { code: promotion.code, promotionId: promotion.id },
      });
    }

    return {
      ...this.deserializePromotion(promotion),
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

    if (data.code && data.code.toUpperCase() !== promotion.code) {
      const existingCode = await this.prisma.couponCode.findUnique({ where: { code: data.code.toUpperCase() } });
      const existingPromoCode = await this.prisma.promotion.findFirst({ where: { code: data.code.toUpperCase(), id: { not: id } } });
      if (existingCode || existingPromoCode) {
        throw new BadRequestException('This voucher code is already in use');
      }
    }

    const nextStart = data.startDate ? new Date(data.startDate) : promotion.startDate;
    const nextExpiry = data.expiryDate ? new Date(data.expiryDate) : promotion.expiryDate;
    if (nextStart && nextExpiry && nextStart > nextExpiry) {
      throw new BadRequestException('Start date must be before expiry date');
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
        eligibleProductIds: Array.isArray(data.eligibleProductIds) ? JSON.stringify(data.eligibleProductIds) : promotion.eligibleProductIds,
        eligibleCategoryIds: Array.isArray(data.eligibleCategoryIds) ? JSON.stringify(data.eligibleCategoryIds) : promotion.eligibleCategoryIds,
        excludedProductIds: Array.isArray(data.excludedProductIds) ? JSON.stringify(data.excludedProductIds) : promotion.excludedProductIds,
        excludedCategoryIds: Array.isArray(data.excludedCategoryIds) ? JSON.stringify(data.excludedCategoryIds) : promotion.excludedCategoryIds,
        startDate: data.startDate ? new Date(data.startDate) : promotion.startDate,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : promotion.expiryDate,
        isActive: data.isActive !== undefined ? data.isActive : promotion.isActive,
        totalUsageLimit: data.totalUsageLimit || promotion.totalUsageLimit,
        perCustomerLimit: data.perCustomerLimit || promotion.perCustomerLimit,
        code: data.code ? data.code.toUpperCase() : promotion.code,
      },
    });

    // Keep the backing CouponCode row in sync so a newly set/changed code is
    // actually redeemable (see the same note in create()).
    if (updated.code) {
      const linkedCode = await this.prisma.couponCode.findUnique({ where: { code: updated.code } });
      if (!linkedCode) {
        await this.prisma.couponCode.create({
          data: { code: updated.code, promotionId: updated.id },
        });
      }
    }

    return {
      ...this.deserializePromotion(updated),
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
   * Delete a promotion. Safe: if it has never been redeemed, hard-delete it
   * (and its coupon codes, via cascade). If it has real redemption history,
   * archive it instead so order history/analytics referencing it stay intact.
   */
  async delete(id: string) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    if (promotion.usageCount > 0) {
      await this.prisma.promotion.update({
        where: { id },
        data: { isArchived: true, isActive: false },
      });
      return { success: true, archived: true, message: 'Voucher has redemption history, so it was archived instead of deleted.' };
    }

    await this.prisma.promotion.delete({ where: { id } });
    return { success: true, archived: false, message: 'Voucher deleted successfully' };
  }

  /**
   * Real, database-backed stats for the admin vouchers dashboard.
   */
  async getStats() {
    const promotions = await this.prisma.promotion.findMany({ where: { isArchived: false } });
    const statuses = promotions.map((p) => this.getPromotionStatus(p));

    const [totalRedemptions, discountAgg] = await Promise.all([
      this.prisma.couponRedemption.count({ where: { status: 'completed' } }),
      this.prisma.couponRedemption.aggregate({
        where: { status: 'completed' },
        _sum: { discountAmount: true },
      }),
    ]);

    return {
      totalVouchers: promotions.length,
      active: statuses.filter((s) => s === 'active').length,
      scheduled: statuses.filter((s) => s === 'scheduled').length,
      expired: statuses.filter((s) => s === 'expired').length,
      disabled: statuses.filter((s) => s === 'disabled').length,
      totalRedemptions,
      totalDiscountGranted: discountAgg._sum.discountAmount || 0,
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

      const limit = coupon.perCustomerLimit ?? promotion.perCustomerLimit ?? Infinity;
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
      discountPercentage: promotion.type === 'percentage' ? (promotion.value ?? undefined) : undefined,
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
    return this.prisma.$transaction((tx) =>
      this.redeemCouponInTx(tx, couponCode, userId, orderId, discountAmount)
    );
  }

  /**
   * Core redemption logic, usable both standalone (wrapped in its own
   * transaction by redeemCoupon above) and inlined into a caller's own
   * transaction (e.g. OrdersService creating the order and redeeming the
   * coupon atomically in one go). Re-checks usage limits against the live
   * row inside the transaction - SQLite serializes writers, so this closes
   * the race window between validate-coupon and redeem where two concurrent
   * checkouts could both pass validation against the same "slot" and both
   * redeem, exceeding the limit.
   */
  async redeemCouponInTx(
    tx: any,
    couponCode: string,
    userId: string,
    orderId: string,
    discountAmount: number
  ) {
    const normalizedCode = couponCode.toUpperCase().trim();

    const coupon = await tx.couponCode.findUnique({
      where: { code: normalizedCode },
      include: { promotion: true },
    });
    if (!coupon) {
      throw new BadRequestException('Coupon not found');
    }

    // Check if already redeemed (idempotency)
    const existing = await tx.couponRedemption.findFirst({
      where: { couponCodeId: coupon.id, userId, orderId },
    });
    if (existing) {
      return existing;
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon code has reached its usage limit');
    }
    if (coupon.promotion.totalUsageLimit && coupon.promotion.usageCount >= coupon.promotion.totalUsageLimit) {
      throw new BadRequestException('This promotion has reached its usage limit');
    }

    const redemption = await tx.couponRedemption.create({
      data: {
        couponCodeId: coupon.id,
        userId,
        orderId,
        status: 'completed',
        discountAmount,
      },
    });

    await tx.couponCode.update({
      where: { id: coupon.id },
      data: { usageCount: { increment: 1 } },
    });

    await tx.promotion.update({
      where: { id: coupon.promotionId },
      data: { usageCount: { increment: 1 } },
    });

    return redemption;
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

    // SQLite doesn't support skipDuplicates; codes are randomly generated so
    // collisions are effectively impossible at this scale.
    const created = await this.prisma.couponCode.createMany({
      data: codes,
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

  private async checkEligibility(items: CheckoutItem[], promotionRaw: any): Promise<boolean> {
    const promotion = this.deserializePromotion(promotionRaw);

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

  /**
   * Parse JSON-encoded eligibility/exclusion fields back into arrays
   */
  private deserializePromotion(promotion: any) {
    if (!promotion) return promotion;
    return {
      ...promotion,
      eligibleProductIds: this.safeParseArray(promotion.eligibleProductIds),
      eligibleCategoryIds: this.safeParseArray(promotion.eligibleCategoryIds),
      excludedProductIds: this.safeParseArray(promotion.excludedProductIds),
      excludedCategoryIds: this.safeParseArray(promotion.excludedCategoryIds),
    };
  }

  private safeParseArray(value: unknown): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
