import { describe, it, expect, vi } from 'vitest';
import { ProductsService } from './products.service';

/**
 * Pins the current SQLite-active search behavior for the storefront product
 * search (name/description). See categories.service.spec.ts for the full
 * rationale. PostgreSQL cutover patch: add `mode: 'insensitive' as const` to
 * every `contains` filter below once the schema provider switches.
 */
describe('ProductsService.findAll - search filter (SQLite active, PostgreSQL cutover pending)', () => {
  it('builds a plain case-sensitivity-unaware contains filter on name/description', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count } } as any;
    const service = new ProductsService(prisma);

    await service.findAll({ search: 'Mixed CASE' });

    const expectedWhere = {
      AND: [
        { isDeleted: false },
        { isActive: true },
        {
          OR: [
            { name: { contains: 'Mixed CASE' } },
            { description: { contains: 'Mixed CASE' } },
          ],
        },
      ],
    };

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});

describe('ProductsService.findAll - ids filter (batch fetch by id)', () => {
  it('matches exact product ids via an IN clause', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count } } as any;
    const service = new ProductsService(prisma);

    await service.findAll({ ids: ['p1', 'p2', 'p3'] });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ id: { in: ['p1', 'p2', 'p3'] } });
  });

  it('still requires isActive - a batch fetch never returns inactive/deleted products', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count } } as any;
    const service = new ProductsService(prisma);

    await service.findAll({ ids: ['p1'] });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ isActive: true });
    expect(where.AND).toContainEqual({ isDeleted: false });
  });
});

describe('ProductsService.findAll - multi-category filter', () => {
  it('matches any of several selected category slugs (OR semantics)', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count } } as any;
    const service = new ProductsService(prisma);

    await service.findAll({ categories: ['hoodies', 'tees'] });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ category: { slug: { in: ['hoodies', 'tees'] } } });
  });
});

describe('ProductsService.findAll - size/color/price filters', () => {
  function makeService() {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count } } as any;
    return { service: new ProductsService(prisma), findMany, count };
  }

  it('matches a size as a whole JSON-array element, not a substring of another size', async () => {
    const { service, findMany } = makeService();
    await service.findAll({ sizes: ['M'] });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ OR: [{ sizes: { contains: '"M"' } }] });
    // "M" must not be expressed in a way that would also match "ML" or "XM" - the
    // quoted-element form is what guarantees that, this just pins the exact filter shape.
  });

  it('matches any of several selected colors (OR semantics)', async () => {
    const { service, findMany } = makeService();
    await service.findAll({ colors: ['Black', 'White'] });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({
      OR: [{ colors: { contains: '"Black"' } }, { colors: { contains: '"White"' } }],
    });
  });

  it('converts minPrice/maxPrice from rupees to paise for the price column', async () => {
    const { service, findMany } = makeService();
    await service.findAll({ minPrice: 500, maxPrice: 2000 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ price: { gte: 50000, lte: 200000 } });
  });

  it('omits the price clause entirely when neither bound is given', async () => {
    const { service, findMany } = makeService();
    await service.findAll({});

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND.some((clause: any) => 'price' in clause)).toBe(false);
  });
});

describe('ProductsService.findAllForAdmin - status filter (admin panel, fixes disabled products vanishing)', () => {
  function makeService() {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count } } as any;
    return { service: new ProductsService(prisma), findMany, count };
  }

  it('defaults to showing every status (no isActive filter at all) when status is omitted', async () => {
    const { service, findMany } = makeService();
    await service.findAllForAdmin({});

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND.some((clause: any) => 'isActive' in clause)).toBe(false);
  });

  it('shows only inactive (disabled) products when status is "inactive"', async () => {
    const { service, findMany } = makeService();
    await service.findAllForAdmin({ status: 'inactive' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ isActive: false });
  });

  it('shows only active products when status is "active"', async () => {
    const { service, findMany } = makeService();
    await service.findAllForAdmin({ status: 'active' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ isActive: true });
  });

  it('shows only out-of-stock products regardless of isActive, requiring at least one tracked variant (Section 6)', async () => {
    const { service, findMany } = makeService();
    await service.findAllForAdmin({ status: 'out_of_stock' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ inventory: { some: {}, every: { onHand: { lte: 0 } } } });
    expect(where.AND.some((clause: any) => 'isActive' in clause)).toBe(false);
  });

  it('still applies search/category/size/color/price filters the same as the public endpoint', async () => {
    const { service, findMany } = makeService();
    await service.findAllForAdmin({ status: 'all', search: 'hoodie', categories: ['hoodies'] });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ category: { slug: { in: ['hoodies'] } } });
    expect(where.AND).toContainEqual({
      OR: [{ name: { contains: 'hoodie' } }, { description: { contains: 'hoodie' } }],
    });
  });
});

describe('ProductsService - soft delete isolation (Section 4D)', () => {
  function makeService() {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count } } as any;
    return { service: new ProductsService(prisma), findMany, count };
  }

  it('findAllForAdmin (status=all) still excludes soft-deleted products - they only ever show in findDeleted', async () => {
    const { service, findMany } = makeService();
    await service.findAllForAdmin({ status: 'all' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ isDeleted: false });
  });

  it('findDeleted lists only soft-deleted products, regardless of their isActive value', async () => {
    const { service, findMany } = makeService();
    await service.findDeleted({});

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ isDeleted: true });
    expect(where.AND.some((clause: any) => 'isActive' in clause)).toBe(false);
  });
});

describe('ProductsService - delete/restore/permanentlyDelete lifecycle (Section 4B)', () => {
  function makeService(productOverrides: any = {}, orderItemCount = 0) {
    const product = productOverrides === null ? null : {
      id: 'p1',
      isDeleted: false,
      isActive: true,
      ...productOverrides,
    };
    const findUnique = vi.fn().mockResolvedValue(product);
    const update = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...product, ...data, category: null, images: [] }),
    );
    const del = vi.fn().mockResolvedValue({});
    const orderItemCountFn = vi.fn().mockResolvedValue(orderItemCount);
    const prisma = {
      product: { findUnique, update, delete: del },
      orderItem: { count: orderItemCountFn },
    } as any;
    return { service: new ProductsService(prisma), findUnique, update, del, orderItemCountFn };
  }

  it('delete() marks a product isDeleted/isActive:false and stamps deletedAt, without touching the row itself', async () => {
    const { service, update } = makeService();
    const result = await service.delete('p1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isDeleted: true, deletedAt: expect.any(Date), isActive: false },
    });
    expect(result).toEqual({ success: true, message: 'Product deleted successfully' });
  });

  it('delete() 404s when the product does not exist', async () => {
    const { service } = makeService(null);
    await expect(service.delete('missing')).rejects.toThrow('not found');
  });

  it('delete() 404s when the product is already soft-deleted', async () => {
    const { service } = makeService({ isDeleted: true });
    await expect(service.delete('p1')).rejects.toThrow('not found');
  });

  it('restore() clears isDeleted/deletedAt without forcing isActive back on', async () => {
    const { service, update } = makeService({ isDeleted: true, isActive: false, deletedAt: new Date() });
    await service.restore('p1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isDeleted: false, deletedAt: null },
      include: { category: true, images: { orderBy: { order: 'asc' } } },
    });
  });

  it('restore() 404s when the product is not currently deleted', async () => {
    const { service } = makeService({ isDeleted: false });
    await expect(service.restore('p1')).rejects.toThrow('not found');
  });

  it('permanentlyDelete() removes the row once soft-deleted and has no order history', async () => {
    const { service, del } = makeService({ isDeleted: true }, 0);
    const result = await service.permanentlyDelete('p1');

    expect(del).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(result).toEqual({ success: true, message: 'Product permanently deleted' });
  });

  it('permanentlyDelete() refuses a product that was never soft-deleted first', async () => {
    const { service, del } = makeService({ isDeleted: false });
    await expect(service.permanentlyDelete('p1')).rejects.toThrow('Delete it first');
    expect(del).not.toHaveBeenCalled();
  });

  it('permanentlyDelete() refuses with a clean error when historical orders reference it, instead of a raw FK-violation 500', async () => {
    const { service, del } = makeService({ isDeleted: true }, 3);
    await expect(service.permanentlyDelete('p1')).rejects.toThrow('referenced by 3 historical order item(s)');
    expect(del).not.toHaveBeenCalled();
  });

  it('permanentlyDelete() 404s when the product does not exist at all', async () => {
    const { service } = makeService(null);
    await expect(service.permanentlyDelete('missing')).rejects.toThrow('not found');
  });
});

describe('ProductsService.getFacets', () => {
  it('returns distinct sizes/colors and the price range (in rupees) across active products only', async () => {
    const aggregate = vi.fn().mockResolvedValue({ _min: { price: 30000 }, _max: { price: 500000 } });
    const findMany = vi.fn().mockResolvedValue([
      { sizes: '["M","L"]', colors: '["Black"]' },
      { sizes: '["L","XL"]', colors: '["Black","White"]' },
    ]);
    const prisma = { product: { aggregate, findMany } } as any;
    const service = new ProductsService(prisma);

    const facets = await service.getFacets();

    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { sizes: true, colors: true },
    });
    expect(facets.sizes.sort()).toEqual(['L', 'M', 'XL']);
    expect(facets.colors.sort()).toEqual(['Black', 'White']);
    expect(facets.priceRange).toEqual({ min: 300, max: 5000 });
  });

  it('returns a zeroed price range when there are no active products', async () => {
    const aggregate = vi.fn().mockResolvedValue({ _min: { price: null }, _max: { price: null } });
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { product: { aggregate, findMany } } as any;
    const service = new ProductsService(prisma);

    const facets = await service.getFacets();

    expect(facets).toEqual({ sizes: [], colors: [], priceRange: { min: 0, max: 0 } });
  });
});
