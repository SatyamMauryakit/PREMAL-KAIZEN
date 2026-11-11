import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { SettingsService } from '../settings/settings.service';
import { RazorpayService } from '../payments/razorpay.service';
import { NotificationService } from '../notifications/notification.service';
import { InvoicesService } from '../invoices/invoices.service';
import { buildOrderPayload } from '../notifications/order-payload';
import { InventoryService } from '../inventory/inventory.service';

const VALID_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  // Returns (added with this change) — backward compatible: delivered was terminal,
  // it now also allows a return request. These are admin-settable labels; the store
  // has no customer-initiated RMA flow, so they're driven by admin action + email.
  'return_requested',
  'return_approved',
  'return_rejected',
];
const VALID_PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'];

// Status transition rules: what statuses can transition to what
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['return_requested'], // a delivered order can initiate a return
  cancelled: [], // Terminal state
  return_requested: ['return_approved', 'return_rejected'],
  return_approved: [], // Terminal (refund, if any, is a payment-status change)
  return_rejected: [], // Terminal
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private promotionsService: PromotionsService,
    private settingsService: SettingsService,
    private razorpayService: RazorpayService,
    private notificationService: NotificationService,
    private invoicesService: InvoicesService,
    private inventoryService: InventoryService,
  ) { }

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
        include: { items: true, address: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
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
      include: { items: { include: { product: true } }, address: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { include: { product: true } }, address: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    return order;
  }

  /**
   * Guest order tracking - no login required, but the caller must know both the
   * order number AND the exact email on the order, so this can't be used to
   * enumerate or browse other customers' orders.
   */
  async findForGuestTracking(orderNumber: string, email: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { include: { product: true } }, address: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
    });

    if (!order || order.user.email.toLowerCase() !== email.trim().toLowerCase()) {
      throw new NotFoundException('Order not found. Please check your order number and email.');
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

    // Resolve the delivery address: either a saved address the user owns, or a new
    // one submitted inline at checkout (which we persist so it can be reused and so
    // the order has a permanent, real delivery address rather than discarding it).
    let resolvedAddressId: string | null = null;
    if (data.addressId) {
      const existing = await this.prisma.address.findUnique({ where: { id: data.addressId } });
      if (!existing || existing.userId !== userId) {
        throw new BadRequestException('Address not found');
      }
      resolvedAddressId = existing.id;
    } else if (data.shippingAddress) {
      const a = data.shippingAddress;
      const required = ['firstName', 'lastName', 'phoneNumber', 'street1', 'city', 'state', 'postalCode', 'country'];
      for (const field of required) {
        if (!a[field]) {
          throw new BadRequestException(`Shipping address ${field} is required`);
        }
      }
      const mobileDigits = String(a.phoneNumber).replace(/[\s-]/g, '').replace(/^(\+?91|0)/, '');
      if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
        throw new BadRequestException('Enter a valid 10-digit Indian mobile number');
      }
      if (!/^[1-9]\d{5}$/.test(String(a.postalCode).trim())) {
        throw new BadRequestException('Enter a valid 6-digit PIN code');
      }

      const created = await this.prisma.address.create({
        data: {
          userId,
          label: a.label || 'Checkout',
          firstName: a.firstName,
          lastName: a.lastName,
          phoneNumber: a.phoneNumber,
          street1: a.street1,
          street2: a.street2 || null,
          landmark: a.landmark || null,
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country,
          isDefault: false,
        },
      });
      resolvedAddressId = created.id;
    }

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

    // GST: rate/mode come from real store settings, never a hardcoded assumption.
    // The split (CGST+SGST vs IGST) depends on the business's registered state, which
    // the admin must configure - if it's missing we still charge the configured rate
    // but cannot determine the split, so cgst/sgst/igst stay 0 rather than guessing.
    const settings = await this.settingsService.getSettings();
    const taxRate = settings.defaultTaxRate || 0;
    const taxMode = settings.taxCalculationMode || 'exclusive';

    let tax = 0;
    if (taxRate > 0) {
      tax = taxMode === 'inclusive'
        ? Math.round((taxableAmount * taxRate) / (100 + taxRate))
        : Math.round((taxableAmount * taxRate) / 100);
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (tax > 0 && settings.businessState) {
      let shippingState: string | null = null;
      if (resolvedAddressId) {
        const address = await this.prisma.address.findUnique({ where: { id: resolvedAddressId } });
        shippingState = address?.state || null;
      }

      if (shippingState) {
        const isIntraState = shippingState.trim().toLowerCase() === settings.businessState.trim().toLowerCase();
        if (isIntraState) {
          cgst = Math.round(tax / 2);
          sgst = tax - cgst;
        } else {
          igst = tax;
        }
      }
    }

    // A payment method is only accepted if it's actually enabled server-side - never
    // let the client force an unconfigured/disabled method through. Razorpay is the
    // only online provider (Stripe was never actively integrated - no SDK, no checkout
    // flow, ever existed for it, so it is not offered here regardless of its legacy
    // settings flag). COD is its own independent toggle, not tied to any gateway.
    const availablePaymentMethods: string[] = [];
    if (settings.codEnabled !== false) availablePaymentMethods.push('cod');
    if (settings.razorpayEnabled) availablePaymentMethods.push('upi', 'netbanking', 'card');

    const requestedPaymentMethod = data.paymentMethod || 'cod';
    if (!availablePaymentMethods.includes(requestedPaymentMethod)) {
      throw new BadRequestException(`Payment method "${requestedPaymentMethod}" is not available`);
    }

    const shippingMethods: Array<{ id: string; price: number; enabled: boolean; freeShippingThreshold?: number }> = settings.shippingMethods || [];
    const requestedMethod = shippingMethods.find((m) => m.id === data.shippingMethod && m.enabled);
    const fallbackMethod = shippingMethods.find((m) => m.enabled);
    const chosenMethod = requestedMethod || fallbackMethod;

    const paymentMethod = requestedPaymentMethod;
    const shippingMethod = chosenMethod?.id || 'standard';
    const shipping = chosenMethod
      ? (chosenMethod.freeShippingThreshold && subtotal >= chosenMethod.freeShippingThreshold ? 0 : chosenMethod.price)
      : 0;

    const total = taxableAmount + tax + shipping;

    const timestamp = new Date();
    const year = timestamp.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(6, '0');
    const orderNumber = `PK-${year}-${random}`;

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
          cgst,
          sgst,
          igst,
          taxRate,
          total,
          promotionId,
          couponCode,
          notes: data.notes || null,
          addressId: resolvedAddressId,
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

      // Atomically decrement stock for every line item inside this transaction.
      // If any variant is out of stock the whole transaction rolls back — no order
      // is created and no stock is taken. Variants with no inventory row are skipped
      // (unlimited stock for that variant).
      await this.inventoryService.decrementForOrder(lineItems, tx, created.id);

      // The purchased items now belong to an order, not the cart - clear the
      // customer's saved cart here, atomically with order creation, rather than
      // relying solely on the frontend's best-effort DELETE after redirecting to
      // the confirmation page (which can be cut off mid-flight by that same
      // navigation and silently never arrive). This mirrors the stock decrement
      // above: both happen at order-creation time, for COD and online payment
      // alike, not deferred to payment confirmation.
      await tx.cartItem.deleteMany({ where: { userId } });

      return created;
    });

    if (paymentMethod === 'cod') {
      // COD orders are complete as soon as they're created - payment is collected on
      // delivery, not here. Issue the invoice and enqueue the order-confirmation
      // notification in the same transaction, so a crash can't leave an order without
      // its invoice or its confirmation email intent. Never claim payment succeeded.
      const full = await this.findById(order.id);
      await this.finalizeCodOrder(order.id, full, { subtotal, discount, shipping, tax, total });
      return full;
    }

    // Online payment methods: the order is created as pending/unpaid, and a matching
    // Razorpay order is created so the frontend can open Checkout. No confirmation
    // email is sent yet - that only happens once payment is verified.
    try {
      const razorpayOrder = await this.razorpayService.createOrder(order.total, 'INR', order.orderNumber);
      await this.prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: razorpayOrder.id },
      });
      const full = await this.findById(order.id);
      return { ...full, razorpay: { orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, keyId: this.razorpayService.getPublicKeyId() } };
    } catch (err) {
      // Online payment can't proceed - don't leave an unpayable pending order behind.
      await this.prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
      this.logger.error(`Failed to create Razorpay order: ${(err as Error).message}`);
      throw new BadRequestException('Online payment is not available right now. Please try Cash on Delivery or try again later.');
    }
  }

  /**
   * For a COD order: create its invoice (idempotent) and enqueue the order-placed
   * notification in one transaction. The order-confirmation email is then delivered by
   * the NotificationProcessor with the invoice attached. Idempotent on retry — the
   * invoice's `orderId` @unique and the notification's `idempotencyKey` mean a
   * repeated call is a no-op.
   */
  private async finalizeCodOrder(
    orderId: string,
    order: any,
    snapshot: { subtotal: number; discount: number; shipping: number; tax: number; total: number },
  ): Promise<void> {
    const payload = buildOrderPayload(order);
    await this.prisma.$transaction(async (tx) => {
      await this.invoicesService.ensureInvoice(orderId, { tx, snapshot });
      await this.notificationService.enqueue(orderId, 'order_placed', payload, { tx });
    });
  }

  async updateStatus(id: string, newStatus: string, changedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, address: true, user: true },
    });

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

    const payload = buildOrderPayload(order);
    payload.fromStatus = order.status;
    payload.newStatus = newStatus;

    // Persist the status change, record the audit trail (who/when/from->to), and
    // enqueue the customer-facing status notification all in one transaction, so the
    // audit and notification intent can never be lost relative to the status update.
    // The email itself is delivered later by the NotificationProcessor.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: changedBy ?? null,
        },
      });
      await this.notificationService.enqueue(id, `status_${newStatus}`, payload, { tx });
      return tx.order.update({
        where: { id },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
        include: { items: true, address: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
      });
    });

    // Restore stock after the status transition commits. Only do this when
    // transitioning INTO cancelled (not on every save), so stock is restored
    // exactly once per cancellation even if the endpoint is called redundantly.
    if (newStatus === 'cancelled') {
      await this.inventoryService.restoreForCancellation(order.items, id).catch((err) => {
        this.logger.error(`Stock restore failed for cancelled order ${id}: ${err.message}`);
      });
    }

    return updated;
  }

  async updatePaymentStatus(id: string, paymentStatus: string, changedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, address: true, user: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      throw new BadRequestException(`Invalid payment status: ${paymentStatus}`);
    }

    // A transition into 'refunded' notifies the customer. This is only enqueued when
    // actually crossing into refunded, and the outbox idempotency key means it fires
    // exactly once even if the admin saves twice. The email communicates the actual
    // result (refund initiated) — it never claims a refund before the admin confirms it.
    const transitioningToRefunded = paymentStatus === 'refunded' && order.paymentStatus !== 'refunded';
    const payload = buildOrderPayload(order);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (transitioningToRefunded) {
        await this.notificationService.enqueue(id, 'payment_refunded', payload, { tx });
      }
      return tx.order.update({
        where: { id },
        data: {
          paymentStatus,
          updatedAt: new Date(),
        },
        include: { items: true, address: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
      });
    });

    // Restore stock on refund (only when the order hasn't already been cancelled,
    // which would have restored stock already).
    if (transitioningToRefunded && order.status !== 'cancelled') {
      await this.inventoryService.restoreForCancellation(order.items, id).catch((err) => {
        this.logger.error(`Stock restore failed for refunded order ${id}: ${err.message}`);
      });
    }

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
      include: { items: true, address: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
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
      include: { items: true, address: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true } } },
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
