import { describe, it, expect, vi } from 'vitest';
import { CustomerAdminService } from './customer-admin.service';

/**
 * Pins the current SQLite-active search behavior for the customer list search
 * (email/firstName/lastName). See categories.service.spec.ts for the full
 * rationale - PostgreSQL cutover patch: add `mode: 'insensitive' as const` to
 * each of these three `contains` filters once the schema provider switches.
 */
describe('CustomerAdminService.findAll - search filter (SQLite active, PostgreSQL cutover pending)', () => {
  it('builds a plain case-sensitivity-unaware contains filter on email/firstName/lastName', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { user: { findMany, count } } as any;
    const service = new CustomerAdminService(prisma);

    await service.findAll({ search: 'Mixed CASE' });

    const expectedWhere = {
      role: 'customer',
      OR: [
        { email: { contains: 'Mixed CASE' } },
        { firstName: { contains: 'Mixed CASE' } },
        { lastName: { contains: 'Mixed CASE' } },
      ],
    };

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
