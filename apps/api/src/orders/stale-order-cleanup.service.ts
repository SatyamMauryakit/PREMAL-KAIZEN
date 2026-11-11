import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

/**
 * Auto-cancels abandoned online-payment checkouts (Section 6: "pending/timeout"
 * handling). A Razorpay order is created - and stock decremented for it - the
 * moment the customer starts checkout (see OrdersService.create), before payment
 * is ever confirmed. If the customer closes the tab, the bank silently declines
 * with no webhook delivery, or they simply never pay, that order would otherwise
 * sit in paymentStatus:'pending' forever with its stock permanently locked out of
 * the sellable pool.
 *
 * COD orders are never touched here - they're finalized (paymentStatus stays
 * 'pending' by design, collected on delivery) the moment they're created, so a
 * "pending" COD order is a normal, legitimate, non-stale state, not an abandoned
 * checkout.
 *
 * Reuses OrdersService.updateStatus so the cancellation goes through the exact
 * same audit trail + notification + stock-restore path as an admin-initiated
 * cancellation - no separate/duplicated stock-restore logic to keep in sync.
 *
 * Same single-process in-instance polling pattern as NotificationProcessor; see
 * that file's module-level comment for the multi-instance caveat.
 */
@Injectable()
export class StaleOrderCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaleOrderCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  private readonly pollIntervalMs: number;
  private readonly staleAfterMs: number;

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
  ) {
    this.pollIntervalMs = Number(process.env.STALE_ORDER_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000;
    this.staleAfterMs = Number(process.env.STALE_ORDER_TIMEOUT_MS) || 60 * 60 * 1000;
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.processOnce().catch((err) => {
        this.logger.error(`Stale order cleanup pass failed: ${(err as Error).message}`);
      });
    }, this.pollIntervalMs);
    this.logger.log(
      `Stale order cleanup started (every ${this.pollIntervalMs}ms, cancelling unpaid online orders older than ${this.staleAfterMs}ms)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Cancels one batch of abandoned online-payment orders (restoring their stock
   * via the normal cancellation path). Public so tests can run it deterministically.
   */
  async processOnce(batchSize = 50): Promise<{ cancelled: number; failed: number }> {
    if (this.isRunning) return { cancelled: 0, failed: 0 };
    this.isRunning = true;
    let cancelled = 0;
    let failed = 0;
    try {
      const cutoff = new Date(Date.now() - this.staleAfterMs);
      const staleOrders = await this.prisma.order.findMany({
        where: {
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: { not: 'cod' },
          createdAt: { lt: cutoff },
        },
        select: { id: true, orderNumber: true },
        take: batchSize,
      });

      for (const order of staleOrders) {
        try {
          await this.ordersService.updateStatus(order.id, 'cancelled', 'system:stale-checkout-cleanup');
          cancelled++;
          this.logger.log(`Auto-cancelled abandoned checkout ${order.orderNumber} (unpaid past ${this.staleAfterMs}ms) - stock restored.`);
        } catch (err) {
          failed++;
          this.logger.error(`Failed to auto-cancel stale order ${order.id}: ${(err as Error).message}`);
        }
      }

      return { cancelled, failed };
    } finally {
      this.isRunning = false;
    }
  }
}
