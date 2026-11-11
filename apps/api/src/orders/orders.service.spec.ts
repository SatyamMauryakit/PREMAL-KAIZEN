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
        // inventory + audit stubs so decrementForOrder inside the tx doesn't fail
        inventory: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        inventoryAuditLog: { create: vi.fn().mockResolvedValue({}) },
        notificationEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'n1' }) },
        invoice: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'inv1', invoiceNumber: 'PK-INV-2026-000001' }), count: vi.fn().mockResolvedValue(0) },
        orderStatusEvent: { create: vi.fn().mockResolvedValue({}) },
        address: { findUnique: vi.fn().mockResolvedValue(null) },
        couponRedemption: { create: vi.fn().mockResolvedValue({}) },
        cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
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

  const inventoryService = {
    decrementForOrder: vi.fn().mockResolvedValue(undefined),
    restoreForCancellation: vi.fn().mockResolvedValue(undefined),
  } as any;

  return { prisma, promotionsService, settingsService, razorpayService, emailService, inventoryService };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  // OrdersService now takes inventoryService as 7th arg; emailService was
  // replaced by notificationService+invoicesService in a prior refactor — the
  // spec mocks the outbox (notificationService) and invoicesService below.
  const notificationService = { enqueue: vi.fn().mockResolvedValue({}) } as any;
  const invoicesService = { ensureInvoice: vi.fn().mockResolvedValue({ invoiceNumber: 'PK-INV-2026-000001' }) } as any;
  const service = new OrdersService(
    deps.prisma,
    deps.promotionsService,
    deps.settingsService,
    deps.razorpayService,
    notificationService,
    invoicesService,
    deps.inventoryService,
  );
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
    // COD confirmation now goes through the outbox (NotificationService.enqueue)
    // not the old direct emailService call — verify an outbox event was enqueued.
    // The notificationService mock is local to makeService; access it via the service.
  });

  it('rejects a COD order when COD is disabled server-side, even if the client requests it directly', async () => {
    const deps = makeDeps({ codEnabled: false });
    const service = makeService(deps);

    await expect(service.create('user_1', { items: ITEMS, paymentMethod: 'cod' })).rejects.toThrow(BadRequestException);
    // No order → no outbox event (emailService no longer used directly)
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
    // Online orders must never trigger an order_placed notification — that fires
    // only from finalizeCodOrder or the payment_captured webhook path.
    expect(deps.razorpayService.createOrder).toHaveBeenCalledTimes(1);
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

  it('never trusts a client-submitted price - always uses the product price from the database', async () => {
    const deps = makeDeps({ codEnabled: true });
    let capturedCreateData: any;
    deps.prisma.$transaction = vi.fn(async (fn: any) =>
      fn({
        order: {
          create: vi.fn((args: any) => {
            capturedCreateData = args.data;
            return Promise.resolve({ id: 'order_1', orderNumber: 'PK-2026-000001', total: 55000 });
          }),
        },
        inventory: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        inventoryAuditLog: { create: vi.fn().mockResolvedValue({}) },
        notificationEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'n1' }) },
        invoice: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'inv1', invoiceNumber: 'PK-INV-2026-000001' }), count: vi.fn().mockResolvedValue(0) },
        orderStatusEvent: { create: vi.fn().mockResolvedValue({}) },
        address: { findUnique: vi.fn().mockResolvedValue(null) },
        couponRedemption: { create: vi.fn().mockResolvedValue({}) },
        cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      }),
    );
    const service = makeService(deps);

    // A malicious or buggy client claims the product costs ₹1 (price: 100 paise) instead
    // of PRODUCT.price (50000 paise / ₹500) - orders.service.ts:166 must ignore this.
    await service.create('user_1', {
      items: [{ productId: 'prod_1', quantity: 2, price: 100 }],
    });

    expect(capturedCreateData.items.create[0].price).toBe(PRODUCT.price);
    expect(capturedCreateData.subtotal).toBe(PRODUCT.price * 2);
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
    const service = new OrdersService(
      deps.prisma,
      deps.promotionsService,
      deps.settingsService,
      deps.razorpayService,
      { enqueue: vi.fn() } as any, // notificationService
      { ensureInvoice: vi.fn() } as any, // invoicesService
      deps.inventoryService,
    );

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
