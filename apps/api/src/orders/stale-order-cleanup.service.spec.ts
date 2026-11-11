import { describe, it, expect, vi } from 'vitest';
import { StaleOrderCleanupService } from './stale-order-cleanup.service';

describe('StaleOrderCleanupService.processOnce (Section 6: abandoned-checkout cleanup)', () => {
  function makeService(staleOrders: Array<{ id: string; orderNumber: string }> = []) {
    const findMany = vi.fn().mockResolvedValue(staleOrders);
    const prisma = { order: { findMany } } as any;
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const ordersService = { updateStatus } as any;
    const service = new StaleOrderCleanupService(prisma, ordersService);
    return { service, findMany, updateStatus };
  }

  it('only queries unpaid, pending, non-COD orders older than the stale cutoff', async () => {
    const { service, findMany } = makeService([]);
    await service.processOnce();

    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe('pending');
    expect(where.paymentStatus).toBe('pending');
    expect(where.paymentMethod).toEqual({ not: 'cod' });
    expect(where.createdAt.lt).toBeInstanceOf(Date);
    // Cutoff must be in the past (older-than-threshold orders), not the future.
    expect(where.createdAt.lt.getTime()).toBeLessThan(Date.now());
  });

  it('cancels every stale order found via the normal updateStatus path (reusing its stock-restore logic)', async () => {
    const { service, updateStatus } = makeService([
      { id: 'o1', orderNumber: 'PK-2026-000001' },
      { id: 'o2', orderNumber: 'PK-2026-000002' },
    ]);

    const result = await service.processOnce();

    expect(updateStatus).toHaveBeenCalledWith('o1', 'cancelled', 'system:stale-checkout-cleanup');
    expect(updateStatus).toHaveBeenCalledWith('o2', 'cancelled', 'system:stale-checkout-cleanup');
    expect(result).toEqual({ cancelled: 2, failed: 0 });
  });

  it('continues past a single failed cancellation instead of aborting the whole batch', async () => {
    const { service, updateStatus } = makeService([
      { id: 'o1', orderNumber: 'PK-2026-000001' },
      { id: 'o2', orderNumber: 'PK-2026-000002' },
    ]);
    updateStatus.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    const result = await service.processOnce();

    expect(updateStatus).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ cancelled: 1, failed: 1 });
  });

  it('a concurrent call while a batch is already running is a no-op (isRunning guard)', async () => {
    const { service, findMany } = makeService([{ id: 'o1', orderNumber: 'PK-2026-000001' }]);
    let resolveFindMany: (v: any) => void;
    findMany.mockReturnValueOnce(new Promise((resolve) => { resolveFindMany = resolve; }));

    const firstCall = service.processOnce();
    const secondCall = await service.processOnce();

    expect(secondCall).toEqual({ cancelled: 0, failed: 0 });
    resolveFindMany!([]);
    await firstCall;
  });
});
