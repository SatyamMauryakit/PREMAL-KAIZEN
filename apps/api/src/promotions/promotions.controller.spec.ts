import { describe, it, expect, vi } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PromotionsController } from './promotions.controller';
import { AuthGuard } from '../common/guards/auth.guard';

function makeReq(userId: string) {
  return { user: { id: userId } };
}

describe('PromotionsController - coupon redemption authorization', () => {
  // Confirmed critical gap (fixed this phase): these two endpoints write a real
  // CouponRedemption row and increment usage counters, previously reachable by
  // anyone with no login at all, using whatever userId/orderId they put in the body.

  it('requires AuthGuard on redeemCoupon', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PromotionsController.prototype.redeemCoupon);
    expect(guards).toContain(AuthGuard);
  });

  it('requires AuthGuard on releaseCoupon', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PromotionsController.prototype.releaseCoupon);
    expect(guards).toContain(AuthGuard);
  });

  it('redeemCoupon uses the authenticated session user id, not a client-supplied one', async () => {
    const service = { redeemCoupon: vi.fn().mockResolvedValue({ id: 'redemption_1' }) };
    const controller = new PromotionsController(service as any);

    await controller.redeemCoupon(
      'promo_1',
      { couponCode: 'SAVE10', orderId: 'order_1', discountAmount: 500, userId: 'attacker-supplied-id' } as any,
      makeReq('real-session-user'),
    );

    expect(service.redeemCoupon).toHaveBeenCalledWith('SAVE10', 'real-session-user', 'order_1', 500);
  });

  it('releaseCoupon uses the authenticated session user id, not a client-supplied one', async () => {
    const service = { releaseRedemption: vi.fn().mockResolvedValue(undefined) };
    const controller = new PromotionsController(service as any);

    await controller.releaseCoupon(
      'promo_1',
      { couponCode: 'SAVE10', orderId: 'order_1', userId: 'attacker-supplied-id' } as any,
      makeReq('real-session-user'),
    );

    expect(service.releaseRedemption).toHaveBeenCalledWith('SAVE10', 'real-session-user', 'order_1');
  });

  it('validateCoupon remains unauthenticated (documented, pre-existing risk - read-only, no redemption)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PromotionsController.prototype.validateCoupon);
    expect(guards ?? []).not.toContain(AuthGuard);
  });
});
