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

describe('CustomerAdminService - combined email/mobile verification status (Section 4)', () => {
  function makeCustomerRow(emailVerified: Date | null, phoneVerified: Date | null) {
    return {
      id: 'cust_1', email: 'a@example.com', firstName: 'A', lastName: 'B', phoneNumber: '+919876543210',
      isActive: true, emailVerified, phoneVerified, lastLogin: null, createdAt: new Date(), updatedAt: new Date(),
      _count: { orders: 0, addresses: 0 },
    };
  }

  function makeService(customerRow: ReturnType<typeof makeCustomerRow>) {
    const findMany = vi.fn()
      .mockResolvedValueOnce([customerRow]) // user.findMany (findAll's own query)
      .mockResolvedValue([]); // order.findMany for enrichment
    const count = vi.fn().mockResolvedValue(1);
    const prisma = { user: { findMany, count }, order: { findMany } } as any;
    return new CustomerAdminService(prisma);
  }

  it('reports "both_verified" when both email and mobile are verified', async () => {
    const service = makeService(makeCustomerRow(new Date(), new Date()));
    const result = await service.findAll({});
    expect(result.data[0].verificationStatus).toBe('both_verified');
  });

  it('reports "email_verified" when only email is verified', async () => {
    const service = makeService(makeCustomerRow(new Date(), null));
    const result = await service.findAll({});
    expect(result.data[0].verificationStatus).toBe('email_verified');
  });

  it('reports "mobile_verified" when only mobile is verified', async () => {
    const service = makeService(makeCustomerRow(null, new Date()));
    const result = await service.findAll({});
    expect(result.data[0].verificationStatus).toBe('mobile_verified');
  });

  it('reports "pending_verification" when neither is verified', async () => {
    const service = makeService(makeCustomerRow(null, null));
    const result = await service.findAll({});
    expect(result.data[0].verificationStatus).toBe('pending_verification');
  });
});
