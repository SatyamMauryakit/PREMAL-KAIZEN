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
    razorpayOrderId: 'rzp_order_1',
    paymentVerifiedAt: null,
    paymentEmailSentAt: null,
    paymentFailedEmailSentAt: null,
    ...overrides,
  };
}

function makeDeps() {
  const prisma = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    paymentWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  } as any;

  const razorpayService = {
    verifyPaymentSignature: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    fetchPayment: vi.fn(),
  } as any;

  const emailService = {
    sendPaymentConfirmationEmail: vi.fn().mockResolvedValue(true),
    sendPaymentFailedEmail: vi.fn().mockResolvedValue(true),
  } as any;

  return { prisma, razorpayService, emailService };
}

describe('PaymentsService.verifyPayment', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: PaymentsService;

  beforeEach(() => {
    deps = makeDeps();
    service = new PaymentsService(deps.prisma, deps.razorpayService, deps.emailService);
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
    expect(deps.emailService.sendPaymentConfirmationEmail).not.toHaveBeenCalled();
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
    expect(deps.prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('rejects when the amount Razorpay reports does not match the order total', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 50000 }));
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(true);
    deps.razorpayService.fetchPayment.mockResolvedValue({
      status: 'captured',
      amount: 1, // tampered/mismatched amount
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
    expect(deps.prisma.order.updateMany).not.toHaveBeenCalled();
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

  it('marks the order paid and sends exactly one confirmation email on full success', async () => {
    deps.prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ total: 50000 })) // initial lookup
      .mockResolvedValueOnce({ ...makeOrder({ total: 50000 }), user: { email: 'buyer@example.com', firstName: 'Priya' }, items: [], address: null }); // email data lookup
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(true);
    deps.razorpayService.fetchPayment.mockResolvedValue({
      status: 'captured',
      amount: 50000,
      currency: 'INR',
      orderId: 'rzp_order_1',
    });
    deps.prisma.order.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.verifyPayment('user_1', {
      orderId: 'order_1',
      razorpay_order_id: 'rzp_order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });

    expect(result.success).toBe(true);
    expect(deps.prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order_1', paymentVerifiedAt: null } }),
    );
    expect(deps.emailService.sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it('does not send an email if the conditional update lost a race (count 0)', async () => {
    deps.prisma.order.findUnique.mockResolvedValue(makeOrder({ total: 50000 }));
    deps.razorpayService.verifyPaymentSignature.mockReturnValue(true);
    deps.razorpayService.fetchPayment.mockResolvedValue({
      status: 'captured',
      amount: 50000,
      currency: 'INR',
      orderId: 'rzp_order_1',
    });
    deps.prisma.order.updateMany.mockResolvedValue({ count: 0 }); // another caller (e.g. webhook) already verified it

    await service.verifyPayment('user_1', {
      orderId: 'order_1',
      razorpay_order_id: 'rzp_order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    });

    expect(deps.emailService.sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.handleWebhook', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: PaymentsService;

  const rawBody = Buffer.from(
    JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'rzp_order_1', amount: 50000, currency: 'INR' } } },
    }),
  );

  beforeEach(() => {
    deps = makeDeps();
    service = new PaymentsService(deps.prisma, deps.razorpayService, deps.emailService);
  });

  it('rejects a webhook with an invalid signature', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(false);
    await expect(service.handleWebhook(rawBody, 'bad-sig')).rejects.toThrow(BadRequestException);
    expect(deps.prisma.order.update).not.toHaveBeenCalled();
  });

  it('ignores a duplicate delivery of an already-processed event (idempotency)', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue({ id: 'existing' });

    const result = await service.handleWebhook(rawBody, 'valid-sig');

    expect(result.status).toBe('duplicate_ignored');
    expect(deps.prisma.order.findUnique).not.toHaveBeenCalled();
    expect(deps.prisma.order.updateMany).not.toHaveBeenCalled();
    expect(deps.emailService.sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  });

  it('marks the order paid on a fresh payment.captured event with matching amount/currency', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    deps.prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ total: 50000 })) // lookup by razorpayOrderId
      .mockResolvedValueOnce({ ...makeOrder({ total: 50000 }), user: { email: 'buyer@example.com', firstName: 'Priya' }, items: [], address: null });
    deps.prisma.order.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.handleWebhook(rawBody, 'valid-sig');

    expect(result.status).toBe('processed');
    expect(deps.prisma.paymentWebhookEvent.create).toHaveBeenCalled();
    expect(deps.prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentStatus: 'completed' }) }),
    );
    expect(deps.emailService.sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it('does not re-process or re-email an order whose payment is already verified', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    deps.prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ total: 50000, paymentVerifiedAt: new Date() }));

    const result = await service.handleWebhook(rawBody, 'valid-sig');

    expect(result.status).toBe('processed');
    expect(deps.prisma.order.updateMany).not.toHaveBeenCalled();
    expect(deps.emailService.sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  });

  it('does not mark paid when the webhook amount does not match the stored order total', async () => {
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    deps.prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ total: 999999 })); // mismatched total

    await service.handleWebhook(rawBody, 'valid-sig');

    expect(deps.prisma.order.updateMany).not.toHaveBeenCalled();
    expect(deps.emailService.sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  });

  it('marks a pending order failed and sends exactly one failure email on payment.failed', async () => {
    const failedBody = Buffer.from(
      JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_2', order_id: 'rzp_order_1' } } } }),
    );
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    deps.prisma.order.findUnique
      .mockResolvedValueOnce(makeOrder({ paymentStatus: 'pending' }))
      .mockResolvedValueOnce({ ...makeOrder({ paymentStatus: 'failed' }), user: { email: 'buyer@example.com', firstName: 'Priya' }, items: [], address: null });

    const result = await service.handleWebhook(failedBody, 'valid-sig');

    expect(result.status).toBe('processed');
    expect(deps.prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { paymentStatus: 'failed' } }),
    );
    expect(deps.emailService.sendPaymentFailedEmail).toHaveBeenCalledTimes(1);
  });

  it('acknowledges but ignores an event type it does not handle', async () => {
    const otherBody = Buffer.from(JSON.stringify({ event: 'order.paid', payload: {} }));
    deps.razorpayService.verifyWebhookSignature.mockReturnValue(true);
    deps.prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);

    const result = await service.handleWebhook(otherBody, 'valid-sig');

    expect(result.status).toBe('ignored_unhandled_event_type');
    expect(deps.prisma.paymentWebhookEvent.create).toHaveBeenCalled();
  });
});
