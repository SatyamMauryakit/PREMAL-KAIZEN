import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

export interface RazorpayOrderResult {
  id: string;
  amount: number; // paise, as confirmed by Razorpay
  currency: string;
}

/**
 * Thin wrapper around the official Razorpay Node SDK plus the signature-verification
 * logic Razorpay's docs prescribe for both the client-side checkout callback and
 * server-side webhooks (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/
 * and https://razorpay.com/docs/webhooks/validate-test/).
 *
 * RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET are read from env.
 * The secret is NEVER sent to the frontend, logged, or returned from any API response -
 * only the key_id (Razorpay's public identifier, safe to expose) is ever surfaced to
 * the client, exactly as Razorpay's own integration guide does.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private client: Razorpay | null = null;

  private get keyId(): string | undefined {
    return process.env.RAZORPAY_KEY_ID;
  }

  private get keySecret(): string | undefined {
    return process.env.RAZORPAY_KEY_SECRET;
  }

  private get webhookSecret(): string | undefined {
    return process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  isConfigured(): boolean {
    return !!this.keyId && !!this.keySecret;
  }

  isWebhookConfigured(): boolean {
    return !!this.webhookSecret;
  }

  /** The publishable key only - safe to send to the frontend for Checkout.js. */
  getPublicKeyId(): string | null {
    return this.keyId || null;
  }

  private getClient(): Razorpay {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)');
    }
    if (!this.client) {
      this.client = new Razorpay({ key_id: this.keyId as string, key_secret: this.keySecret as string });
    }
    return this.client;
  }

  /**
   * Creates a Razorpay order for a server-calculated amount. The amount/currency here
   * must already be the trusted, server-recomputed total - never a client-supplied value.
   */
  async createOrder(amountInPaise: number, currency: string, receipt: string): Promise<RazorpayOrderResult> {
    const client = this.getClient();
    const order = await client.orders.create({
      amount: amountInPaise,
      currency,
      receipt,
      payment_capture: true,
    });
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  }

  /**
   * Fetches the payment directly from Razorpay as a second, independent check of
   * amount/currency/status - defense in depth beyond signature verification alone,
   * so a valid signature on a tampered amount can never slip through.
   */
  async fetchPayment(paymentId: string): Promise<{ status: string; amount: number; currency: string; orderId: string }> {
    const client = this.getClient();
    const payment = await client.payments.fetch(paymentId);
    return {
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      orderId: payment.order_id || '',
    };
  }

  /**
   * Verifies the signature Razorpay Checkout returns to the browser after payment
   * (razorpay_order_id + razorpay_payment_id + razorpay_signature). This is the
   * server-side proof required before an order can be marked paid - the browser's
   * "success" callback alone is never trusted.
   */
  verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): boolean {
    if (!this.keySecret) {
      this.logger.warn('Cannot verify payment signature - RAZORPAY_KEY_SECRET not configured');
      return false;
    }
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    return this.timingSafeEqual(expected, razorpaySignature);
  }

  /**
   * Verifies a webhook delivery's signature against the RAW request body, as required
   * by Razorpay (signature is computed over the exact raw bytes, not a re-serialized
   * JSON object which can differ in whitespace/key order).
   */
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Cannot verify webhook signature - RAZORPAY_WEBHOOK_SECRET not configured');
      return false;
    }
    if (!signatureHeader) return false;
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return this.timingSafeEqual(expected, signatureHeader);
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
