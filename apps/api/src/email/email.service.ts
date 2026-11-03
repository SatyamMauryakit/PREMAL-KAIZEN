import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: number; // paise
  selectedSize?: string | null;
  selectedColor?: string | null;
}

export interface OrderEmailData {
  toEmail: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number; // paise
  currency?: string;
  items: OrderEmailItem[];
  shippingSummary?: string;
}

/**
 * Sends transactional order/payment emails via SMTP.
 *
 * No transactional email provider was configured anywhere in this project before this
 * change (no SMTP/SendGrid/Resend env vars, no mail library). This service reads SMTP
 * config from environment variables; if they are not set, it logs clearly and returns
 * without throwing, so missing email config never blocks an order or payment from
 * completing. It never prints the SMTP password or any secret value.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;
  private readonly storefrontUrl: string;
  private configChecked = false;
  private configured = false;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM || 'no-reply@premalkaizen.com';
    this.storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL || process.env.APP_URL || 'http://localhost:3000';
  }

  isConfigured(): boolean {
    this.ensureTransporter();
    return this.configured;
  }

  private ensureTransporter(): void {
    if (this.configChecked) return;
    this.configChecked = true;

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    if (!host || !port || !user || !pass) {
      this.logger.warn(
        'Email provider not configured (missing SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD). ' +
          'Transactional emails will be skipped until these are set.',
      );
      this.configured = false;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: { user, pass },
    });
    this.configured = true;
  }

  /**
   * Low-level send, never throws - a provider outage or misconfiguration must never
   * block order/payment processing. Returns whether the send actually happened.
   */
  private async send(to: string, subject: string, html: string, text: string): Promise<boolean> {
    this.ensureTransporter();

    if (!this.configured || !this.transporter) {
      this.logger.log(`[email skipped - not configured] to=${this.maskEmail(to)} subject="${subject}"`);
      return false;
    }

    if (!this.isValidEmail(to)) {
      this.logger.warn(`[email skipped - invalid address] to=${this.maskEmail(to)} subject="${subject}"`);
      return false;
    }

    try {
      await this.transporter.sendMail({ from: this.fromAddress, to, subject, html, text });
      this.logger.log(`[email sent] to=${this.maskEmail(to)} subject="${subject}"`);
      return true;
    } catch (err) {
      // Never log the SMTP credentials themselves - only the failure.
      this.logger.error(`[email failed] to=${this.maskEmail(to)} subject="${subject}": ${(err as Error).message}`);
      return false;
    }
  }

  async sendCodOrderPlacedEmail(data: OrderEmailData): Promise<boolean> {
    const subject = `Order Confirmed - ${data.orderNumber}`;
    const itemsHtml = this.renderItemsHtml(data.items);
    const html = `
      <p>Hi ${this.escape(data.customerName)},</p>
      <p>Your order <strong>${this.escape(data.orderNumber)}</strong> has been placed successfully.</p>
      <p><strong>Payment is due on delivery (Cash on Delivery).</strong> No payment has been collected online.</p>
      ${itemsHtml}
      <p><strong>Total payable on delivery:</strong> ${this.formatAmount(data.total, data.currency)}</p>
      ${data.shippingSummary ? `<p><strong>Shipping:</strong> ${this.escape(data.shippingSummary)}</p>` : ''}
      <p><a href="${this.storefrontUrl}/account/orders/${data.orderId}">View your order</a></p>
    `;
    const text = `Your order ${data.orderNumber} has been placed. Payment is due on delivery (COD). Total payable: ${this.formatAmount(data.total, data.currency)}.`;
    return this.send(data.toEmail, subject, html, text);
  }

  async sendPaymentConfirmationEmail(data: OrderEmailData): Promise<boolean> {
    const subject = `Payment Received - Order ${data.orderNumber}`;
    const itemsHtml = this.renderItemsHtml(data.items);
    const html = `
      <p>Hi ${this.escape(data.customerName)},</p>
      <p>We've received your payment for order <strong>${this.escape(data.orderNumber)}</strong>.</p>
      <p><strong>Payment status:</strong> ${this.escape(data.paymentStatus)}</p>
      <p><strong>Payment method:</strong> ${this.escape(data.paymentMethod)}</p>
      <p><strong>Amount paid:</strong> ${this.formatAmount(data.total, data.currency)}</p>
      ${itemsHtml}
      ${data.shippingSummary ? `<p><strong>Shipping:</strong> ${this.escape(data.shippingSummary)}</p>` : ''}
      <p><a href="${this.storefrontUrl}/account/orders/${data.orderId}">View your order</a></p>
    `;
    const text = `Payment received for order ${data.orderNumber}. Amount: ${this.formatAmount(data.total, data.currency)}.`;
    return this.send(data.toEmail, subject, html, text);
  }

  async sendPaymentFailedEmail(data: OrderEmailData): Promise<boolean> {
    const subject = `Payment Not Completed - Order ${data.orderNumber}`;
    const html = `
      <p>Hi ${this.escape(data.customerName)},</p>
      <p>Your payment for order <strong>${this.escape(data.orderNumber)}</strong> could not be completed (status: ${this.escape(data.paymentStatus)}).</p>
      <p>No amount has been charged for this attempt. You can try again from your order history, or choose Cash on Delivery if available.</p>
      <p><a href="${this.storefrontUrl}/account/orders/${data.orderId}">View your order</a></p>
    `;
    const text = `Your payment for order ${data.orderNumber} did not complete (status: ${data.paymentStatus}). No amount was charged.`;
    return this.send(data.toEmail, subject, html, text);
  }

  private renderItemsHtml(items: OrderEmailItem[]): string {
    if (!items || items.length === 0) return '';
    const rows = items
      .map(
        (i) =>
          `<tr><td>${this.escape(i.name)}${i.selectedSize ? ` (${this.escape(i.selectedSize)})` : ''}</td><td>x${i.quantity}</td><td>${this.formatAmount(i.price * i.quantity)}</td></tr>`,
      )
      .join('');
    return `<table cellpadding="4" style="border-collapse:collapse;width:100%"><tbody>${rows}</tbody></table>`;
  }

  private formatAmount(paise: number, currency = 'INR'): string {
    if (currency !== 'INR') return `${(paise / 100).toFixed(2)} ${currency}`;
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!domain) return '***';
    return `${user.slice(0, 2)}***@${domain}`;
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  }
}
