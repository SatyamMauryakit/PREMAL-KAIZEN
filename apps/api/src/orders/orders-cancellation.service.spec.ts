import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

function makeDeps(orderOverrides: any = {}) {
  const baseOrder = {
    id: 'order_1',
    userId: 'user_1',
    status: 'pending',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    paymentVerifiedAt: null,
    razorpayPaymentId: null,
    refundStatus: null,
    total: 55000,
    items: [{ productId: 'prod_1', quantity: 1, selectedSize: null, selectedColor: null, product: { name: 'Hoodie' } }],
    address: null,
    user: { id: 'user_1', email: 'buyer@example.com', firstName: 'Priya' },
    ...orderOverrides,
  };

  const tx = {
    order: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ ...baseOrder, status: 'cancelled' }),
    },
    orderStatusEvent: { create: vi.fn().mockResolvedValue({}) },
  };

  const prisma = {
    order: {
      findUnique: vi.fn().mockResolvedValue(baseOrder),
      // Plain (non-tx) updateMany is only ever called by attemptRefund's duplicate-refund guard.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ ...baseOrder, refundStatus: 'refunded', refundId: 'rfnd_1' }),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  } as any;

  const notificationService = { enqueue: vi.fn().mockResolvedValue({}) } as any;
  const invoicesService = {} as any;
  const inventoryService = { restoreForCancellation: vi.fn().mockResolvedValue(undefined) } as any;
  const razorpayService = { refund: vi.fn().mockResolvedValue({ id: 'rfnd_1', status: 'processed' }) } as any;
  const promotionsService = {} as any;
  const settingsService = {} as any;

  return { prisma, tx, notificationService, invoicesService, inventoryService, razorpayService, promotionsService, settingsService, baseOrder };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new OrdersService(
    deps.prisma,
    deps.promotionsService,
    deps.settingsService,
    deps.razorpayService,
    deps.notificationService,
    deps.invoicesService,
    deps.inventoryService,
  );
}

// Flush the two post-transaction fire-and-forget calls (inventory restore + refund
// attempt) that cancelByCustomer kicks off without awaiting them as part of its own
// return — a microtask tick is enough since every mock above resolves synchronously.
async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('OrdersService.cancelByCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['pending', 'confirmed', 'processing', 'packed'])('cancels an order in %s status', async (status) => {
    const deps = makeDeps({ status });
    const service = makeService(deps);

    const result = await service.cancelByCustomer('order_1', 'user_1', 'mistake', 'test comment');

    expect(result.status).toBe('cancelled');
    expect(deps.tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', status: { in: ['pending', 'confirmed', 'processing', 'packed'] } },
      data: expect.objectContaining({
        status: 'cancelled',
        cancelledBy: 'user_1',
        cancellationReason: 'mistake',
        cancellationComment: 'test comment',
      }),
    });
    expect(deps.tx.orderStatusEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: 'order_1', fromStatus: status, toStatus: 'cancelled' }) }),
    );
  });

  it.each(['shipped', 'out_for_delivery', 'delivered'])('rejects cancellation once the order is %s', async (status) => {
    const deps = makeDeps({ status });
    const service = makeService(deps);

    await expect(service.cancelByCustomer('order_1', 'user_1', 'mistake')).rejects.toThrow(ForbiddenException);
    expect(deps.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects cancelling an already-cancelled order', async () => {
    const deps = makeDeps({ status: 'cancelled' });
    const service = makeService(deps);

    await expect(service.cancelByCustomer('order_1', 'user_1', 'mistake')).rejects.toThrow(ForbiddenException);
  });

  it('rejects cancelling another customer\'s order', async () => {
    const deps = makeDeps({ userId: 'someone_else' });
    const service = makeService(deps);

    await expect(service.cancelByCustomer('order_1', 'user_1', 'mistake')).rejects.toThrow(ForbiddenException);
    expect(deps.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-existent order', async () => {
    const deps = makeDeps();
    deps.prisma.order.findUnique.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.cancelByCustomer('missing', 'user_1', 'mistake')).rejects.toThrow(NotFoundException);
  });

  it('aborts with a conflict when the order status changed concurrently (lost the race)', async () => {
    const deps = makeDeps();
    deps.tx.order.updateMany.mockResolvedValue({ count: 0 });
    const service = makeService(deps);

    await expect(service.cancelByCustomer('order_1', 'user_1', 'mistake')).rejects.toThrow(ConflictException);
    expect(deps.tx.orderStatusEvent.create).not.toHaveBeenCalled();
    expect(deps.notificationService.enqueue).not.toHaveBeenCalled();
  });

  it('restores inventory for every line item exactly once', async () => {
    const items = [
      { productId: 'prod_1', quantity: 1, selectedSize: 'M', selectedColor: null },
      { productId: 'prod_2', quantity: 3, selectedSize: null, selectedColor: 'Black' },
    ];
    const deps = makeDeps({ items });
    const service = makeService(deps);

    await service.cancelByCustomer('order_1', 'user_1', 'mistake');
    await flush();

    expect(deps.inventoryService.restoreForCancellation).toHaveBeenCalledTimes(1);
    expect(deps.inventoryService.restoreForCancellation).toHaveBeenCalledWith(items, 'order_1');
  });

  it('does not attempt a refund for a COD order', async () => {
    const deps = makeDeps({ paymentMethod: 'cod' });
    const service = makeService(deps);

    await service.cancelByCustomer('order_1', 'user_1', 'mistake');
    await flush();

    expect(deps.razorpayService.refund).not.toHaveBeenCalled();
  });

  it('does not attempt a refund for a payment that was never captured', async () => {
    const deps = makeDeps({ paymentMethod: 'card', paymentStatus: 'pending', paymentVerifiedAt: null, razorpayPaymentId: null });
    const service = makeService(deps);

    await service.cancelByCustomer('order_1', 'user_1', 'mistake');
    await flush();

    expect(deps.razorpayService.refund).not.toHaveBeenCalled();
  });

  it('issues a real Razorpay refund for a captured prepaid order and records the refund id', async () => {
    const deps = makeDeps({
      paymentMethod: 'card',
      paymentStatus: 'completed',
      paymentVerifiedAt: new Date(),
      razorpayPaymentId: 'pay_123',
    });
    const service = makeService(deps);

    await service.cancelByCustomer('order_1', 'user_1', 'mistake');
    await flush();

    expect(deps.razorpayService.refund).toHaveBeenCalledWith('pay_123', 55000);
    expect(deps.prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundStatus: 'refunded', refundId: 'rfnd_1', paymentStatus: 'refunded' }),
      }),
    );
    expect(deps.notificationService.enqueue).toHaveBeenCalledWith('order_1', 'payment_refunded', expect.anything());
  });

  it('marks the refund failed (without throwing) when the Razorpay API call fails', async () => {
    const deps = makeDeps({
      paymentMethod: 'card',
      paymentStatus: 'completed',
      paymentVerifiedAt: new Date(),
      razorpayPaymentId: 'pay_123',
    });
    deps.razorpayService.refund.mockRejectedValue(new Error('Razorpay unreachable'));
    const service = makeService(deps);

    await expect(service.cancelByCustomer('order_1', 'user_1', 'mistake')).resolves.toBeDefined();
    await flush();

    expect(deps.prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { refundStatus: 'failed' } }),
    );
  });

  it('prevents a duplicate refund when one is already in flight or done', async () => {
    const deps = makeDeps({
      paymentMethod: 'card',
      paymentStatus: 'completed',
      paymentVerifiedAt: new Date(),
      razorpayPaymentId: 'pay_123',
      refundStatus: 'processing',
    });
    // Simulates the conditional updateMany matching zero rows because refundStatus
    // is already 'processing' (not null/'failed').
    deps.prisma.order.updateMany.mockResolvedValue({ count: 0 });
    const service = makeService(deps);

    await service.cancelByCustomer('order_1', 'user_1', 'mistake');
    await flush();

    expect(deps.razorpayService.refund).not.toHaveBeenCalled();
  });
});

describe('OrdersService.updateStatus - admin cancellation also triggers a refund attempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls attemptRefund when an admin cancels a captured prepaid order via the status route', async () => {
    const order = {
      id: 'order_1',
      status: 'packed',
      paymentMethod: 'card',
      paymentStatus: 'completed',
      paymentVerifiedAt: new Date(),
      razorpayPaymentId: 'pay_999',
      refundStatus: null,
      total: 20000,
      items: [{ productId: 'prod_1', quantity: 1 }],
      address: null,
      user: { email: 'buyer@example.com', firstName: 'Admin Target' },
    };
    const tx = {
      orderStatusEvent: { create: vi.fn().mockResolvedValue({}) },
      order: { update: vi.fn().mockResolvedValue({ ...order, status: 'cancelled' }) },
    };
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue(order),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ ...order, status: 'cancelled', refundStatus: 'refunded', refundId: 'rfnd_2' }),
      },
      $transaction: vi.fn(async (fn: any) => fn(tx)),
    } as any;
    const notificationService = { enqueue: vi.fn().mockResolvedValue({}) } as any;
    const inventoryService = { restoreForCancellation: vi.fn().mockResolvedValue(undefined) } as any;
    const razorpayService = { refund: vi.fn().mockResolvedValue({ id: 'rfnd_2', status: 'processed' }) } as any;

    const service = new OrdersService(prisma, {} as any, {} as any, razorpayService, notificationService, {} as any, inventoryService);

    await service.updateStatus('order_1', 'cancelled', 'admin_1');
    await new Promise((r) => setTimeout(r, 0));

    expect(razorpayService.refund).toHaveBeenCalledWith('pay_999', 20000);
  });
});
