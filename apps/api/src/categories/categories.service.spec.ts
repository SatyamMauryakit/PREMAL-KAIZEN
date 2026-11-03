import { describe, it, expect, vi } from 'vitest';
import { CategoriesService } from './categories.service';

/**
 * Pins the current SQLite-active search behavior: a plain `contains` filter
 * with no `mode` field. PostgreSQL's `contains` is case-sensitive while
 * SQLite's is not - see PHASE_H/I notes. `mode: 'insensitive'` is only valid
 * once the active schema's provider is postgresql (the generated client for
 * the sqlite provider has no `mode` field and the query engine rejects it at
 * runtime), so it cannot be added here yet. Cutover patch required at that
 * point: add `mode: 'insensitive' as const` to both `contains` filters below.
 */
describe('CategoriesService.findAll - search filter (SQLite active, PostgreSQL cutover pending)', () => {
  it('builds a plain case-sensitivity-unaware contains filter on name/slug', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { category: { findMany } } as any;
    const service = new CategoriesService(prisma);

    await service.findAll({ search: 'Mixed CASE' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'Mixed CASE' } },
            { slug: { contains: 'Mixed CASE' } },
          ],
        },
      }),
    );
  });
});
