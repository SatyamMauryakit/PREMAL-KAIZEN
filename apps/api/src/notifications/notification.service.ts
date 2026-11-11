import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TxClient } from '../invoices/invoices.service';
import { NotificationPayload } from './notification.types';

/**
 * Enqueues transactional notification events into the `NotificationEvent` outbox.
 *
 * Events are created INSIDE the same database transaction as the change that caused
 * them (order placement, status update, payment capture/failed/refund), so a crash
 * between commit and email delivery can never lose a notification — the pending row
 * survives and the NotificationProcessor drains it later.
 *
 * Idempotency: `idempotencyKey` is `${orderId}:${eventType}` and is `@unique`, so a
 * retried or duplicate trigger (e.g. a redelivered webhook) inserts at most one event
 * and therefore can never send a duplicate email.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Idempotently create a notification event. If an event with this
   * `(orderId, eventType)` key already exists (in any status), it is returned
   * unchanged and no new event is created — guaranteeing at-most-once enqueue.
   */
  async enqueue(
    orderId: string | null,
    eventType: string,
    payload: NotificationPayload,
    opts?: { tx?: TxClient },
  ) {
    const db = opts?.tx ?? this.prisma;
    const idempotencyKey = `${orderId ?? 'system'}:${eventType}`;

    const existing = await db.notificationEvent.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    try {
      return await db.notificationEvent.create({
        data: {
          orderId,
          eventType,
          idempotencyKey,
          payload: JSON.stringify(payload),
          status: 'pending',
        },
      });
    } catch (e: any) {
      // P2002 = unique violation from a concurrent duplicate enqueue.
      if (e?.code === 'P2002') {
        this.logger.debug(`Duplicate enqueue ignored for ${idempotencyKey}`);
        return db.notificationEvent.findUnique({ where: { idempotencyKey } });
      }
      throw e;
    }
  }
}
