import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('reports not configured when SMTP env vars are absent', () => {
    const service = new EmailService();
    expect(service.isConfigured()).toBe(false);
  });

  it('never throws when sending with no provider configured - it just skips', async () => {
    const service = new EmailService();
    const baseOrder = {
      toEmail: 'customer@example.com',
      customerName: 'Priya',
      orderNumber: 'PK-2026-000001',
      orderId: 'order_1',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      total: 50000,
      items: [],
    };

    await expect(service.sendCodOrderPlacedEmail(baseOrder)).resolves.toBe(false);
    await expect(service.sendPaymentConfirmationEmail(baseOrder)).resolves.toBe(false);
    await expect(service.sendPaymentFailedEmail(baseOrder)).resolves.toBe(false);
  });

  it('skips sending (and does not throw) for an invalid recipient address, even if a provider were configured', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASSWORD = 'irrelevant-for-this-test';

    const service = new EmailService();
    const result = await service.sendCodOrderPlacedEmail({
      toEmail: 'not-an-email',
      customerName: 'Priya',
      orderNumber: 'PK-2026-000001',
      orderId: 'order_1',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      total: 50000,
      items: [],
    });

    expect(result).toBe(false);
  });

  it('is configured once all four SMTP env vars are present', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASSWORD = 'irrelevant-for-this-test';

    const service = new EmailService();
    expect(service.isConfigured()).toBe(true);
  });
});
