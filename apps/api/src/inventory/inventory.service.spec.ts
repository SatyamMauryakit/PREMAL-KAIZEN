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
