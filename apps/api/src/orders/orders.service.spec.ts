import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

const PRODUCT = {
  id: 'prod_1',
  isActive: true,
  price: 50000,
  categoryId: null,
};

const BASE_SETTINGS = {
  defaultTaxRate: 0,
  taxCalculationMode: 'exclusive',
  businessState: '',
  shippingMethods: [{ id: 'standard', name: 'Standard', price: 5000, enabled: true }],
  codEnabled: true,
  razorpayEnabled: false,
};

function makeDeps(settingsOverride: Partial<typeof BASE_SETTINGS> = {}) {
  const prisma = {
    product: { findUnique: vi.fn().mockResolvedValue(PRODUCT) },
    address: { findUnique: vi.fn() },
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        order: { create: vi.fn().mockResolvedValue({ id: 'order_1', orderNumber: 'PK-2026-000001', total: 55000 }) },
      }),
    ),
  } as any;

  const promotionsService = {} as any;

  const settingsService = {
    getSettings: vi.fn().mockResolvedValue({ ...BASE_SETTINGS, ...settingsOverride }),
  } as any;

  const razorpayService = {
    createOrder: vi.fn().mockResolvedValue({ id: 'rzp_order_1', amount: 55000, currency: 'INR' }),
    getPublicKeyId: vi.fn().mockReturnValue('rzp_test_key'),
  } as any;

  const emailService = {
    sendCodOrderPlacedEmail: vi.fn().mockResolvedValue(true),
  } as any;

  return { prisma, promotionsService, settingsService, razorpayService, emailService };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  const service = new OrdersService(deps.prisma, deps.promotionsService, deps.settingsService, deps.razorpayService, deps.emailService);
  // findById is called at the end of create() - stub it so these tests stay focused on
  // the payment-method gating logic rather than the full read-back query shape.
  vi.spyOn(service, 'findById').mockResolvedValue({ id: 'order_1', orderNumber: 'PK-2026-000001' } as any);
  return service;
}

const ITEMS = [{ productId: 'prod_1', quantity: 1 }];

describe('OrdersService payment method enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows a COD order when COD is enabled and sends exactly one placement email', async () => {
    const deps = makeDeps({ codEnabled: true });
    deps.prisma.order.findUnique.mockResolvedValue({
      id: 'order_1',
      orderEmailSentAt: null,
      orderNumber: 'PK-2026-000001',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      total: 55000,
      user: { email: 'buyer@example.com', firstName: 'Priya' },
      items: [],
      address: null,
    });
    const service = makeService(deps);

    await expect(service.create('user_1', { items: ITEMS, paymentMethod: 'cod' })).resolves.toBeDefined();
    expect(deps.emailService.sendCodOrderPlacedEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a COD order when COD is disabled server-side, even if the client requests it directly', async () => {
    const deps = makeDeps({ codEnabled: false });
    const service = makeService(deps);

    await expect(service.create('user_1', { items: ITEMS, paymentMethod: 'cod' })).rejects.toThrow(BadRequestException);
    expect(deps.emailService.sendCodOrderPlacedEmail).not.toHaveBeenCalled();
  });

  it('rejects an online payment method when Razorpay is disabled, even via direct API call', async () => {
    const deps = makeDeps({ razorpayEnabled: false });
    const service = makeService(deps);

    await expect(service.create('user_1', { items: ITEMS, paymentMethod: 'card' })).rejects.toThrow(BadRequestException);
    expect(deps.razorpayService.createOrder).not.toHaveBeenCalled();
  });

  it('allows an online payment method and creates a matching Razorpay order when Razorpay is enabled', async () => {
    const deps = makeDeps({ razorpayEnabled: true });
    const service = makeService(deps);

    const result: any = await service.create('user_1', { items: ITEMS, paymentMethod: 'card' });

    expect(deps.razorpayService.createOrder).toHaveBeenCalledTimes(1);
    expect(result.razorpay).toBeDefined();
    expect(result.razorpay.orderId).toBe('rzp_order_1');
    // Online orders must never get the COD "placed" email - that's reserved for
    // actually-verified payments, sent only from the payments verify/webhook path.
    expect(deps.emailService.sendCodOrderPlacedEmail).not.toHaveBeenCalled();
  });

  it('rolls back (deletes) the pending order if Razorpay order creation fails', async () => {
    const deps = makeDeps({ razorpayEnabled: true });
    deps.razorpayService.createOrder.mockRejectedValue(new Error('Razorpay unreachable'));
    const service = makeService(deps);

    await expect(service.create('user_1', { items: ITEMS, paymentMethod: 'card' })).rejects.toThrow(BadRequestException);
    expect(deps.prisma.order.delete).toHaveBeenCalledWith({ where: { id: 'order_1' } });
  });

  it('rejects when every payment method is disabled (maintenance-style lockdown)', async () => {
    const deps = makeDeps({ codEnabled: false, razorpayEnabled: false });
    const service = makeService(deps);

    await expect(service.create('user_1', { items: ITEMS, paymentMethod: 'cod' })).rejects.toThrow(BadRequestException);
    await expect(service.create('user_1', { items: ITEMS, paymentMethod: 'card' })).rejects.toThrow(BadRequestException);
  });

  it('defaults to cod when no paymentMethod is supplied, honoring the codEnabled toggle', async () => {
    const deps = makeDeps({ codEnabled: true });
    const service = makeService(deps);

    await expect(service.create('user_1', { items: ITEMS })).resolves.toBeDefined();
  });
});

/**
 * Pins the current SQLite-active search behavior for the admin order search
 * (orderNumber / user.email). See categories.service.spec.ts for the full
 * rationale. PostgreSQL cutover patch: add `mode: 'insensitive' as const` to
 * both `contains` filters once the schema provider switches.
 */
describe('OrdersService.findAll - search filter (SQLite active, PostgreSQL cutover pending)', () => {
  it('builds a plain case-sensitivity-unaware contains filter on orderNumber/user.email', async () => {
    const deps = makeDeps();
    deps.prisma.order.findMany = vi.fn().mockResolvedValue([]);
    deps.prisma.order.count = vi.fn().mockResolvedValue(0);
    const service = new OrdersService(deps.prisma, deps.promotionsService, deps.settingsService, deps.razorpayService, deps.emailService);

    await service.findAll({ search: 'Mixed CASE' });

    const expectedWhere = {
      OR: [
        { orderNumber: { contains: 'Mixed CASE' } },
        { user: { email: { contains: 'Mixed CASE' } } },
      ],
    };

    expect(deps.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(deps.prisma.order.count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
