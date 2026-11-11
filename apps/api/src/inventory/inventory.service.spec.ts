import { describe, it, expect, vi } from 'vitest';
import { InventoryService } from './inventory.service';

/**
 * Pins the current SQLite-active search behavior for the inventory search,
 * which filters through a relation (product.name / product.sku). See
 * categories.service.spec.ts for the full rationale. PostgreSQL cutover
 * patch: add `mode: 'insensitive' as const` to both nested `contains`
 * filters once the schema provider switches - the nesting under `product:`
 * does not change how `mode` is applied.
 */
describe('InventoryService.getInventory - search filter (SQLite active, PostgreSQL cutover pending)', () => {
  it('builds a plain case-sensitivity-unaware contains filter on product.name/product.sku', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { inventory: { findMany, count, fields: {} } } as any;
    const service = new InventoryService(prisma);

    await service.getInventory({ search: 'Mixed CASE' });

    const expectedWhere = {
      OR: [
        { product: { name: { contains: 'Mixed CASE' } } },
        { product: { sku: { contains: 'Mixed CASE' } } },
      ],
    };

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});

describe('InventoryService.getInventory - sold quantity (Section 5)', () => {
  it('attaches sold units per variant from non-cancelled historical order items', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'inv1', productId: 'p1', size: 'M', color: 'Black', onHand: 10, reserved: 2, reorderThreshold: 5 },
      { id: 'inv2', productId: 'p1', size: 'L', color: 'Black', onHand: 3, reserved: 0, reorderThreshold: 5 },
    ]);
    const count = vi.fn().mockResolvedValue(2);
    const groupBy = vi.fn().mockResolvedValue([
      { productId: 'p1', selectedSize: 'M', selectedColor: 'Black', _sum: { quantity: 7 } },
    ]);
    const prisma = { inventory: { findMany, count, fields: {} }, orderItem: { groupBy } } as any;
    const service = new InventoryService(prisma);

    const result = await service.getInventory({});

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: { in: ['p1'] }, order: { status: { not: 'cancelled' } } },
      }),
    );
    expect(result.data.find((r: any) => r.id === 'inv1').sold).toBe(7);
    // A variant with no matching groupBy row (never ordered, or only cancelled orders) is 0, not undefined.
    expect(result.data.find((r: any) => r.id === 'inv2').sold).toBe(0);
  });

  it('skips the sold-quantity query entirely when the page is empty', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const groupBy = vi.fn();
    const prisma = { inventory: { findMany, count, fields: {} }, orderItem: { groupBy } } as any;
    const service = new InventoryService(prisma);

    await service.getInventory({});

    expect(groupBy).not.toHaveBeenCalled();
  });
});
