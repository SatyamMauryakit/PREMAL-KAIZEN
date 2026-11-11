/**
 * Inventory atomics regression tests.
 * Covers: out-of-stock prevention, concurrent oversell protection,
 * stock restore on cancellation, and admin stock update.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

function makeInv(overrides = {}) {
  return { id: 'inv_1', productId: 'prod_1', size: 'M', color: null, onHand: 10, reserved: 0, reorderThreshold: 5, ...overrides };
}

function makePrisma(inv: ReturnType<typeof makeInv>) {
  return {
    inventory: {
      // The service now uses findFirst (via findInventoryByVariant helper) instead of
      // findUnique with the compound key, because Prisma 5 / SQLite throws
      // "Argument size must not be null" when null components appear in a compound key.
      findFirst: vi.fn().mockResolvedValue(inv),
      findUnique: vi.fn().mockResolvedValue(inv), // used for re-fetch-by-id paths
      update: vi.fn().mockImplementation(({ data }) => ({ ...inv, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    inventoryAuditLog: { create: vi.fn().mockResolvedValue({}) },
    inventoryAdjustment: { create: vi.fn().mockResolvedValue({ id: 'adj_1' }) },
  } as any;
}

describe('InventoryService.decrementForOrder', () => {
  it('decrements onHand for a tracked variant', async () => {
    const inv = makeInv({ onHand: 5 });
    const prisma = makePrisma(inv);
    const service = new InventoryService(prisma);

    await service.decrementForOrder(
      [{ productId: 'prod_1', quantity: 2, selectedSize: 'M', selectedColor: null }],
      prisma as any,
      'order_1',
    );

    expect(prisma.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv_1', onHand: { gte: 2 } },
      data: { onHand: { decrement: 2 } },
    });
  });

  it('throws BadRequestException when available stock is too low (oversell prevention)', async () => {
    const inv = makeInv({ onHand: 1 });
    const prisma = makePrisma(inv);
    const service = new InventoryService(prisma);

    await expect(
      service.decrementForOrder(
        [{ productId: 'prod_1', quantity: 5, selectedSize: 'M', selectedColor: null }],
        prisma as any,
        'order_1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('throws when concurrent write leaves count=0 (race condition guard)', async () => {
    const inv = makeInv({ onHand: 3 });
    const prisma = makePrisma(inv);
    prisma.inventory.updateMany.mockResolvedValue({ count: 0 }); // concurrent order won
    const service = new InventoryService(prisma);

    await expect(
      service.decrementForOrder(
        [{ productId: 'prod_1', quantity: 2, selectedSize: 'M', selectedColor: null }],
        prisma as any,
        'order_1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('skips decrement when no inventory row exists for the variant (unlimited stock)', async () => {
    const prisma = {
      inventory: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
      },
      inventoryAuditLog: { create: vi.fn() },
    } as any;
    const service = new InventoryService(prisma);

    // Should not throw — no row means stock is not tracked
    await expect(
      service.decrementForOrder(
        [{ productId: 'prod_1', quantity: 99, selectedSize: 'M', selectedColor: null }],
        prisma as any,
        'order_1',
      ),
    ).resolves.toBeUndefined();

    expect(prisma.inventory.updateMany).not.toHaveBeenCalled();
  });
});

describe('InventoryService.restoreForCancellation', () => {
  it('increments onHand and creates an audit log on cancellation', async () => {
    const inv = makeInv({ onHand: 3 });
    const prisma = makePrisma(inv);
    const service = new InventoryService(prisma);

    await service.restoreForCancellation(
      [{ productId: 'prod_1', quantity: 2, selectedSize: 'M', selectedColor: null }],
      'order_1',
    );

    expect(prisma.inventory.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { onHand: { increment: 2 } },
    });
    expect(prisma.inventoryAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ changeType: 'order_cancelled' }) }),
    );
  });

  it('silently skips if no inventory row exists', async () => {
    const prisma = {
      inventory: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      inventoryAuditLog: { create: vi.fn() },
    } as any;
    const service = new InventoryService(prisma);

    await expect(
      service.restoreForCancellation(
        [{ productId: 'prod_1', quantity: 2, selectedSize: 'M', selectedColor: null }],
        'order_1',
      ),
    ).resolves.toBeUndefined();

    expect(prisma.inventory.update).not.toHaveBeenCalled();
  });
});

describe('InventoryService.adjustInventory — admin stock update', () => {
  it('admin can increase onHand via received adjustment', async () => {
    const inv = makeInv({ onHand: 10, reserved: 0 });
    const prisma = {
      inventory: {
        findFirst: vi.fn().mockResolvedValue(inv),
        findUnique: vi.fn().mockResolvedValue({ ...inv, product: { name: 'Test' } }), // re-fetch with include
        update: vi.fn().mockResolvedValue({ ...inv, onHand: 15 }),
      },
      inventoryAdjustment: { create: vi.fn().mockResolvedValue({ id: 'adj_1' }) },
      inventoryAuditLog: { create: vi.fn().mockResolvedValue({}) },
    } as any;
    const service = new InventoryService(prisma);

    const result = await service.adjustInventory('prod_1', {
      size: 'M',
      type: 'received',
      quantity: 5,
      reason: 'New stock received',
    });

    expect(prisma.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { onHand: 15 } }),
    );
    expect(result.available).toBe(15); // onHand 15 − reserved 0
  });

  it('admin cannot reduce stock below zero', async () => {
    const inv = makeInv({ onHand: 2, reserved: 0 });
    const prisma = {
      inventory: {
        findFirst: vi.fn().mockResolvedValue(inv),
        findUnique: vi.fn().mockResolvedValue({ ...inv, product: { name: 'Test' } }),
        create: vi.fn(),
      },
      inventoryAdjustment: { create: vi.fn() },
      inventoryAuditLog: { create: vi.fn() },
    } as any;
    const service = new InventoryService(prisma);

    await expect(service.adjustInventory('prod_1', {
      size: 'M',
      type: 'correction',
      quantity: -5,
      reason: 'Manual correction',
    })).rejects.toThrow(BadRequestException);
  });

  it('rejects adjusting a nonexistent product with a clean 404 instead of an unhandled FK error', async () => {
    // No inventory row for this productId+size+color yet, and the productId
    // itself doesn't resolve to a real product - this is exactly what happened
    // when the admin UI passed an inventory row's own id instead of a product
    // id (see inventory.spec.ts history): Prisma's inventory.create() would
    // throw a raw foreign-key violation, surfacing as an unhandled 500.
    const prisma = {
      inventory: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      product: { findUnique: vi.fn().mockResolvedValue(null) },
      inventoryAdjustment: { create: vi.fn() },
      inventoryAuditLog: { create: vi.fn() },
    } as any;
    const service = new InventoryService(prisma);

    await expect(service.adjustInventory('not-a-real-product-id', {
      size: 'M',
      type: 'received',
      quantity: 5,
      reason: 'New stock received',
    })).rejects.toThrow(NotFoundException);

    expect(prisma.inventory.create).not.toHaveBeenCalled();
  });

  it('creates a fresh inventory row when the product is real but this variant has none yet', async () => {
    const prisma = {
      inventory: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'inv_new', productId: 'prod_1', size: 'XXL', color: null, onHand: 0, reserved: 0, reorderThreshold: 10, product: { name: 'Test' } }),
        update: vi.fn().mockResolvedValue({ id: 'inv_new', productId: 'prod_1', size: 'XXL', color: null, onHand: 5, reserved: 0, reorderThreshold: 10 }),
      },
      product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod_1' }) },
      inventoryAdjustment: { create: vi.fn().mockResolvedValue({ id: 'adj_1' }) },
      inventoryAuditLog: { create: vi.fn().mockResolvedValue({}) },
    } as any;
    const service = new InventoryService(prisma);

    const result = await service.adjustInventory('prod_1', {
      size: 'XXL',
      type: 'received',
      quantity: 5,
      reason: 'First stock for a new size',
    });

    expect(prisma.inventory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ productId: 'prod_1', size: 'XXL', onHand: 0 }) }),
    );
    expect(result.available).toBe(5);
  });
});
