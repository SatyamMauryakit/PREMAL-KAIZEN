import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { NotificationPayload } from '../notifications/notification.types';
import {
  emailShell, section, divider, greeting, heroText, ctaButton,
  infoBox, otpBox, statusBadge, infoRow, infoTable,
  orderItemsTable, orderTotalsTable, addressBlock,
  esc, fmtPaise,
  TemplateOrderItem, TemplateTotals, TemplateAddress,
} from './email-templates';

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

export interface ContactEnquiryEmailData {
  name: string;
  email: string;
  subject: string;
  category: string;
  orderNumber?: string | null;
  message: string;
}

/**
 * Sends all transactional emails via SMTP.
 *
 * Uses premium table-based HTML templates (email-templates.ts) that are
 * compatible with Gmail, Outlook, Apple Mail and mobile clients. Every send is
 * non-throwing — a provider outage never blocks an order or payment. Credentials
 * are never logged.
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 * Optional:
 *   EMAIL_FROM            — from address (default premal.kaizen@gmail.com)
 *   APP_BASE_URL          — storefront URL for email links (default http://localhost:3000)
 *   CONTACT_NOTIFICATION_EMAIL — owner inbox for contact-form notifications
 *   INSTAGRAM_URL         — brand Instagram URL shown in footer
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;
  private readonly storefrontUrl: string;
  private readonly instagramUrl: string | undefined;
  private readonly contactNotificationEmail: string | undefined;
  private configChecked = false;
  private configured = false;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM || 'premal.kaizen@gmail.com';
    this.storefrontUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_STOREFRONT_URL || process.env.APP_URL || 'http://localhost:3000';
    this.instagramUrl = process.env.INSTAGRAM_URL || undefined;
    this.contactNotificationEmail = process.env.CONTACT_NOTIFICATION_EMAIL || undefined;
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

  // =========================================================================
  // Low-level send — never throws
  // =========================================================================

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
    attachments?: Array<{ filename: string; content: Buffer | string }>,
  ): Promise<boolean> {
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
      await this.transporter.sendMail({ from: this.fromAddress, to, subject, html, text, attachments });
      this.logger.log(`[email sent] to=${this.maskEmail(to)} subject="${subject}"${attachments?.length ? ` (${attachments.length} attachment(s))` : ''}`);
      return true;
    } catch (err) {
      this.logger.error(`[email failed] to=${this.maskEmail(to)} subject="${subject}": ${(err as Error).message}`);
      return false;
    }
  }

  // =========================================================================
  // Welcome / registration email
  // =========================================================================

  async sendWelcomeEmail(data: { toEmail: string; customerName: string }): Promise<boolean> {
    const subject = `Welcome to PREMAL KAIZEN, ${data.customerName}! 🎉`;
    const html = emailShell(
      section(`
        ${heroText('Welcome to the Family!', '🎉')}
        ${greeting(data.customerName)}
        <p style="margin:0 0 16px;color:#555555;">
          Your account has been created. We're excited to have you as part of the PREMAL KAIZEN community —
          premium minimalist streetwear crafted for the modern explorer.
        </p>
        ${infoBox(`<strong>What's next?</strong><br>Browse our latest collection and find your style.`, 'neutral')}
        ${ctaButton('Explore the Collection', `${this.storefrontUrl}/shop`)}
        <p style="margin:24px 0 0;font-size:13px;color:#999999;text-align:center;">
          If you didn't create this account, you can safely ignore this email.
        </p>
      `),
      this.storefrontUrl,
      this.instagramUrl,
    );
    const text = `Welcome to PREMAL KAIZEN, ${data.customerName}! Your account is ready. Visit ${this.storefrontUrl}/shop to start exploring.`;
    return this.send(data.toEmail, subject, html, text);
  }

  // =========================================================================
  // Email OTP verification
  // =========================================================================

  async sendEmailOtpEmail(data: { toEmail: string; customerName: string; otp: string; expiryMinutes: number }): Promise<boolean> {
    const subject = `Your PREMAL KAIZEN verification code: ${data.otp}`;
    const html = emailShell(
      section(`
        ${heroText('Verify Your Email Address', '✉️')}
        ${greeting(data.customerName)}
        <p style="margin:0 0 8px;color:#555555;">
          Use the code below to verify your email address. It expires in <strong>${data.expiryMinutes} minutes</strong>.
        </p>
        ${otpBox(data.otp)}
        ${infoBox(`<strong>Didn't request this?</strong> You can safely ignore this email — your account is not affected.`, 'yellow')}
        <p style="margin:16px 0 0;font-size:13px;color:#999999;text-align:center;">
          For security, never share this code with anyone.
        </p>
      `),
      this.storefrontUrl,
      this.instagramUrl,
    );
    const text = `Your PREMAL KAIZEN email verification code is: ${data.otp}\nThis code expires in ${data.expiryMinutes} minutes. Do not share it with anyone.`;
    return this.send(data.toEmail, subject, html, text);
  }

  // =========================================================================
  // Password reset email
  // =========================================================================

  async sendPasswordResetEmail(data: { toEmail: string; customerName: string; resetUrl: string }): Promise<boolean> {
    const subject = 'Reset your PREMAL KAIZEN password';
    const html = emailShell(
      section(`
        ${heroText('Password Reset Request', '🔑')}
        ${greeting(data.customerName)}
        <p style="margin:0 0 16px;color:#555555;">
          We received a request to reset your password. Click the button below to set a new one.
          This link is valid for <strong>24 hours</strong>.
        </p>
        ${ctaButton('Reset My Password', data.resetUrl)}
        ${infoBox(`<strong>Didn't request a reset?</strong> Ignore this email — your password remains unchanged.`, 'yellow')}
        <p style="margin:16px 0 0;font-size:13px;color:#999999;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${esc(data.resetUrl)}" style="color:#555555;word-break:break-all;">${esc(data.resetUrl)}</a>
        </p>
      `),
      this.storefrontUrl,
      this.instagramUrl,
    );
    const text = `Reset your PREMAL KAIZEN password by visiting: ${data.resetUrl}\nThis link expires in 24 hours. If you didn't request a reset, ignore this email.`;
    return this.send(data.toEmail, subject, html, text);
  }

  // =========================================================================
  // Order confirmation (COD) — kept for backward-compatibility
  // =========================================================================

  async sendCodOrderPlacedEmail(data: OrderEmailData): Promise<boolean> {
    return this.sendNotification('order_placed', {
      toEmail: data.toEmail,
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      orderId: data.orderId,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      total: data.total,
      items: data.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, selectedSize: i.selectedSize, selectedColor: i.selectedColor })),
      shippingSummary: data.shippingSummary,
    });
  }

  // =========================================================================
  // Payment confirmation — kept for backward-compatibility
  // =========================================================================

  async sendPaymentConfirmationEmail(data: OrderEmailData): Promise<boolean> {
    return this.sendNotification('payment_captured', {
      toEmail: data.toEmail,
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      orderId: data.orderId,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      total: data.total,
      items: data.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, selectedSize: i.selectedSize, selectedColor: i.selectedColor })),
      shippingSummary: data.shippingSummary,
    });
  }

  // =========================================================================
  // Payment failed — kept for backward-compatibility
  // =========================================================================

  async sendPaymentFailedEmail(data: OrderEmailData): Promise<boolean> {
    return this.sendNotification('payment_failed', {
      toEmail: data.toEmail,
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      orderId: data.orderId,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      total: data.total,
      items: [],
    });
  }

  // =========================================================================
  // Contact enquiry notification
  // =========================================================================

  async sendContactEnquiryEmail(data: ContactEnquiryEmailData): Promise<boolean> {
    if (!this.contactNotificationEmail) {
      this.logger.warn('[contact email skipped] CONTACT_NOTIFICATION_EMAIL is not set');
      return false;
    }

    const subject = `New enquiry: ${data.subject}`;
    const html = emailShell(
      section(`
        <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#000000;">New Contact Enquiry</p>
        ${infoTable(`
          ${infoRow('From', `${esc(data.name)} &lt;${esc(data.email)}&gt;`)}
          ${infoRow('Category', esc(data.category))}
          ${data.orderNumber ? infoRow('Order', esc(data.orderNumber)) : ''}
        `)}
        <p style="margin:12px 0 6px;font-size:13px;font-weight:bold;color:#666666;text-transform:uppercase;letter-spacing:1px;">Message</p>
        <p style="margin:0;padding:14px 18px;background-color:${esc(
        // this avoids TS error about unused import — CREAM constant imported via template fn
        '#F5F1ED',
      )};border-radius:6px;font-size:14px;color:#333333;white-space:pre-wrap;">${esc(data.message)}</p>
      `),
      this.storefrontUrl,
      this.instagramUrl,
    );
    const text = `New enquiry from ${data.name} (${data.email})\nCategory: ${data.category}\n${data.orderNumber ? `Order: ${data.orderNumber}\n` : ''}\n${data.message}`;
    return this.send(this.contactNotificationEmail, subject, html, text);
  }

  // =========================================================================
  // Unified outbox dispatcher — used by NotificationProcessor
  // =========================================================================

  async sendNotification(
    eventType: string,
    payload: NotificationPayload,
    attachments?: Array<{ filename: string; content: Buffer | string }>,
  ): Promise<boolean> {
    const orderLink = `${this.storefrontUrl}/account/orders/${esc(payload.orderId)}`;
    const subject = this.subjectFor(eventType, payload.orderNumber);
    const html = this.htmlFor(eventType, payload, orderLink);
    const text = this.textFor(eventType, payload, orderLink);
    return this.send(payload.toEmail, subject, html, text, attachments);
  }

  // =========================================================================
  // Private: subject, HTML body, text body builders
  // =========================================================================

  private subjectFor(eventType: string, orderNumber: string): string {
    const ref = `#${orderNumber}`;
    const map: Record<string, string> = {
      order_placed: `Order Confirmed — PREMAL KAIZEN | Order ${ref}`,
      payment_captured: `Payment Received — PREMAL KAIZEN | Order ${ref}`,
      payment_failed: `Payment Not Completed — PREMAL KAIZEN | Order ${ref}`,
      payment_refunded: `Refund Processed — PREMAL KAIZEN | Order ${ref}`,
      status_shipped: `Your Order Has Shipped — PREMAL KAIZEN | Order ${ref}`,
      status_out_for_delivery: `Out for Delivery — PREMAL KAIZEN | Order ${ref}`,
      status_delivered: `Delivered — PREMAL KAIZEN | Order ${ref}`,
      status_cancelled: `Order Cancelled — PREMAL KAIZEN | Order ${ref}`,
      status_return_requested: `Return Requested — PREMAL KAIZEN | Order ${ref}`,
      status_return_approved: `Return Approved — PREMAL KAIZEN | Order ${ref}`,
      status_return_rejected: `Return Rejected — PREMAL KAIZEN | Order ${ref}`,
    };
    return map[eventType] ?? `Order Update — PREMAL KAIZEN | Order ${ref}`;
  }

  private htmlFor(eventType: string, p: NotificationPayload, orderLink: string): string {
    const ref = `<strong>#${esc(p.orderNumber)}</strong>`;
    const items: TemplateOrderItem[] = (p.items ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.price,
      selectedSize: i.selectedSize,
      selectedColor: i.selectedColor,
    }));
    const totals: TemplateTotals = {
      subtotal: p.subtotal,
      discount: p.discount,
      shipping: p.shipping,
      tax: p.tax,
      total: p.total,
    };
    const addr = p.shippingAddress as TemplateAddress | null;

    const orderBtn = ctaButton('View My Order', orderLink);

    const orderMeta = infoTable(`
      ${infoRow('Order Number', `<span style="font-family:monospace;">${esc(p.orderNumber)}</span>`)}
      ${p.orderDate ? infoRow('Order Date', this.formatDate(p.orderDate)) : ''}
      ${p.paymentMethod ? infoRow('Payment', this.titleCase(p.paymentMethod)) : ''}
    `);

    let content = '';

    switch (eventType) {
      case 'order_placed':
        content = `
          ${heroText('Order Confirmed!', '✅')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">Thank you for your order. We've received it and it's being processed.</p>
          ${orderMeta}
          ${infoBox(p.paymentMethod === 'cod'
          ? '💳 <strong>Cash on Delivery:</strong> Payment is due when your order arrives.'
          : `💳 <strong>Payment Status:</strong> ${statusBadge(p.paymentStatus ?? 'pending')}`,
          'neutral')}
          ${orderItemsTable(items)}
          ${orderTotalsTable(totals)}
          ${addr ? addressBlock(addr) : ''}
          ${p.expectedDelivery ? infoBox(`📦 <strong>Expected Delivery:</strong> ${this.formatDate(p.expectedDelivery)}`, 'blue') : ''}
          <p style="margin:8px 0;font-size:13px;color:#999999;">Your invoice is attached to this email for your records.</p>
          ${divider()}
          ${orderBtn}`;
        break;

      case 'payment_captured':
        content = `
          ${heroText('Payment Received!', '💳')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">We've successfully received your payment for order ${ref}.</p>
          ${infoBox(`✅ <strong>Amount Paid:</strong> ${fmtPaise(p.total ?? 0)}&emsp;|&emsp;<strong>Method:</strong> ${this.titleCase(p.paymentMethod)}`, 'green')}
          ${orderItemsTable(items)}
          ${orderTotalsTable(totals)}
          ${addr ? addressBlock(addr) : ''}
          <p style="margin:8px 0;font-size:13px;color:#999999;">Your invoice is attached to this email.</p>
          ${divider()}
          ${orderBtn}`;
        break;

      case 'payment_failed':
        content = `
          ${heroText('Payment Not Completed', '⚠️')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">Your payment for order ${ref} could not be completed.</p>
          ${infoBox('❌ <strong>No amount has been charged.</strong> You can try again from your order history or choose Cash on Delivery.', 'red')}
          ${divider()}
          ${ctaButton('Try Again', orderLink, '#dc2626')}`;
        break;

      case 'payment_refunded':
        content = `
          ${heroText('Refund Initiated', '💸')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">A refund of <strong>${fmtPaise(p.total ?? 0)}</strong> has been initiated for order ${ref}.</p>
          ${infoBox('⏳ Refunds typically take <strong>5–7 business days</strong> to reflect in your account, depending on your bank or payment provider.', 'blue')}
          ${divider()}
          ${orderBtn}`;
        break;

      case 'status_shipped':
        content = `
          ${heroText('Your Order Has Shipped! 🚚', '')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">Great news — order ${ref} is on its way!</p>
          ${(p.carrier || p.trackingNumber) ? infoBox(`
            📦 <strong>Carrier:</strong> ${esc(p.carrier || '—')}<br>
            🔍 <strong>Tracking Number:</strong> <span style="font-family:monospace;">${esc(p.trackingNumber || '—')}</span>
          `, 'blue') : ''}
          ${p.expectedDelivery ? infoBox(`📅 <strong>Expected Delivery:</strong> ${this.formatDate(p.expectedDelivery)}`, 'neutral') : ''}
          ${divider()}
          ${ctaButton('Track My Order', orderLink)}`;
        break;

      case 'status_out_for_delivery':
        content = `
          ${heroText('Out for Delivery Today! 🏠', '')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">Your package for order ${ref} is out for delivery and should arrive today.</p>
          ${(p.carrier || p.trackingNumber) ? infoBox(`
            📦 <strong>Carrier:</strong> ${esc(p.carrier || '—')}<br>
            🔍 <strong>Tracking:</strong> <span style="font-family:monospace;">${esc(p.trackingNumber || '—')}</span>
          `, 'blue') : ''}
          ${divider()}
          ${orderBtn}`;
        break;

      case 'status_delivered':
        content = `
          ${heroText('Delivered! 🎉', '')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">Your order ${ref} has been delivered. We hope you love your new PREMAL KAIZEN pieces!</p>
          ${infoBox('✨ Tag us on Instagram — we love seeing how you style your looks.', 'neutral')}
          ${divider()}
          ${orderBtn}`;
        break;

      case 'status_cancelled':
        content = `
          ${heroText('Order Cancelled', '❌')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">Your order ${ref} has been cancelled.</p>
          ${p.paymentStatus === 'refunded'
            ? infoBox(`💸 A refund of <strong>${fmtPaise(p.total ?? 0)}</strong> has been initiated to your original payment method.`, 'blue')
            : infoBox('If you paid online, any pending charge will be automatically voided.', 'neutral')}
          <p style="margin:16px 0 0;color:#555555;">If you didn't expect this cancellation, please contact us.</p>
          ${divider()}
          ${ctaButton('Contact Us', `${this.storefrontUrl}/contact`)}`;
        break;

      case 'status_return_requested':
        content = `
          ${heroText('Return Request Received', '📦')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">We've received your return request for order ${ref} and it's being reviewed.</p>
          ${infoBox('⏳ We typically review return requests within <strong>2 business days</strong>. We\'ll email you once a decision is made.', 'neutral')}
          ${divider()}
          ${orderBtn}`;
        break;

      case 'status_return_approved':
        content = `
          ${heroText('Return Approved ✅', '')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">Your return for order ${ref} has been approved.</p>
          ${infoBox('📮 Please ship the items back using the instructions provided. Once received, we will process your refund.', 'green')}
          ${divider()}
          ${orderBtn}`;
        break;

      case 'status_return_rejected':
        content = `
          ${heroText('Return Not Approved', '⚠️')}
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">Unfortunately, we were unable to approve your return request for order ${ref}.</p>
          <p style="margin:0 0 16px;color:#555555;">If you have questions or need further assistance, please reply to this email or contact our support team.</p>
          ${divider()}
          ${ctaButton('Contact Support', `${this.storefrontUrl}/contact`)}`;
        break;

      default:
        content = `
          ${greeting(p.customerName)}
          <p style="margin:0 0 16px;color:#555555;">There's an update on your order ${ref}.</p>
          ${orderBtn}`;
    }

    return emailShell(section(content), this.storefrontUrl, this.instagramUrl);
  }

  private textFor(eventType: string, p: NotificationPayload, orderLink: string): string {
    const ref = `#${p.orderNumber}`;
    const amt = p.total != null ? fmtPaise(p.total) : '';
    const track = p.trackingNumber ? ` Tracking: ${p.trackingNumber}${p.carrier ? ` (${p.carrier})` : ''}.` : '';
    const map: Record<string, string> = {
      order_placed: `Your order ${ref} has been confirmed. Payment: ${this.titleCase(p.paymentMethod ?? '')} (${this.titleCase(p.paymentStatus ?? '')}). Total: ${amt}. View: ${orderLink}`,
      payment_captured: `Payment received for order ${ref}. Amount: ${amt}. View: ${orderLink}`,
      payment_failed: `Your payment for order ${ref} did not complete. No amount was charged. View: ${orderLink}`,
      payment_refunded: `A refund of ${amt} has been initiated for order ${ref}. View: ${orderLink}`,
      status_shipped: `Your order ${ref} has shipped.${track} Track: ${orderLink}`,
      status_out_for_delivery: `Your package for order ${ref} is out for delivery today.${track} Track: ${orderLink}`,
      status_delivered: `Your order ${ref} has been delivered. View: ${orderLink}`,
      status_cancelled: `Your order ${ref} has been cancelled. View: ${orderLink}`,
      status_return_requested: `Your return request for order ${ref} has been received. View: ${orderLink}`,
      status_return_approved: `Your return for order ${ref} has been approved. View: ${orderLink}`,
      status_return_rejected: `Your return request for order ${ref} was not approved. Contact us: ${this.storefrontUrl}/contact`,
    };
    return map[eventType] ?? `There's an update on your order ${ref}. View: ${orderLink}`;
  }

  // =========================================================================
  // Utility helpers
  // =========================================================================

  private formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  }

  private titleCase(s?: string | null): string {
    if (!s) return '';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    return esc(value);
  }
}
