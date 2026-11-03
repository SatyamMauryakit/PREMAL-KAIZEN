import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import { RazorpayService } from './razorpay.service';

describe('RazorpayService', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('isConfigured / isWebhookConfigured', () => {
    it('reports not configured when env vars are missing', () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const service = new RazorpayService();
      expect(service.isConfigured()).toBe(false);
      expect(service.isWebhookConfigured()).toBe(false);
      expect(service.getPublicKeyId()).toBeNull();
    });

    it('reports configured when both key id and secret are set', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_abc123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_abc123';
      const service = new RazorpayService();
      expect(service.isConfigured()).toBe(true);
      expect(service.getPublicKeyId()).toBe('rzp_test_abc123');
    });

    it('never exposes the key secret via getPublicKeyId', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_abc123';
      process.env.RAZORPAY_KEY_SECRET = 'super_secret_value';
      const service = new RazorpayService();
      expect(service.getPublicKeyId()).not.toContain('super_secret_value');
    });
  });

  describe('verifyPaymentSignature', () => {
    beforeEach(() => {
      process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
    });

    it('accepts a correctly computed signature', () => {
      const service = new RazorpayService();
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const validSignature = crypto
        .createHmac('sha256', 'test_key_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      expect(service.verifyPaymentSignature(orderId, paymentId, validSignature)).toBe(true);
    });

    it('rejects a signature computed with the wrong secret', () => {
      const service = new RazorpayService();
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const wrongSignature = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      expect(service.verifyPaymentSignature(orderId, paymentId, wrongSignature)).toBe(false);
    });

    it('rejects a signature for a tampered order/payment id pair', () => {
      const service = new RazorpayService();
      const validSignature = crypto
        .createHmac('sha256', 'test_key_secret')
        .update('order_ABC123|pay_XYZ789')
        .digest('hex');

      // Attacker reuses a valid signature against a different order id
      expect(service.verifyPaymentSignature('order_DIFFERENT', 'pay_XYZ789', validSignature)).toBe(false);
    });

    it('rejects garbage/malformed signatures without throwing', () => {
      const service = new RazorpayService();
      expect(service.verifyPaymentSignature('order_ABC123', 'pay_XYZ789', 'not-a-real-signature')).toBe(false);
      expect(service.verifyPaymentSignature('order_ABC123', 'pay_XYZ789', '')).toBe(false);
    });

    it('returns false (not throws) when the secret is not configured', () => {
      delete process.env.RAZORPAY_KEY_SECRET;
      const service = new RazorpayService();
      expect(service.verifyPaymentSignature('order_ABC123', 'pay_XYZ789', 'anything')).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    beforeEach(() => {
      process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
    });

    it('accepts a signature computed over the exact raw body', () => {
      const service = new RazorpayService();
      const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
      const validSignature = crypto.createHmac('sha256', 'test_webhook_secret').update(rawBody).digest('hex');

      expect(service.verifyWebhookSignature(rawBody, validSignature)).toBe(true);
    });

    it('rejects when the raw body has been altered after signing', () => {
      const service = new RazorpayService();
      const originalBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { amount: 100 } }));
      const signature = crypto.createHmac('sha256', 'test_webhook_secret').update(originalBody).digest('hex');
      const tamperedBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { amount: 999999 } }));

      expect(service.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
    });

    it('rejects a missing signature header', () => {
      const service = new RazorpayService();
      const rawBody = Buffer.from('{}');
      expect(service.verifyWebhookSignature(rawBody, undefined)).toBe(false);
    });

    it('returns false (not throws) when the webhook secret is not configured', () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const service = new RazorpayService();
      expect(service.verifyWebhookSignature(Buffer.from('{}'), 'anything')).toBe(false);
    });
  });
});
