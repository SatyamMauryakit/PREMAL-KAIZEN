import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

/**
 * In-memory fake tx with real conditional-update semantics (check + mutate in
 * one synchronous step, matching what a real atomic `UPDATE ... WHERE id = ?
 * AND usageCount < ?` does). Used to prove the SERVICE issues a single atomic
 * conditional update per limit - not that any particular database enforces it.
 * Phase H/I's disposable-PostgreSQL runs are what prove real DB behavior.
 */
function makeAtomicTx(opts: {
  couponUsageLimit: number | null;
  couponUsageCount: number;
  promotionUsageLimit: number | null;
  promotionUsageCount: number;
}) {
  const state = {
    couponUsageCount: opts.couponUsageCount,
    promotionUsageCount: opts.promotionUsageCount,
  };
  const redemptions: any[] = [];
  const existingRedemptionKeys = new Set<string>();

  const tx = {
    couponCode: {
      findUnique: vi.fn(async () => ({
        id: 'coupon_1',
        code: 'RACE1',
        usageLimit: opts.couponUsageLimit,
        usageCount: state.couponUsageCount,
        promotionId: 'promo_1',
        promotion: {
          id: 'promo_1',
          totalUsageLimit: opts.promotionUsageLimit,
          usageCount: state.promotionUsageCount,
        },
      })),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.id !== 'coupon_1') return { count: 0 };
        if (where.usageCount && !(state.couponUsageCount < where.usageCount.lt)) {
          return { count: 0 };
        }
        state.couponUsageCount += data.usageCount.increment;
        return { count: 1 };
      }),
    },
    promotion: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.id !== 'promo_1') return { count: 0 };
        if (where.usageCount && !(state.promotionUsageCount < where.usageCount.lt)) {
          return { count: 0 };
        }
        state.promotionUsageCount += data.usageCount.increment;
        return { count: 1 };
      }),
    },
    couponRedemption: {
      findFirst: vi.fn(async ({ where }: any) => {
        const key = `${where.couponCodeId}:${where.userId}:${where.orderId}`;
        return existingRedemptionKeys.has(key) ? redemptions.find((r) => r.key === key) : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const key = `${data.couponCodeId}:${data.userId}:${data.orderId}`;
        const redemption = { id: `redemption_${redemptions.length + 1}`, key, ...data };
        redemptions.push(redemption);
        existingRedemptionKeys.add(key);
        return redemption;
      }),
    },
  };

  return { tx, state, redemptions };
}

describe('PromotionsService.redeemCouponInTx - usage-limit concurrency safety', () => {
  let service: PromotionsService;

  beforeEach(() => {
    service = new PromotionsService({} as any);
  });

  it('succeeds when usage is below the limit', async () => {
    const { tx, state } = makeAtomicTx({
      couponUsageLimit: 5,
      couponUsageCount: 2,
      promotionUsageLimit: null,
      promotionUsageCount: 0,
    });

    const redemption = await service.redeemCouponInTx(tx, 'race1', 'user_1', 'order_1', 100);

    expect(redemption).toBeTruthy();
    expect(state.couponUsageCount).toBe(3);
  });

  it('rejects when the coupon is already at its usage limit', async () => {
    const { tx, state } = makeAtomicTx({
      couponUsageLimit: 1,
      couponUsageCount: 1,
      promotionUsageLimit: null,
      promotionUsageCount: 0,
    });

    await expect(service.redeemCouponInTx(tx, 'race1', 'user_1', 'order_1', 100)).rejects.toThrow(
      BadRequestException,
    );
    // Failed redemption must not have incremented the counter or created a row.
    expect(state.couponUsageCount).toBe(1);
    expect(tx.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('rejects when the promotion (not the coupon) is at its total usage limit', async () => {
    const { tx, state } = makeAtomicTx({
      couponUsageLimit: null,
      couponUsageCount: 0,
      promotionUsageLimit: 2,
      promotionUsageCount: 2,
    });

    await expect(service.redeemCouponInTx(tx, 'race1', 'user_1', 'order_1', 100)).rejects.toThrow(
      BadRequestException,
    );
    expect(state.promotionUsageCount).toBe(2);
    expect(tx.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('a failed redemption does not increment the coupon counter', async () => {
    const { tx, state } = makeAtomicTx({
      couponUsageLimit: 1,
      couponUsageCount: 1,
      promotionUsageLimit: null,
      promotionUsageCount: 0,
    });

    const before = state.couponUsageCount;
    await expect(service.redeemCouponInTx(tx, 'race1', 'user_1', 'order_1', 100)).rejects.toThrow();
    expect(state.couponUsageCount).toBe(before);
  });

  it('does not double-redeem for the same user/order (idempotency preserved)', async () => {
    const { tx, state } = makeAtomicTx({
      couponUsageLimit: 5,
      couponUsageCount: 0,
      promotionUsageLimit: null,
      promotionUsageCount: 0,
    });

    const first = await service.redeemCouponInTx(tx, 'race1', 'user_1', 'order_1', 100);
    const second = await service.redeemCouponInTx(tx, 'race1', 'user_1', 'order_1', 100);

    expect(second.id).toBe(first.id);
    expect(state.couponUsageCount).toBe(1); // only incremented once, not twice
    expect(tx.couponRedemption.create).toHaveBeenCalledTimes(1);
  });

  it('two concurrent attempts against usageLimit: 1 cannot both succeed', async () => {
    const { tx, state } = makeAtomicTx({
      couponUsageLimit: 1,
      couponUsageCount: 0,
      promotionUsageLimit: null,
      promotionUsageCount: 0,
    });

    const [r1, r2] = await Promise.allSettled([
      service.redeemCouponInTx(tx, 'race1', 'user_1', 'order_A', 100),
      service.redeemCouponInTx(tx, 'race1', 'user_2', 'order_B', 100),
    ]);

    const outcomes = [r1, r2];
    const succeeded = outcomes.filter((r) => r.status === 'fulfilled');
    const failed = outcomes.filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(state.couponUsageCount).toBe(1); // never exceeds the limit
    expect(tx.couponRedemption.create).toHaveBeenCalledTimes(1);
  });

  it('coupon not found is still rejected before any writes', async () => {
    const { tx } = makeAtomicTx({
      couponUsageLimit: 5,
      couponUsageCount: 0,
      promotionUsageLimit: null,
      promotionUsageCount: 0,
    });
    tx.couponCode.findUnique = vi.fn(async () => null);

    await expect(service.redeemCouponInTx(tx, 'nope', 'user_1', 'order_1', 100)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.couponRedemption.create).not.toHaveBeenCalled();
  });
});

describe('PromotionsService.validateAndApplyCoupon - eligibility checks unchanged', () => {
  function makePrisma(coupon: any) {
    return {
      couponCode: { findUnique: vi.fn().mockResolvedValue(coupon) },
      couponRedemption: { count: vi.fn().mockResolvedValue(0) },
    } as any;
  }

  function makeCoupon(overrides: any = {}) {
    return {
      id: 'coupon_1',
      code: 'SAVE10',
      isActive: true,
      usageLimit: null,
      usageCount: 0,
      perCustomerLimit: null,
      expiryDate: null,
      promotionId: 'promo_1',
      promotion: {
        id: 'promo_1',
        isActive: true,
        startDate: null,
        expiryDate: null,
        totalUsageLimit: null,
        usageCount: 0,
        perCustomerLimit: null,
        minSubtotal: null,
        type: 'fixed_amount',
        value: 500,
        maxDiscount: null,
        eligibleProductIds: '[]',
        eligibleCategoryIds: '[]',
        excludedProductIds: '[]',
        excludedCategoryIds: '[]',
      },
      ...overrides,
    };
  }

  it('rejects when the promotion has already reached its total usage limit', async () => {
    const prisma = makePrisma(
      makeCoupon({ promotion: { ...makeCoupon().promotion, totalUsageLimit: 10, usageCount: 10 } }),
    );
    const service = new PromotionsService(prisma);

    await expect(
      service.validateAndApplyCoupon('SAVE10', 'user_1', [{ productId: 'p1', quantity: 1, price: 1000 }], 1000),
    ).rejects.toThrow('This promotion has reached its usage limit');
  });

  it('rejects when no cart item is eligible for a restricted promotion', async () => {
    // Both eligibleProductIds and eligibleCategoryIds restricted - checkEligibility
    // treats an empty eligible*Ids array as "no restriction on that dimension", so
    // only restricting products would leave the item eligible via category.
    const prisma = makePrisma(
      makeCoupon({
        promotion: {
          ...makeCoupon().promotion,
          eligibleProductIds: JSON.stringify(['only-this-product']),
          eligibleCategoryIds: JSON.stringify(['only-this-category']),
        },
      }),
    );
    const service = new PromotionsService(prisma);

    await expect(
      service.validateAndApplyCoupon(
        'SAVE10',
        'user_1',
        [{ productId: 'other-product', categoryId: 'other-category', quantity: 1, price: 1000 }],
        1000,
      ),
    ).rejects.toThrow('No eligible items in cart for this promotion');
  });

  it('applies the discount when eligible', async () => {
    const prisma = makePrisma(makeCoupon());
    const service = new PromotionsService(prisma);

    const result = await service.validateAndApplyCoupon(
      'SAVE10',
      'user_1',
      [{ productId: 'p1', quantity: 1, price: 1000 }],
      1000,
    );

    expect(result.discountAmount).toBe(500);
    expect(result.finalSubtotal).toBe(500);
  });
});

/**
 * Pins the current SQLite-active search behavior for the admin voucher search
 * (name/code). See categories.service.spec.ts for the full rationale.
 * PostgreSQL cutover patch: add `mode: 'insensitive' as const` to both
 * `contains` filters once the schema provider switches.
 */
describe('PromotionsService.findAll - search filter (SQLite active, PostgreSQL cutover pending)', () => {
  it('builds a plain case-sensitivity-unaware contains filter on name/code', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { promotion: { findMany, count } } as any;
    const service = new PromotionsService(prisma);

    await service.findAll({ search: 'Mixed CASE' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'Mixed CASE' } },
            { code: { contains: 'Mixed CASE' } },
          ],
        }),
      }),
    );
  });
});
