import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

function makeOrder(overrides: Partial<any> = {}) {
  return {
    id: 'order_1',
    userId: 'user_1',
    orderNumber: 'PK-2026-000001',
    total: 50000,
    paymentStatus: 'pending',
    paymentMethod: 'card',
    subtotal: 50000,
    discount: 0,
    shipping: 0,
    tax: 0,
    razorpayOrderId: 'rzp_order_1',
    paymentVerifiedAt: null,
    user: { email: 'buyer@example.com', firstName: 'Priya' },
    items: [{ productId: 'prod_1', quantity: 1, price: 50000, selectedSize: null, selectedColor: null }],
    address: null,
    estimatedDelivery: null,
    carrier: null,
    trackingNumber: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDeps() {
  const prisma = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    paymentWebhookEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    notificationEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'n1' }),
    },
    invoice: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'inv1', invoiceNumber: 'PK-INV-2026-000001' }),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) },
        notificationEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'n1' }) },
        invoice: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'inv1', invoiceNumber: 'PK-INV-2026-000001' }), count: vi.fn().mockResolvedValue(0) },
      }),
    ),
  } as any;

  const razorpayService = {
    verifyPaymentSignature: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    fetchPayment: vi.fn(),
  } as any;

  // NotificationService mock (replaces old emailService direct calls)
  const notificationService = {
    enqueue: vi.fn().mockResolvedValue({ id: 'n1' }),
  } as any;

  // InvoicesService mock
  const invoicesService = {
    ensureInvoice: vi.fn().mockResolvedValue({ id: 'inv1', invoiceNumber: 'PK-INV-2026-000001' }),
  } as any;

  return { prisma, razorpayService, notificationService, invoicesService };
}

describe('PaymentsService.verifyPayment', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = makeDeps();
    service = new PaymentsService(deps.prisma, deps.razorpayService, deps.notificationService, deps.invoicesService);
  });

  it('rejects when required fields are missing', async () => {
    await expect(service.verifyPayment('user_1', {} as any)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the order does not belong to the caller', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ userId: 'someone_else' }));
    await expect(
      service.verifyPayment('user_1', {
        orderId: 'order_1',
        razorpay_order_id: 'rzp_order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('is idempotent - returns success without re-verifying if already verified', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ paymentVerifiedAt: new Date() }));
    const result = await service.verifyPayment('user_1', {
      orderId: 'order_1',
      razorpay_order_id: 'rzp_order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });
    expect(result.alreadyVerified).toBe(true);
    expect(deps.razorpayService.verifyPaymentSignature).not.toHaveBeenCalled();
    expect(deps.notificationService.enqueue).not.toHaveBeenCalled();
  });

  it('rejects when the razorpay_order_id does not match the order on file', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder());
    await expect(
      service.verifyPayment('user_1', {
        orderId: 'order_1',
        razorpay_order_id: 'a_different_razorpay_order',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid signature and does not mark the order paid', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder());
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(false);

    await expect(
      service.verifyPayment('user_1', {
        orderId: 'order_1',
        razorpay_order_id: 'rzp_order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'bad_signature',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when the amount Razorpay reports does not match the order total', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 50000 }));
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(true);
    deps.razorpayService.fetchPayment.mockResolvedValue({
      status: 'captured',
      amount: 1, // tampered amount
      currency: 'INR',
      orderId: 'rzp_order_1',
    });

    await expect(
      service.verifyPayment('user_1', {
        orderId: 'order_1',
        razorpay_order_id: 'rzp_order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when the currency does not match', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 50000 }));
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(true);
    deps.razorpayService.fetchPayment.mockResolvedValue({
      status: 'captured',
      amount: 50000,
      currency: 'USD',
      orderId: 'rzp_order_1',
    });

    await expect(
      service.verifyPayment('user_1', {
        orderId: 'order_1',
        razorpay_order_id: 'rzp_order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when Razorpay reports the payment is not actually captured', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 50000 }));
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(true);
    deps.razorpayService.fetchPayment.mockResolvedValue({
      status: 'failed',
      amount: 50000,
      currency: 'INR',
      orderId: 'rzp_order_1',
    });

    await expect(
      service.verifyPayment('user_1', {
        orderId: 'order_1',
        razorpay_order_id: 'rzp_order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks order paid and enqueues payment_captured notification on valid verification', async () => {
    const fullOrder = makeOrder({ total: 50000 });
    deps.prisma.order.findUnique.mockResolvedValue(fullOrder);
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(true);
    deps.razorpayService.fetchPayment.mockResolvedValue({
      status: 'captured',
      amount: 50000,
      currency: 'INR',
      orderId: 'rzp_order_1',
    });

    const result = await service.verifyPayment('user_1', {
      orderId: 'order_1',
      razorpay_order_id: 'rzp_order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'valid_sig',
    });

    expect(result.success).toBe(true);
    // Transaction committed (updateMany inside tx) and notification enqueued via tx
    expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not mark a failed payment as paid', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 50000 }));
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(true);
    deps.razorpayService.fetchPayment.mockResolvedValue({
      status: 'failed',
      amount: 50000,
      currency: 'INR',
      orderId: 'rzp_order_1',
    });

    await expect(
      service.verifyPayment('user_1', {
        orderId: 'order_1',
        razorpay_order_id: 'rzp_order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('PaymentsService.handleWebhook', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: PaymentsService;
  const rawBody = Buffer.from(
    JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'rzp_order_1', amount: 50000, currency: 'INR' } } } }),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    deps = makeDeps();
    service = new PaymentsService(deps.prisma, deps.razorpayService, deps.notificationService, deps.invoicesService);
  });

  it('rejects when the webhook signature is invalid', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(false);
    await expect(service.handleWebhook(rawBody, 'bad-sig')).rejects.toThrow(BadRequestException);
  });

  it('marks duplicate webhooks as ignored (idempotent)', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue({ id: 'existing' });

    const result = await service.handleWebhook(rawBody, 'valid-sig');
    expect(result.status).toBe('duplicate_ignored');
    expect(deps.prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('processes a captured payment and enqueues payment_captured notification', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 50000 }));

    const result = await service.handleWebhook(rawBody, 'valid-sig');

    expect(result.status).toBe('processed');
    expect(deps.prisma.paymentWebhookEvent.create).toHaveBeenCalled();
    // Transaction committed (contains updateMany + ensureInvoice + enqueue)
    expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not re-process an already-verified order', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 50000, paymentVerifiedAt: new Date() }));

    const result = await service.handleWebhook(rawBody, 'valid-sig');

    expect(result.status).toBe('processed');
    // No transaction = no updateMany called
    expect(deps.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not mark paid when the webhook amount does not match the stored order total', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 999999 })); // mismatched

    await service.handleWebhook(rawBody, 'valid-sig');

    expect(deps.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks a pending order failed and enqueues payment_failed on payment.failed webhook', async () => {
    const failedBody = Buffer.from(
      JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_2', order_id: 'rzp_order_1' } } } }),
    );
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ paymentStatus: 'pending' }));

    const result = await service.handleWebhook(failedBody, 'valid-sig');

    expect(result.status).toBe('processed');
    // Transaction committed for the failed path too
    expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('acknowledges but ignores an event type it does not handle', async () => {
    const otherBody = Buffer.from(JSON.stringify({ event: 'order.paid', payload: {} }));
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);

    const result = await service.handleWebhook(otherBody, 'valid-sig');
    expect(result.status).toBe('ignored_unhandled_event_type');
  });
});
