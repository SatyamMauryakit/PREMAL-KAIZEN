import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InvoicesService } from '../invoices/invoices.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';
import { NotificationPayload } from './notification.types';

/**
 * Drains the NotificationEvent outbox and delivers emails with retry + backoff.
 *
 * This is a single-process, in-instance poller appropriate to the current
 * single-instance SQLite deployment: an interval picks up due `pending`/`failed`
 * events and attempts each once via EmailService (which never throws). On failure
 * the event is left in `failed` with a `nextRetryAt` computed by exponential backoff,
 * capped at MAX_ATTEMPTS, so a temporary provider outage is retried safely rather
 * than lost. An `isRunning` guard prevents overlapping ticks.
 *
 * Multi-instance note: if the API ever runs as >1 replica, this poller would need a
 * DB-level claim (e.g. atomic UPDATE ... SET status='processing' WHERE status='pending'
 * RETURNING) so two replicas don't both pick the same event. That is out of scope for
 * the current single-instance setup and is called out in the deployment notes.
 */
@Injectable()
export class NotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  private readonly pollIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private invoicesService: InvoicesService,
    private invoicePdfService: InvoicePdfService,
  ) {
    this.pollIntervalMs = Number(process.env.NOTIF_POLL_INTERVAL_MS) || 10000;
    this.maxAttempts = Number(process.env.NOTIF_MAX_ATTEMPTS) || 5;
    this.baseBackoffMs = Number(process.env.NOTIF_BASE_BACKOFF_MS) || 15000;
  }

  onModuleInit() {
    // Don't auto-start the poller in tests (NODE_ENV === 'test'); tests call processOnce()
    // directly for determinism.
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.processOnce().catch((err) => {
        this.logger.error(`Outbox poll failed: ${(err as Error).message}`);
      });
    }, this.pollIntervalMs);
    this.logger.log(`Notification outbox poller started (every ${this.pollIntervalMs}ms, max ${this.maxAttempts} attempts)`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Drains one batch of due events. Public so tests can run it deterministically.
   */
  async processOnce(batchSize = 20): Promise<{ processed: number; sent: number; failed: number }> {
    if (this.isRunning) return { processed: 0, sent: 0, failed: 0 };
    this.isRunning = true;
    let sent = 0;
    let failed = 0;
    try {
      const now = new Date();
      const events = await this.prisma.notificationEvent.findMany({
        where: {
          status: { in: ['pending', 'failed'] },
          attempts: { lt: this.maxAttempts },
          AND: [
            { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      for (const event of events) {
        const ok = await this.sendOne(event.id, event.eventType, event.payload);
        if (ok) sent++;
        else failed++;
      }

      return { processed: events.length, sent, failed };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Attempts to deliver a single event. Never throws — failures are recorded on the
   * event row for retry. Returns whether the send succeeded.
   */
  private async sendOne(eventId: string, eventType: string, payloadJson: string): Promise<boolean> {
    let payload: NotificationPayload;
    try {
      payload = JSON.parse(payloadJson) as NotificationPayload;
    } catch {
      // Corrupt payload is a permanent failure — can't render. Mark exhausted.
      await this.prisma.notificationEvent.update({
        where: { id: eventId },
        data: { status: 'failed', attempts: { increment: 1 }, lastError: 'Corrupt payload JSON' },
      });
      return false;
    }

    const attachments: Array<{ filename: string; content: Buffer }> = [];
    if (eventType === 'order_placed' || eventType === 'payment_captured') {
      const pdf = await this.buildInvoiceAttachment(payload.orderId);
      if (pdf) {
        attachments.push({ filename: `invoice-${payload.orderNumber}.pdf`, content: pdf });
      }
    }

    const sent = await this.emailService.sendNotification(eventType, payload, attachments);

    if (sent) {
      await this.prisma.notificationEvent.update({
        where: { id: eventId },
        data: { status: 'sent', sentAt: new Date(), lastError: null, attempts: { increment: 1 } },
      });
      return true;
    }

    // Failed: schedule a retry with exponential backoff, or give up at the cap.
    const attempts = await this.currentAttempts(eventId);
    const nextAttempt = attempts + 1;
    if (nextAttempt >= this.maxAttempts) {
      await this.prisma.notificationEvent.update({
        where: { id: eventId },
        data: { status: 'failed', attempts: nextAttempt, lastError: 'Exhausted retries' },
      });
      this.logger.error(`Notification ${eventId} (${eventType}) exhausted ${this.maxAttempts} attempts — giving up.`);
    } else {
      const backoff = Math.min(this.baseBackoffMs * 2 ** (nextAttempt - 1), 30 * 60 * 1000);
      const nextRetryAt = new Date(Date.now() + backoff);
      await this.prisma.notificationEvent.update({
        where: { id: eventId },
        data: { status: 'failed', attempts: nextAttempt, nextRetryAt, lastError: 'Send failed (will retry)' },
      });
      this.logger.warn(`Notification ${eventId} (${eventType}) failed — retry #${nextAttempt} in ${Math.round(backoff / 1000)}s.`);
    }
    return false;
  }

  private async currentAttempts(eventId: string): Promise<number> {
    const ev = await this.prisma.notificationEvent.findUnique({ where: { id: eventId }, select: { attempts: true } });
    return ev?.attempts ?? 0;
  }

  /**
   * Builds the invoice PDF for the order, used as an email attachment. Failures are
   * non-fatal — the email is still sent without the attachment so a PDF error never
   * blocks a confirmation. (The invoice row itself was created in-transaction.)
   */
  private async buildInvoiceAttachment(orderId: string): Promise<Buffer | null> {
    try {
      const data = await this.invoicesService.getInvoiceData(orderId);
      return await this.invoicePdfService.render(data);
    } catch (err) {
      this.logger.warn(`Could not attach invoice PDF to notification for order ${orderId}: ${(err as Error).message}`);
      return null;
    }
  }
}
