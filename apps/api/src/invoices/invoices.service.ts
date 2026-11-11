import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Invoice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

/**
 * A subset of the Prisma client usable inside `prisma.$transaction(cb)` — i.e. a
 * transaction client. Both `PrismaService` and a tx client expose the same model
 * delegates, so invoice creation can run inside an outer order/payment transaction.
 */
export type TxClient = Prisma.TransactionClient;

/** Financial snapshot stored on the invoice. All values are in paise. */
export interface InvoiceSnapshot {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface InvoiceLineItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number; // paise
  lineTotal: number; // paise (unitPrice * quantity)
  selectedSize?: string | null;
  selectedColor?: string | null;
  imageUrl?: string | null; // local path (served from /uploads/) or null
}

/**
 * Everything the invoice PDF / HTML view needs, assembled from the persisted order
 * snapshot. Amounts are all in paise; the renderer converts to display rupees. The
 * business details come from StoreSettings (never invented here).
 */
export interface InvoiceRenderData {
  invoiceNumber: string;
  invoiceDate: string; // ISO
  orderNumber: string;
  orderId: string;
  currency: string;
  placedAt: string; // ISO

  business: {
    storeName: string;
    storeEmail: string;
    storePhone: string;
    businessAddress: string;
    gstin: string;
  };

  customer: {
    name: string;
    email: string;
    phone: string;
  };

  shippingAddress: {
    firstName: string;
    lastName: string;
    street1: string;
    street2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phoneNumber: string;
  } | null;

  items: InvoiceLineItem[];

  // All in paise
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxRate: number;
  total: number;

  paymentMethod: string;
  paymentStatus: string;
  razorpayPaymentId?: string | null;
  couponCode?: string | null;
}

/**
 * Generates and stores invoices for orders.
 *
 * An invoice is created exactly once per order — `Invoice.orderId` is `@unique`, so
 * `ensureInvoice` is idempotent: retries, duplicate webhooks, and concurrent calls all
 * resolve to the same single row. Invoices are only issued for orders that are actually
 * paid or are Cash-on-Delivery (payment due on delivery); an unpaid/failed online order
 * never gets an invoice, matching the existing payment flow.
 *
 * The financial fields are copied from the persisted order, whose totals are frozen at
 * creation time (OrderItem.price is the price-at-time-of-order and the order's
 * subtotal/discount/shipping/tax/total are never mutated later). The invoice total is
 * therefore always equal to the persisted order total and to the amount actually charged.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) { }

  /**
   * Returns the order's invoice, creating it idempotently if it does not yet exist.
   * Safe to call inside an outer `prisma.$transaction` by passing `tx`; when called
   * inside a transaction, reads/writes use that tx so an order created earlier in the
   * same transaction is visible.
   *
   * @param snapshot optional authoritative totals; when omitted, the persisted order's
   *   totals are used. Always reconciled against the persisted order.total.
   */
  async ensureInvoice(
    orderId: string,
    opts?: { tx?: TxClient; snapshot?: InvoiceSnapshot },
  ): Promise<Invoice> {
    const db = opts?.tx ?? this.prisma;

    const existing = await db.invoice.findUnique({ where: { orderId } });
    if (existing) return existing;

    // Minimal read — we only need timestamps + invoiceability + authoritative totals.
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        createdAt: true,
        paymentMethod: true,
        paymentStatus: true,
        subtotal: true,
        discount: true,
        shipping: true,
        tax: true,
        total: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Only invoice orders that are actually paid, or COD (payment due on delivery).
    // An unpaid/failed online order must never receive an invoice.
    const invoiceable = order.paymentMethod === 'cod' || order.paymentStatus === 'completed';
    if (!invoiceable) {
      throw new BadRequestException('Invoice is not available until payment is confirmed');
    }

    // The persisted order is the source of truth for totals. A caller-supplied snapshot
    // is reconciled against it so the invoice total can never drift from order.total.
    const snapshot: InvoiceSnapshot = opts?.snapshot
      ? { ...opts.snapshot, total: order.total, subtotal: order.subtotal, discount: order.discount, shipping: order.shipping, tax: order.tax }
      : { subtotal: order.subtotal, discount: order.discount, shipping: order.shipping, tax: order.tax, total: order.total };

    const year = new Date(order.createdAt).getFullYear();

    // Sequential invoice number per year with collision retry. The @unique constraint
    // on invoiceNumber is the last line of defense; in single-writer SQLite the count is
    // already sufficient, but the loop handles any race or deletion gap.
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await db.invoice.count({ where: { invoiceNumber: { startsWith: `PK-INV-${year}-` } } });
      const seq = (count + 1 + attempt).toString().padStart(6, '0');
      const invoiceNumber = `PK-INV-${year}-${seq}`;
      try {
        const created = await db.invoice.create({
          data: {
            invoiceNumber,
            orderId,
            subtotal: snapshot.subtotal,
            discount: snapshot.discount,
            shipping: snapshot.shipping,
            tax: snapshot.tax,
            total: snapshot.total,
            currency: 'INR',
          },
        });
        this.logger.log(`Created invoice ${created.invoiceNumber} for order ${orderId}`);
        return created;
      } catch (e: any) {
        if (e?.code === 'P2002') {
          // Unique violation: either an invoice for this order now exists (concurrent
          // caller won) or the generated number collided. Re-check by orderId first.
          const existingNow = await db.invoice.findUnique({ where: { orderId } });
          if (existingNow) return existingNow;
          // Otherwise it was an invoiceNumber collision — loop with the next sequence.
          continue;
        }
        throw e;
      }
    }

    throw new Error('Failed to generate a unique invoice number after retries');
  }

  /**
   * Concise invoice metadata for an order (used by the storefront/admin invoice
   * view and download link). Creates the invoice idempotently if the order is
   * invoiceable; throws if the order cannot be invoiced yet.
   */
  async getInvoiceSummary(orderId: string): Promise<{
    invoiceNumber: string;
    invoiceDate: string;
    currency: string;
    orderNumber: string;
    orderId: string;
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
    paymentMethod: string;
    paymentStatus: string;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, subtotal: true, discount: true, shipping: true, tax: true, total: true, paymentMethod: true, paymentStatus: true, invoice: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    const invoice = order.invoice ?? (await this.ensureInvoice(orderId));
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.createdAt.toISOString(),
      currency: invoice.currency,
      orderNumber: order.orderNumber,
      orderId,
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      tax: order.tax,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    };
  }

  /**
   * Assembles the full invoice render data for an order, creating the invoice
   * idempotently if the order is invoiceable. Throws if the order cannot be invoiced.
   */
  async getInvoiceData(orderId: string): Promise<InvoiceRenderData> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { include: { images: { take: 1, orderBy: { order: 'asc' } } } } } }, address: true, user: true, invoice: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const invoice =
      order.invoice ?? (await this.ensureInvoice(orderId));

    const settings = await this.settingsService.getSettings();

    const items: InvoiceLineItem[] = order.items.map((i) => ({
      name: i.product?.name ?? 'Product',
      sku: i.product?.sku ?? '',
      quantity: i.quantity,
      unitPrice: i.price,
      lineTotal: i.price * i.quantity,
      selectedSize: i.selectedSize,
      selectedColor: i.selectedColor,
      // imageUrl: first product image URL (may be an absolute http URL from the API
      // uploads route, or null). The PDF renderer resolves it to a local file path.
      imageUrl: (i.product as any)?.images?.[0]?.url ?? null,
    }));

    const fullName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ').trim() || order.user?.email || 'Customer';

    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.createdAt.toISOString(),
      orderNumber: order.orderNumber,
      orderId: order.id,
      currency: invoice.currency,
      placedAt: order.createdAt.toISOString(),
      business: {
        storeName: settings.storeName || 'PREMAL KAIZEN',
        storeEmail: settings.storeEmail || '',
        storePhone: settings.storePhone || '',
        businessAddress: settings.businessAddress || '',
        gstin: settings.gstin || '',
      },
      customer: {
        name: fullName,
        email: order.user?.email ?? '',
        phone: order.user?.phoneNumber ?? order.address?.phoneNumber ?? '',
      },
      shippingAddress: order.address
        ? {
          firstName: order.address.firstName,
          lastName: order.address.lastName,
          street1: order.address.street1,
          street2: order.address.street2,
          landmark: order.address.landmark,
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
          country: order.address.country,
          phoneNumber: order.address.phoneNumber,
        }
        : null,
      items,
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      tax: order.tax,
      cgst: order.cgst,
      sgst: order.sgst,
      igst: order.igst,
      taxRate: order.taxRate,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      razorpayPaymentId: order.razorpayPaymentId ?? null,
      couponCode: order.couponCode ?? null,
    };
  }
}
