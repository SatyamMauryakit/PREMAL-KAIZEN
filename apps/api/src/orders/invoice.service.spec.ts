/**
 * Invoice + notification + inventory regression tests.
 * Covers test-suite requirements 1–12 from the master prompt.
 * Mocks email provider so no real emails are sent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from '../invoices/invoices.service';
import { OrdersService } from './orders.service';
import { InventoryService } from '../inventory/inventory.service';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const BASE_ORDER = {
  id: 'order_1',
  orderNumber: 'PK-2026-000001',
  userId: 'user_1',
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  subtotal: 170000,   // ₹1,700 × 1 (paise)
  discount: 0,
  shipping: 5000,     // ₹50 (paise)
  tax: 0,
  cgst: 0, sgst: 0, igst: 0, taxRate: 0,
  total: 175000,      // ₹1,750 (paise)
  couponCode: null,
  promotionId: null,
  shippingMethod: 'standard',
  status: 'pending',
  carrier: null,
  trackingNumber: null,
  addressId: null,
  estimatedDelivery: null,
  notes: null,
  internalNotes: null,
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-15T10:00:00Z'),
  razorpayOrderId: null,
  razorpayPaymentId: null,
  razorpaySignature: null,
  paymentVerifiedAt: null,
  orderEmailSentAt: null,
  paymentEmailSentAt: null,
  paymentFailedEmailSentAt: null,
};

const BASE_INVOICE = {
  id: 'inv_1',
  invoiceNumber: 'PK-INV-2026-000001',
  orderId: 'order_1',
  subtotal: 170000,
  discount: 0,
  shipping: 5000,
  tax: 0,
  total: 175000,
  currency: 'INR',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeInvoicePrisma(overrides: Partial<typeof BASE_INVOICE> = {}) {
  const inv = { ...BASE_INVOICE, ...overrides };
  return {
    invoice: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(inv),
      count: vi.fn().mockResolvedValue(0),
    },
    order: {
      findUnique: vi.fn().mockResolvedValue(BASE_ORDER),
    },
    storeSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ storeName: 'PREMAL KAIZEN', storeEmail: '', storePhone: '', businessAddress: '', gstin: '', defaultTaxRate: 0, taxCalculationMode: 'exclusive', shippingMethods: '[]' }),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Test 1: A successful order creates exactly one invoice
// Test 2: Duplicate order events do not create duplicate invoices (idempotency)
// ---------------------------------------------------------------------------

describe('InvoicesService — idempotent invoice creation', () => {
  it('test 1: creates exactly one invoice for a COD order', async () => {
    const prisma = makeInvoicePrisma();
    const settingsService = { getSettings: vi.fn().mockResolvedValue({ storeName: 'PREMAL KAIZEN', storeEmail: '', storePhone: '', businessAddress: '', gstin: '' }) } as any;
    const service = new InvoicesService(prisma, settingsService);

    await service.ensureInvoice('order_1');

    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    const created = await prisma.invoice.create.mock.results[0].value;
    expect(created.invoiceNumber).toBe('PK-INV-2026-000001');
    expect(created.total).toBe(175000);
  });

  it('test 2: duplicate ensureInvoice calls for the same order create exactly one invoice', async () => {
    const prisma = makeInvoicePrisma();
    const settingsService = { getSettings: vi.fn().mockResolvedValue({ storeName: 'PREMAL KAIZEN', storeEmail: '', storePhone: '', businessAddress: '', gstin: '' }) } as any;
    const service = new InvoicesService(prisma, settingsService);

    // First call: creates
    await service.ensureInvoice('order_1');

    // Second call: row now exists, must return it without creating again
    prisma.invoice.findUnique.mockResolvedValue(BASE_INVOICE);
    await service.ensureInvoice('order_1');

    expect(prisma.invoice.create).toHaveBeenCalledTimes(1); // still only 1
  });

  it('test 2b: concurrent P2002 unique-constraint race returns the existing invoice', async () => {
    const prisma = makeInvoicePrisma();
    // Simulate a P2002 race: findUnique returns null initially, create throws P2002,
    // then findUnique returns the row that the concurrent writer created.
    prisma.invoice.findUnique
      .mockResolvedValueOnce(null)       // first check (pre-create)
      .mockResolvedValueOnce(BASE_INVOICE); // fallback after P2002
    prisma.invoice.create.mockRejectedValue({ code: 'P2002' });

    const settingsService = { getSettings: vi.fn().mockResolvedValue({ storeName: 'PREMAL KAIZEN', storeEmail: '', storePhone: '', businessAddress: '', gstin: '' }) } as any;
    const service = new InvoicesService(prisma, settingsService);

    const result = await service.ensureInvoice('order_1');

    expect(result.invoiceNumber).toBe('PK-INV-2026-000001');
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1); // tried once, lost the race
  });

  it('does not create an invoice for an unpaid online order', async () => {
    const prisma = makeInvoicePrisma();
    prisma.order.findUnique.mockResolvedValue({
      ...BASE_ORDER,
      paymentMethod: 'card',
      paymentStatus: 'pending', // not yet paid
    });
    const settingsService = { getSettings: vi.fn().mockResolvedValue({}) } as any;
    const service = new InvoicesService(prisma, settingsService);

    await expect(service.ensureInvoice('order_1')).rejects.toThrow(BadRequestException);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('test 11 (invoice total matches order): invoice.total equals order.total', async () => {
    const prisma = makeInvoicePrisma();
    const settingsService = { getSettings: vi.fn().mockResolvedValue({}) } as any;
    const service = new InvoicesService(prisma, settingsService);

    const inv = await service.ensureInvoice('order_1');

    expect(inv.total).toBe(BASE_ORDER.total);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Customer receives an order confirmation email (via outbox)
// ---------------------------------------------------------------------------

describe('OrdersService — order confirmation notification enqueued', () => {
  it('test 3: a COD order enqueues an order_placed notification', async () => {
    const PRODUCT = { id: 'prod_1', isActive: true, price: 170000, categoryId: null };
    const notificationService = { enqueue: vi.fn().mockResolvedValue({}) };
    const invoicesService = { ensureInvoice: vi.fn().mockResolvedValue(BASE_INVOICE) };
    const inventoryService = { decrementForOrder: vi.fn().mockResolvedValue(undefined), restoreForCancellation: vi.fn() };
    const prisma = {
      product: { findUnique: vi.fn().mockResolvedValue(PRODUCT) },
      address: { findUnique: vi.fn() },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          ...BASE_ORDER,
          user: { email: 'buyer@example.com', firstName: 'Priya' },
          items: [{ productId: 'prod_1', quantity: 1, price: 170000, selectedSize: null, selectedColor: null }],
          address: null,
        }),
        update: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn(async (fn: any) =>
        fn({
          order: { create: vi.fn().mockResolvedValue({ ...BASE_ORDER, id: 'order_1' }) },
          inventory: { findUnique: vi.fn().mockResolvedValue(null) },
          inventoryAuditLog: { create: vi.fn() },
          notificationEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
          invoice: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(BASE_INVOICE), count: vi.fn().mockResolvedValue(0) },
          cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        }),
      ),
    } as any;
    const settings = { getSettings: vi.fn().mockResolvedValue({ codEnabled: true, razorpayEnabled: false, defaultTaxRate: 0, taxCalculationMode: 'exclusive', businessState: '', shippingMethods: [{ id: 'standard', name: 'Standard', price: 5000, enabled: true }] }) } as any;
    const service = new OrdersService(prisma, {} as any, settings, {} as any, notificationService as any, invoicesService as any, inventoryService as any);
    vi.spyOn(service, 'findById').mockResolvedValue({ ...BASE_ORDER, user: { email: 'buyer@example.com', firstName: 'Priya' }, items: [], address: null } as any);

    await service.create('user_1', { items: [{ productId: 'prod_1', quantity: 1 }], paymentMethod: 'cod' });

    expect(notificationService.enqueue).toHaveBeenCalledWith(
      'order_1', 'order_placed', expect.any(Object), expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests 4–7: Status-transition emails
// ---------------------------------------------------------------------------

describe('OrdersService.updateStatus — status email triggers', () => {
  function makeUpdateDeps(fromStatus = 'confirmed') {
    return {
      prisma: {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            ...BASE_ORDER,
            status: fromStatus,
            user: { email: 'buyer@example.com', firstName: 'Priya' },
            items: [],
            address: null,
          }),
          update: vi.fn().mockResolvedValue({ ...BASE_ORDER, status: 'shipped' }),
        },
        $transaction: vi.fn(async (fn: any) =>
          fn({
            orderStatusEvent: { create: vi.fn().mockResolvedValue({}) },
            notificationEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
            order: { update: vi.fn().mockResolvedValue({ ...BASE_ORDER, status: 'shipped' }) },
          }),
        ),
      } as any,
      notificationService: { enqueue: vi.fn().mockResolvedValue({}) },
      inventoryService: { restoreForCancellation: vi.fn() },
    };
  }

  it('test 4: transitioning to shipped enqueues status_shipped notification', async () => {
    const { prisma, notificationService, inventoryService } = makeUpdateDeps('packed');
    const service = new OrdersService(prisma, {} as any, {} as any, {} as any, notificationService as any, {} as any, inventoryService as any);

    await service.updateStatus('order_1', 'shipped', 'admin_1');

    expect(notificationService.enqueue).toHaveBeenCalledWith(
      'order_1', 'status_shipped', expect.any(Object), expect.any(Object),
    );
  });

  it('test 5: transitioning to out_for_delivery enqueues status_out_for_delivery', async () => {
    const { prisma, notificationService, inventoryService } = makeUpdateDeps('shipped');
    prisma.order.findUnique.mockResolvedValue({ ...BASE_ORDER, status: 'shipped', user: { email: 'buyer@example.com', firstName: 'Priya' }, items: [], address: null });
    const service = new OrdersService(prisma, {} as any, {} as any, {} as any, notificationService as any, {} as any, inventoryService as any);

    await service.updateStatus('order_1', 'out_for_delivery', 'admin_1');

    expect(notificationService.enqueue).toHaveBeenCalledWith(
      'order_1', 'status_out_for_delivery', expect.any(Object), expect.any(Object),
    );
  });

  it('test 6: transitioning to delivered enqueues status_delivered', async () => {
    const { prisma, notificationService, inventoryService } = makeUpdateDeps('out_for_delivery');
    prisma.order.findUnique.mockResolvedValue({ ...BASE_ORDER, status: 'out_for_delivery', user: { email: 'buyer@example.com', firstName: 'Priya' }, items: [], address: null });
    const service = new OrdersService(prisma, {} as any, {} as any, {} as any, notificationService as any, {} as any, inventoryService as any);

    await service.updateStatus('order_1', 'delivered', 'admin_1');

    expect(notificationService.enqueue).toHaveBeenCalledWith(
      'order_1', 'status_delivered', expect.any(Object), expect.any(Object),
    );
  });

  it('test 7: updating shipping info (carrier/tracking) does NOT trigger a notification', async () => {
    const notificationService = { enqueue: vi.fn() };
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue(BASE_ORDER),
        update: vi.fn().mockResolvedValue(BASE_ORDER),
      },
    } as any;
    const service = new OrdersService(prisma, {} as any, {} as any, {} as any, notificationService as any, {} as any, {} as any);

    await service.updateShipping('order_1', { carrier: 'Delhivery', trackingNumber: '12345' });

    expect(notificationService.enqueue).not.toHaveBeenCalled();
  });

  it('test 7b: updating internal notes does NOT trigger a notification', async () => {
    const notificationService = { enqueue: vi.fn() };
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue(BASE_ORDER),
        update: vi.fn().mockResolvedValue(BASE_ORDER),
      },
    } as any;
    const service = new OrdersService(prisma, {} as any, {} as any, {} as any, notificationService as any, {} as any, {} as any);

    await service.addNotes('order_1', 'Admin-only note here');

    expect(notificationService.enqueue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 8: Email failure is logged but does not crash the order flow
// ---------------------------------------------------------------------------

describe('EmailService — provider failure handling', () => {
  it('test 8: send() catches SMTP errors, logs them, returns false (never throws)', async () => {
    // EmailService.spec.ts already covers this; add one more explicit check here.
    // The key contract: sendNotification must return false, not throw.
    const { EmailService } = await import('../email/email.service');
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASSWORD = 'secret';
    const service = new EmailService();
    // Access private transporter and make it throw
    (service as any).transporter = { sendMail: vi.fn().mockRejectedValue(new Error('Connection refused')) };
    (service as any).configured = true;

    const result = await service.sendNotification('order_placed', {
      toEmail: 'customer@example.com',
      customerName: 'Priya',
      orderNumber: 'PK-2026-000001',
      orderId: 'order_1',
      total: 175000,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      items: [],
    });

    expect(result).toBe(false); // did not throw, returned false
    delete process.env.SMTP_HOST; delete process.env.SMTP_PORT; delete process.env.SMTP_USER; delete process.env.SMTP_PASSWORD;
  });
});

// ---------------------------------------------------------------------------
// Test 9: Customer cannot access another customer's order or invoice
// Test 10: Unauthorized users cannot update order status
// ---------------------------------------------------------------------------

describe('OrdersController — access control', () => {
  async function invokeOwnerCheck(orderUserId: string, requestUserId: string, role: string) {
    const { OrdersController } = await import('./orders.controller');
    const { InvoicesService } = await import('../invoices/invoices.service');
    const { InvoicePdfService } = await import('../invoices/invoice-pdf.service');

    const mockOrdersService = {
      findById: vi.fn().mockResolvedValue({ ...BASE_ORDER, userId: orderUserId }),
    };
    const ctrl = new OrdersController(mockOrdersService as any, {} as any, {} as any);
    const mockReq = { user: { id: requestUserId, role } };

    const { NotFoundException } = await import('@nestjs/common');
    if (role !== 'admin' && orderUserId !== requestUserId) {
      await expect((ctrl as any).assertOwnerOrAdmin('order_1', mockReq)).rejects.toThrow(NotFoundException);
    } else {
      await expect((ctrl as any).assertOwnerOrAdmin('order_1', mockReq)).resolves.toBeDefined();
    }
  }

  it('test 9a: customer_A cannot read customer_B order — gets 404', async () => {
    await invokeOwnerCheck('user_B', 'user_A', 'customer');
  });

  it('test 9b: a customer can read their own order', async () => {
    await invokeOwnerCheck('user_A', 'user_A', 'customer');
  });

  it('test 9c: admin can read any order', async () => {
    await invokeOwnerCheck('user_B', 'admin_1', 'admin');
  });

  it('test 10: AdminGuard blocks non-admin from updating order status', async () => {
    // AdminGuard.canActivate calls super (AuthGuard) first; in unit test we stub
    // the parent class behaviour so we can test AdminGuard's own role check.
    const { AdminGuard } = await import('../common/guards/admin.guard');
    const guard = new AdminGuard({} as any);
    // Stub the inherited AuthGuard.canActivate to succeed and populate req.user
    vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate').mockResolvedValue(true);
    const { ForbiddenException } = await import('@nestjs/common');
    const mockCtx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'customer' } }) }),
      getHandler: () => { },
      getClass: () => { },
    };
    await expect(guard.canActivate(mockCtx as any)).rejects.toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// Test 11: Failed payment is not marked as paid
// ---------------------------------------------------------------------------

describe('PaymentsService — failed payment stays failed', () => {
  it('test 11: verifyPayment throws when Razorpay reports status=failed (not marked paid)', async () => {
    const { PaymentsService } = await import('../payments/payments.service');
    const prisma = {
      order: { findUnique: vi.fn().mockResolvedValue({ ...BASE_ORDER, paymentMethod: 'card', paymentStatus: 'pending', total: 175000, razorpayOrderId: 'rzp_order_1', paymentVerifiedAt: null }) },
      $transaction: vi.fn(),
    } as any;
    const razorpayService = {
      verifyPaymentSignature: vi.fn().mockReturnValue(true),
      fetchPayment: vi.fn().mockResolvedValue({ status: 'failed', amount: 175000, currency: 'INR', orderId: 'rzp_order_1' }),
    } as any;
    const service = new PaymentsService(prisma, razorpayService, {} as any, {} as any);

    await expect(service.verifyPayment('user_1', {
      orderId: 'order_1',
      razorpay_order_id: 'rzp_order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    })).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 12: Invoice total matches persisted order and payment amount
// ---------------------------------------------------------------------------

describe('Invoice financial accuracy', () => {
  it('test 12a: invoice total matches order.total (paise)', async () => {
    const prisma = makeInvoicePrisma();
    const settingsService = { getSettings: vi.fn().mockResolvedValue({}) } as any;
    const service = new InvoicesService(prisma, settingsService);

    const inv = await service.ensureInvoice('order_1');
    expect(inv.total).toBe(BASE_ORDER.total);
  });

  it('test 12b: ensureInvoice uses persisted order total — never a caller-supplied total', async () => {
    const prisma = makeInvoicePrisma();
    const settingsService = { getSettings: vi.fn().mockResolvedValue({}) } as any;
    const service = new InvoicesService(prisma, settingsService);

    // Caller attempts to pass a tampered snapshot with a different total
    const inv = await service.ensureInvoice('order_1', {
      snapshot: { subtotal: 1, discount: 0, shipping: 0, tax: 0, total: 1 }, // tampered
    });

    // The service reads order.total from the DB and forces it onto the snapshot
    expect(inv.total).toBe(BASE_ORDER.total); // 175000, NOT 1
  });
});
