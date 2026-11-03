import { describe, it, expect } from 'vitest';
import { PaymentsController } from '../../payments/payments.controller';
import { IdentityController } from '../../identity/identity.controller';

// @nestjs/throttler's decorators store metadata under THROTTLER_LIMIT/THROTTLER_SKIP
// concatenated with the throttler name (e.g. 'THROTTLER:LIMIT' + 'default'), each
// holding a plain value - confirmed against the installed 5.2.0's
// dist/throttler.decorator.js. Using the same literal keys directly rather than
// deep-importing the package's internal dist path, which could change between
// versions even though this metadata contract is stable.
const THROTTLER_LIMIT_DEFAULT = 'THROTTLER:LIMITdefault';
const THROTTLER_SKIP_DEFAULT = 'THROTTLER:SKIPdefault';

/**
 * Confirms the rate-limit wiring that matters most: the Razorpay webhook must never
 * be throttled (a dropped retry could leave a real order stuck unpaid), and the
 * brute-force-sensitive auth routes must carry a stricter-than-default limit.
 */
describe('rate-limit wiring', () => {
  it('exempts the Razorpay webhook handler from throttling entirely', () => {
    const skipped = Reflect.getMetadata(THROTTLER_SKIP_DEFAULT, PaymentsController.prototype.webhook);
    expect(skipped).toBe(true);
  });

  it('does not exempt payment verification or login from throttling', () => {
    expect(Reflect.getMetadata(THROTTLER_SKIP_DEFAULT, PaymentsController.prototype.verify)).toBeUndefined();
    expect(Reflect.getMetadata(THROTTLER_SKIP_DEFAULT, IdentityController.prototype.login)).toBeUndefined();
  });

  it('applies a stricter limit to payment verification than the global default (120/min)', () => {
    const limit = Reflect.getMetadata(THROTTLER_LIMIT_DEFAULT, PaymentsController.prototype.verify);
    expect(limit).toBeLessThan(120);
  });

  it('applies a strict limit to login (brute-force protection)', () => {
    const limit = Reflect.getMetadata(THROTTLER_LIMIT_DEFAULT, IdentityController.prototype.login);
    expect(limit).toBeLessThanOrEqual(10);
  });

  it('applies a strict limit to registration', () => {
    const limit = Reflect.getMetadata(THROTTLER_LIMIT_DEFAULT, IdentityController.prototype.register);
    expect(limit).toBeLessThanOrEqual(5);
  });

  it('applies a strict limit to password-reset requests (prevents reset-email spam)', () => {
    const limit = Reflect.getMetadata(
      THROTTLER_LIMIT_DEFAULT,
      IdentityController.prototype.requestPasswordReset,
    );
    expect(limit).toBeLessThanOrEqual(5);
  });
});
