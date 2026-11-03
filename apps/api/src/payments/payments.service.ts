import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from './razorpay.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
    private emailService: EmailService,
  ) {}

  /**
   * Verifies a Razorpay Checkout success callback. This is the fast path for
   * immediate UI feedback right after payment - the webhook (handleWebhook below)
   * is the authoritative, asynchronous confirmation that doesn't depend on the
   * customer's browser staying open. Both converge on the same idempotent update.
   */
  async verifyPayment(
    userId: string,
    data: { orderId?: string; razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string },
  ) {
    if (!data.orderId || !data.razorpay_order_id || !data.razorpay_payment_id || !data.razorpay_signature) {
      throw new BadRequestException('orderId, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required');
    }

    const order = await this.prisma.order.findUnique({ where: { id: data.orderId } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentVerifiedAt) {
      // Already verified (e.g. webhook beat the browser callback, or this was called
      // twice) - idempotent no-op, never re-verify or re-send the email.
      return { success: true, alreadyVerified: true, orderId: order.id, orderNumber: order.orderNumber };
    }

    if (order.razorpayOrderId !== data.razorpay_order_id) {
      throw new BadRequestException('This payment does not match the order on record');
    }

    const signatureValid = this.razorpayService.verifyPaymentSignature(
      data.razorpay_order_id,
      data.razorpay_payment_id,
      data.razorpay_signature,
    );
    if (!signatureValid) {
      throw new BadRequestException('Payment verification failed - signature mismatch');
    }

    // Defense in depth: never trust the signature alone. Independently fetch the
    // payment from Razorpay and cross-check amount/currency/status match our records.
    const payment = await this.razorpayService.fetchPayment(data.razorpay_payment_id);

    if (payment.orderId !== data.razorpay_order_id) {
      throw new BadRequestException('Payment does not belong to the referenced Razorpay order');
    }
    if (payment.amount !== order.total) {
      this.logger.error(`Amount mismatch for order ${order.id}: expected ${order.total}, Razorpay reports ${payment.amount}`);
      throw new BadRequestException('Payment amount does not match the order total');
    }
    if (payment.currency !== 'INR') {
      throw new BadRequestException('Unexpected payment currency');
    }
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      throw new BadRequestException(`Payment is not yet completed (status: ${payment.status})`);
    }

    // Conditional update: only the first caller to reach here with paymentVerifiedAt
    // still null wins - guards against a race between this call and a concurrent webhook.
    const result = await this.prisma.order.updateMany({
      where: { id: order.id, paymentVerifiedAt: null },
      data: {
        paymentStatus: 'completed',
        razorpayPaymentId: data.razorpay_payment_id,
        razorpaySignature: data.razorpay_signature,
        paymentVerifiedAt: new Date(),
      },
    });

    if (result.count > 0) {
      await this.sendPaymentConfirmationEmailOnce(order.id);
    }

    return { success: true, orderId: order.id, orderNumber: order.orderNumber };
  }

  /**
   * Handles a Razorpay webhook delivery. `rawBody` must be the exact raw request
   * bytes (signature is computed over raw bytes, not a re-serialized object).
   * Idempotent: a retried/duplicate delivery of the same event is detected via
   * PaymentWebhookEvent's unique (provider, eventId) constraint and skipped.
   */
  async handleWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
    if (!this.razorpayService.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed webhook payload');
    }

    const eventType: string = payload.event || 'unknown';
    const paymentEntity = payload.payload?.payment?.entity;
    // Razorpay re-delivers the identical payload on retry, so (eventType + payment id)
    // is a stable dedupe key across retries of the same event.
    const eventId: string = paymentEntity?.id ? `${eventType}:${paymentEntity.id}` : `${eventType}:${payload.created_at || Date.now()}`;

    const alreadyProcessed = await this.prisma.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider: 'razorpay', eventId } },
    });
    if (alreadyProcessed) {
      return { status: 'duplicate_ignored' };
    }

    if (!paymentEntity) {
      await this.prisma.paymentWebhookEvent.create({ data: { provider: 'razorpay', eventId, eventType, orderId: null } });
      return { status: 'ignored_unhandled_event_type' };
    }

    const razorpayOrderId: string | undefined = paymentEntity.order_id;
    const order = razorpayOrderId ? await this.prisma.order.findUnique({ where: { razorpayOrderId } }) : null;

    await this.prisma.paymentWebhookEvent.create({
      data: { provider: 'razorpay', eventId, eventType, orderId: order?.id || null },
    });

    if (!order) {
      this.logger.warn(`Webhook ${eventType} references unknown razorpayOrderId=${razorpayOrderId}`);
      return { status: 'order_not_found' };
    }

    if (eventType === 'payment.captured') {
      if (!order.paymentVerifiedAt) {
        const amountMatches = Number(paymentEntity.amount) === order.total;
        const currencyMatches = paymentEntity.currency === 'INR';
        if (amountMatches && currencyMatches) {
          const result = await this.prisma.order.updateMany({
            where: { id: order.id, paymentVerifiedAt: null },
            data: {
              paymentStatus: 'completed',
              razorpayPaymentId: paymentEntity.id,
              paymentVerifiedAt: new Date(),
            },
          });
          if (result.count > 0) {
            await this.sendPaymentConfirmationEmailOnce(order.id);
          }
        } else {
          this.logger.error(
            `Webhook amount/currency mismatch for order ${order.id}: expected ${order.total} INR, got ${paymentEntity.amount} ${paymentEntity.currency}`,
          );
        }
      }
    } else if (eventType === 'payment.failed') {
      if (order.paymentStatus === 'pending') {
        await this.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'failed' } });
        await this.sendPaymentFailedEmailOnce(order.id);
      }
    }

    return { status: 'processed' };
  }

  private async loadOrderForEmail(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, user: true, address: true },
    });
  }

  private async sendPaymentConfirmationEmailOnce(orderId: string): Promise<void> {
    const order = await this.loadOrderForEmail(orderId);
    if (!order || order.paymentEmailSentAt) return;

    const sent = await this.emailService.sendPaymentConfirmationEmail({
      toEmail: order.user.email,
      customerName: order.user.firstName || order.user.email,
      orderNumber: order.orderNumber,
      orderId: order.id,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
      items: order.items.map((i) => ({
        name: i.product?.name || 'Product',
        quantity: i.quantity,
        price: i.price,
        selectedSize: i.selectedSize,
        selectedColor: i.selectedColor,
      })),
      shippingSummary: order.address ? `${order.address.city}, ${order.address.state} ${order.address.postalCode}` : undefined,
    });

    if (sent) {
      await this.prisma.order.update({ where: { id: order.id }, data: { paymentEmailSentAt: new Date() } });
    }
  }

  private async sendPaymentFailedEmailOnce(orderId: string): Promise<void> {
    const order = await this.loadOrderForEmail(orderId);
    if (!order || order.paymentFailedEmailSentAt) return;

    const sent = await this.emailService.sendPaymentFailedEmail({
      toEmail: order.user.email,
      customerName: order.user.firstName || order.user.email,
      orderNumber: order.orderNumber,
      orderId: order.id,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
      items: [],
    });

    if (sent) {
      await this.prisma.order.update({ where: { id: order.id }, data: { paymentFailedEmailSentAt: new Date() } });
    }
  }
}
