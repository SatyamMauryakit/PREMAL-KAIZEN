import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';

const VALID_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const VALID_PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'];

// Status transition rules: what statuses can transition to what
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [], // Terminal state
  cancelled: [], // Terminal state
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService, private promotionsService: PromotionsService) {}

  async findAll(filters?: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    search?: string;
    userId?: string;
  }) {
    const page = Number(filters?.page) || 1;
    const limit = Number(filters?.limit) || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    if (filters?.paymentStatus) {
      whereClause.paymentStatus = filters.paymentStatus;
    }

    if (filters?.search) {
      whereClause.OR = [
        { orderNumber: { contains: filters.search } },
        { user: { email: { contains: filters.search } } },
      ];
    }

    if (filters?.userId) {
      whereClause.userId = filters.userId;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: { items: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: whereClause }),
    ]);

    return {
      data: orders,
      total,
      page,
      pageSize: limit,
    };
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { include: { product: true } }, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    return order;
  }

  /**
   * Create a real order from the authenticated user's cart.
   * Prices, stock existence, and the discount are all recomputed server-side
   * from the database - the client only supplies product IDs, quantities,
   * and an optional coupon code. Order + items + coupon redemption all
   * commit (or roll back) together in one transaction.
   */
  async create(userId: string, data: any) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    const lineItems: Array<{
      productId: string;
      quantity: number;
      price: number;
      categoryId: string | null;
      selectedSize: string | null;
      selectedColor: string | null;
    }> = [];

    for (const item of data.items) {
      const quantity = Number(item.quantity);
      if (!item.productId || !Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException('Each item needs a productId and a positive integer quantity');
      }

      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        throw new BadRequestException(`Product ${item.productId} is not available for purchase`);
      }

      lineItems.push({
        productId: product.id,
        quantity,
        price: product.price, // server-authoritative price, never trust the client's
        categoryId: product.categoryId,
        selectedSize: item.selectedSize || null,
        selectedColor: item.selectedColor || null,
      });
    }

    const subtotal = lineItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    let discount = 0;
    let promotionId: string | null = null;
    let couponCode: string | null = null;

    if (data.couponCode) {
      const eligibilityItems = lineItems.map((i) => ({
        productId: i.productId,
        categoryId: i.categoryId || undefined,
        quantity: i.quantity,
        price: i.price,
      }));
      const discountCalc = await this.promotionsService.validateAndApplyCoupon(
        data.couponCode,
        userId,
        eligibilityItems,
        subtotal
      );
      discount = discountCalc.discountAmount;
      promotionId = discountCalc.promotionId || null;
      couponCode = discountCalc.couponCode || null;
    }

    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.round(taxableAmount * 0.18);
    const shipping = subtotal > 10000 ? 0 : 100;
    const total = taxableAmount + tax + shipping;

    const timestamp = new Date();
    const year = timestamp.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(6, '0');
    const orderNumber = `PK-${year}-${random}`;

    const PAYMENT_METHODS = ['card', 'upi', 'netbanking', 'cod'];
    const SHIPPING_METHODS = ['standard', 'express', 'overnight'];
    const paymentMethod = PAYMENT_METHODS.includes(data.paymentMethod) ? data.paymentMethod : 'cod';
    const shippingMethod = SHIPPING_METHODS.includes(data.shippingMethod) ? data.shippingMethod : 'standard';

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          orderNumber,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod,
          shippingMethod,
          subtotal,
          discount,
          shipping,
          tax,
          total,
          promotionId,
          couponCode,
          notes: data.notes || null,
          addressId: data.addressId || null,
          items: {
            create: lineItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
              selectedSize: i.selectedSize,
              selectedColor: i.selectedColor,
            })),
          },
        },
      });

      if (couponCode) {
        await this.promotionsService.redeemCouponInTx(tx, couponCode, userId, created.id, discount);
      }

      return created;
    });

    return this.findById(order.id);
  }

  async updateStatus(id: string, newStatus: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (!VALID_ORDER_STATUSES.includes(newStatus)) {
      throw new BadRequestException(`Invalid status: ${newStatus}`);
    }

    // Check if transition is allowed
    const allowedTransitions = STATUS_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${newStatus}`
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
      include: { items: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    return updated;
  }

  async updatePaymentStatus(id: string, paymentStatus: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      throw new BadRequestException(`Invalid payment status: ${paymentStatus}`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        paymentStatus,
        updatedAt: new Date(),
      },
      include: { items: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    return updated;
  }

  async updateShipping(id: string, data: any) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        carrier: data.carrier || order.carrier,
        trackingNumber: data.trackingNumber || order.trackingNumber,
        estimatedDelivery: data.estimatedDelivery || order.estimatedDelivery,
        updatedAt: new Date(),
      },
      include: { items: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    return updated;
  }

  async addNotes(id: string, notes: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        internalNotes: notes,
        updatedAt: new Date(),
      },
      include: { items: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    return updated;
  }

  async delete(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Only allow deletion of pending/cancelled orders
    if (!['pending', 'cancelled'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot delete order with status: ${order.status}`
      );
    }

    await this.prisma.order.delete({ where: { id } });

    return { success: true, message: 'Order deleted successfully' };
  }
}
