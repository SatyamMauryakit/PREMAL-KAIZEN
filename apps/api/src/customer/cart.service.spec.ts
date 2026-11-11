import { describe, it, expect, vi } from 'vitest';
import { CartService } from './cart.service';

function makeProductCartItem(overrides: any = {}) {
  return {
    id: 'ci_1',
    productId: 'p1',
    quantity: 2,
    selectedSize: 'M',
    selectedColor: 'Black',
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    product: { name: 'Hoodie', price: 150000, images: [{ url: '/hoodie.jpg' }] },
    ...overrides,
  };
}

describe('CartService.syncCart (Section 3: admin cart visibility)', () => {
  it('replaces the cart atomically: deletes existing rows, then creates the new set', async () => {
    const deleteMany = vi.fn().mockResolvedValue({});
    const createMany = vi.fn().mockResolvedValue({});
    const tx = { cartItem: { deleteMany, createMany } };
    const prisma = { $transaction: vi.fn((fn: any) => fn(tx)) } as any;
    const service = new CartService(prisma);

    await service.syncCart('user_1', [{ productId: 'p1', quantity: 2, selectedSize: 'M', selectedColor: 'Black' }]);

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user_1', productId: 'p1', quantity: 2, selectedSize: 'M', selectedColor: 'Black' }],
    });
  });

  it('skips createMany entirely when syncing an empty cart (still clears existing rows)', async () => {
    const deleteMany = vi.fn().mockResolvedValue({});
    const createMany = vi.fn().mockResolvedValue({});
    const tx = { cartItem: { deleteMany, createMany } };
    const prisma = { $transaction: vi.fn((fn: any) => fn(tx)) } as any;
    const service = new CartService(prisma);

    await service.syncCart('user_1', []);

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('drops invalid line items (zero/negative quantity, missing productId) rather than persisting garbage', async () => {
    const deleteMany = vi.fn().mockResolvedValue({});
    const createMany = vi.fn().mockResolvedValue({});
    const tx = { cartItem: { deleteMany, createMany } };
    const prisma = { $transaction: vi.fn((fn: any) => fn(tx)) } as any;
    const service = new CartService(prisma);

    await service.syncCart('user_1', [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 0 },
      { productId: '', quantity: 3 } as any,
      { productId: 'p3', quantity: -1 },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user_1', productId: 'p1', quantity: 2, selectedSize: null, selectedColor: null }],
    });
  });
});

describe('CartService.clearCart', () => {
  it('deletes every cart row for the user', async () => {
    const deleteMany = vi.fn().mockResolvedValue({});
    const prisma = { cartItem: { deleteMany } } as any;
    const service = new CartService(prisma);

    await service.clearCart('user_1');

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
  });
});

describe('CartService.getCartForUser', () => {
  it('computes line totals, subtotal, item count, and the most recent updatedAt', async () => {
    const findMany = vi.fn().mockResolvedValue([
      makeProductCartItem({ id: 'ci_1', quantity: 2, updatedAt: new Date('2026-01-01T10:00:00Z') }),
      makeProductCartItem({ id: 'ci_2', productId: 'p2', quantity: 1, product: { name: 'Tee', price: 50000, images: [] }, updatedAt: new Date('2026-01-02T10:00:00Z') }),
    ]);
    const prisma = { cartItem: { findMany } } as any;
    const service = new CartService(prisma);

    const result = await service.getCartForUser('user_1');

    expect(result.itemCount).toBe(3); // 2 + 1
    expect(result.subtotal).toBe(150000 * 2 + 50000 * 1);
    expect(result.lastUpdated).toEqual(new Date('2026-01-02T10:00:00Z'));
    expect(result.items[1].image).toBeNull(); // no product images
  });

  it('returns an empty summary (not an error) for a customer with no cart items', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { cartItem: { findMany } } as any;
    const service = new CartService(prisma);

    const result = await service.getCartForUser('user_1');

    expect(result).toEqual({ items: [], itemCount: 0, subtotal: 0, lastUpdated: null });
  });
});

describe('CartService.getCartsForAdmin', () => {
  it('lists one row per customer with a non-empty cart, sorted by most recently updated first', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { userId: 'user_old', _max: { updatedAt: new Date('2026-01-01T00:00:00Z') } },
      { userId: 'user_new', _max: { updatedAt: new Date('2026-01-05T00:00:00Z') } },
    ]);
    const findUnique = vi.fn()
      .mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.id === 'user_new'
            ? { id: 'user_new', email: 'new@example.com', firstName: 'New', lastName: 'Customer' }
            : { id: 'user_old', email: 'old@example.com', firstName: 'Old', lastName: 'Customer' },
        ),
      );
    const findMany = vi.fn().mockResolvedValue([]); // cart contents not under test here
    const prisma = { cartItem: { groupBy, findMany }, user: { findMany: vi.fn(), findUnique } } as any;
    const service = new CartService(prisma);

    const result = await service.getCartsForAdmin({});

    expect(result.total).toBe(2);
    expect(result.data[0].userId).toBe('user_new'); // most recently updated first
    expect(result.data[1].userId).toBe('user_old');
  });

  it('filters by customer search term (name/email)', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { userId: 'user_a', _max: { updatedAt: new Date() } },
      { userId: 'user_b', _max: { updatedAt: new Date() } },
    ]);
    const userFindMany = vi.fn().mockResolvedValue([{ id: 'user_a' }]); // only user_a matches the search
    const findUnique = vi.fn().mockResolvedValue({ id: 'user_a', email: 'a@example.com', firstName: 'A', lastName: 'B' });
    const cartItemFindMany = vi.fn().mockResolvedValue([]);
    const prisma = { cartItem: { groupBy, findMany: cartItemFindMany }, user: { findMany: userFindMany, findUnique } } as any;
    const service = new CartService(prisma);

    const result = await service.getCartsForAdmin({ search: 'A' });

    expect(result.total).toBe(1);
    expect(result.data[0].userId).toBe('user_a');
  });

  it('never includes guest (null-userId) cart rows', async () => {
    const groupBy = vi.fn().mockResolvedValue([{ userId: null, _max: { updatedAt: new Date() } }]);
    const prisma = { cartItem: { groupBy, findMany: vi.fn() }, user: { findMany: vi.fn(), findUnique: vi.fn() } } as any;
    const service = new CartService(prisma);

    const result = await service.getCartsForAdmin({});

    expect(result.total).toBe(0);
  });
});
