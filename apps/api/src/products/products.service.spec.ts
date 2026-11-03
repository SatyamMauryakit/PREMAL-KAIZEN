import { describe, it, expect, vi } from 'vitest';
import { ProductsService } from './products.service';

/**
 * Pins the current SQLite-active search behavior for the storefront product
 * search (name/description). See categories.service.spec.ts for the full
 * rationale. PostgreSQL cutover patch: add `mode: 'insensitive' as const` to
 * both `contains` filters once the schema provider switches.
 */
describe('ProductsService.findAll - search filter (SQLite active, PostgreSQL cutover pending)', () => {
  it('builds a plain case-sensitivity-unaware contains filter on name/description', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count } } as any;
    const service = new ProductsService(prisma);

    await service.findAll({ search: 'Mixed CASE' });

    const expectedWhere = {
      isActive: true,
      OR: [
        { name: { contains: 'Mixed CASE' } },
        { description: { contains: 'Mixed CASE' } },
      ],
    };

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
