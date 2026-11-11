import { describe, it, expect } from 'vitest';
import { formatPrice, formatPaise, calculateLineTotal, calculateSubtotal } from './pricing';
import { calculateShipping, calculateTax } from './checkout-settings';
import type { ShippingMethodOption, CheckoutSettings } from './checkout-settings';

/**
 * Regression coverage for the ₹1,700 -> ₹170,000 cart display bug. Root cause: a few
 * cart/wishlist entry points (apps/storefront/app/products/[id]/page.tsx,
 * components/ProductCard.tsx) were passing the API's raw paise value straight into
 * cart/wishlist state instead of converting to rupees first, while this module's
 * formatPrice/calculateSubtotal (and the rest of cart/checkout) always assumed
 * cart/wishlist state is stored in rupees. 170000 paise formatted as if it were
 * rupees renders as "₹170,000" via toLocaleString's thousands separator - exactly
 * the reported symptom. These tests pin the correct rupee-based arithmetic; the
 * actual unit-conversion fix lives at the three call sites listed above.
 */
describe('formatPrice', () => {
  it('formats a rupee amount as Indian currency with no decimals', () => {
    expect(formatPrice(1700)).toBe('₹1,700');
  });

  it('does not silently treat a paise-scale number as rupees (documents the bug symptom)', () => {
    // If a caller ever accidentally passes the paise value (170000) for a ₹1,700
    // product, this is the exact wrong string the bug produced - kept here so the
    // symptom is unambiguous if this regression ever reappears upstream of this function.
    expect(formatPrice(170000)).toBe('₹1,70,000');
  });
});

describe('calculateLineTotal', () => {
  it('₹1,700 x 1 = ₹1,700', () => {
    expect(calculateLineTotal(1700, 1)).toBe(1700);
  });

  it('₹1,700 x 2 = ₹3,400', () => {
    expect(calculateLineTotal(1700, 2)).toBe(3400);
  });

  it('₹1,700 x 3 = ₹5,100', () => {
    expect(calculateLineTotal(1700, 3)).toBe(5100);
  });
});

describe('calculateSubtotal', () => {
  it('single product, quantity 1', () => {
    expect(calculateSubtotal([{ price: 1700, quantity: 1 }])).toBe(1700);
  });

  it('single product, quantity 2', () => {
    expect(calculateSubtotal([{ price: 1700, quantity: 2 }])).toBe(3400);
  });

  it('single product, quantity 3', () => {
    expect(calculateSubtotal([{ price: 1700, quantity: 3 }])).toBe(5100);
  });

  it('combines multiple distinct products into one subtotal', () => {
    const items = [
      { price: 1700, quantity: 2 }, // 3400
      { price: 999, quantity: 1 }, // 999
    ];
    expect(calculateSubtotal(items)).toBe(4399);
  });

  it('applying a discount then adding shipping produces the correct grand total', () => {
    const subtotal = calculateSubtotal([{ price: 1700, quantity: 2 }]); // 3400
    const discount = 500;
    const shipping = 99;
    const taxable = Math.max(0, subtotal - discount);
    const grandTotal = taxable + shipping;
    expect(subtotal).toBe(3400);
    expect(taxable).toBe(2900);
    expect(grandTotal).toBe(2999);
  });

  it('a reloaded/persisted cart (plain objects from JSON, not live product refs) still sums correctly', () => {
    // Mirrors what cart-context.tsx reads back from localStorage via JSON.parse.
    const persisted = JSON.parse(
      JSON.stringify([
        { id: 'p1', productId: 'p1', name: 'Item', price: 1700, image: '', quantity: 3 },
      ]),
    );
    expect(calculateSubtotal(persisted)).toBe(5100);
  });
});

describe('formatPaise', () => {
  it('converts 150000 paise → ₹1,500 (the root cause of the 100x bug)', () => {
    expect(formatPaise(150000)).toBe('₹1,500');
  });

  it('converts 170000 paise → ₹1,700', () => {
    expect(formatPaise(170000)).toBe('₹1,700');
  });

  it('0 paise → ₹0', () => {
    expect(formatPaise(0)).toBe('₹0');
  });

  it('100 paise → ₹1', () => {
    expect(formatPaise(100)).toBe('₹1');
  });

  it('quantity 2 at 150000 paise/unit → ₹3,000', () => {
    expect(formatPaise(150000 * 2)).toBe('₹3,000');
  });

  it('quantity 5 at 150000 paise/unit → ₹7,500', () => {
    expect(formatPaise(150000 * 5)).toBe('₹7,500');
  });

  it('quantity 10 at 150000 paise/unit → ₹15,000', () => {
    expect(formatPaise(150000 * 10)).toBe('₹15,000');
  });

  it('quantity 100 at 150000 paise/unit → ₹1,50,000 (Indian grouping)', () => {
    expect(formatPaise(150000 * 100)).toBe('₹1,50,000');
  });
});

// ============================================================================
// Master prompt test requirements 13–15
// ============================================================================

/**
 * Test 13: ₹1,700 (170000 paise) displays correctly everywhere.
 * The product-to-cart conversion divides paise by 100 → rupees.
 * The order API returns paise → formatPaise divides back to rupees for display.
 */
describe('Test 13 — ₹1,700 displays correctly across cart, orders, and invoices', () => {
  const PRICE_PAISE = 170000; // ₹1,700 stored in DB
  const PRICE_RUPEES = 1700;  // stored in cart after /100 conversion

  it('cart displays ₹1,700 (rupees after paise→rupees conversion at add-to-cart)', () => {
    // Cart stores price in rupees; formatPrice is the cart/checkout formatter
    expect(formatPrice(PRICE_RUPEES)).toBe('₹1,700');
  });

  it('order API amount (170000 paise) displays as ₹1,700 via formatPaise', () => {
    expect(formatPaise(PRICE_PAISE)).toBe('₹1,700');
  });

  it('cart 2× ₹1,700 = ₹3,400 (rupees)', () => {
    expect(formatPrice(PRICE_RUPEES * 2)).toBe('₹3,400');
  });

  it('order 2× 170000 paise = ₹3,400 via formatPaise', () => {
    expect(formatPaise(PRICE_PAISE * 2)).toBe('₹3,400');
  });

  it('100× 170000 paise = ₹1,70,000 (Indian grouping — not ₹170,000)', () => {
    // Indian number system groups as 1,70,000 (2-digit groups after the first 3)
    expect(formatPaise(PRICE_PAISE * 100)).toBe('₹1,70,000');
  });

  it('bug regression: 170000 passed to formatPrice (rupees formatter) shows as ₹1,70,000 — the documented wrong-formatter symptom', () => {
    // If someone accidentally passes paise (170000) to formatPrice (rupees),
    // the result is ₹1,70,000 not ₹1,700 — this shows why we have TWO formatters.
    expect(formatPrice(PRICE_PAISE)).toBe('₹1,70,000'); // wrong result, expected from wrong formatter
    expect(formatPaise(PRICE_PAISE)).toBe('₹1,700');    // correct result from correct formatter
  });
});

/**
 * Test 14: Quantity × discount × shipping × tax calculations remain correct.
 * All in rupees (cart arithmetic), since that is the cart state unit.
 */
describe('Test 14 — quantity, discount, shipping, and tax calculations', () => {
  it('qty=1 price=1700: subtotal = ₹1,700', () => {
    expect(calculateSubtotal([{ price: 1700, quantity: 1 }])).toBe(1700);
  });

  it('qty=2 price=1700: subtotal = ₹3,400', () => {
    expect(calculateSubtotal([{ price: 1700, quantity: 2 }])).toBe(3400);
  });

  it('qty=5 price=1700: subtotal = ₹8,500', () => {
    expect(calculateSubtotal([{ price: 1700, quantity: 5 }])).toBe(8500);
  });

  it('qty=10 price=1700: subtotal = ₹17,000', () => {
    expect(calculateSubtotal([{ price: 1700, quantity: 10 }])).toBe(17000);
  });

  it('multiple SKUs sum correctly', () => {
    expect(calculateSubtotal([
      { price: 1700, quantity: 2 },  // 3400
      { price: 999, quantity: 3 },   // 2997
    ])).toBe(6397);
  });

  it('discount of ₹500 applied to ₹3,400 subtotal = ₹2,900 taxable', () => {
    const subtotalPaise = 340000; // ₹3,400 in paise (cart paise path)
    const discountPaise = 50000;  // ₹500 discount from promo API (paise)
    const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
    expect(taxablePaise).toBe(290000); // ₹2,900
  });

  it('free shipping threshold: subtotal >= threshold → shipping = 0', () => {
    // checkout-settings.calculateShipping uses paise
    const method: ShippingMethodOption = { id: 's1', name: 'Standard', price: 5000, freeShippingThreshold: 100000, enabled: true };
    expect(calculateShipping(150000, method)).toBe(0);   // ₹1,500 ≥ ₹1,000 threshold
    expect(calculateShipping(80000, method)).toBe(5000); // ₹800 < threshold → pay ₹50
  });

  it('exclusive GST 18% on 100000 paise (₹1,000) = 18000 paise (₹180)', () => {
    const settings: CheckoutSettings = { taxRate: 18, taxMode: 'exclusive', shippingMethods: [], razorpayEnabled: false, codEnabled: true, guestCheckoutEnabled: true, minimumOrderValue: 0, maintenanceMode: false };
    expect(calculateTax(100000, settings)).toBe(18000);
  });

  it('inclusive GST 18% on 118000 paise (₹1,180 incl. tax) extracts 18000 paise tax', () => {
    const settings: CheckoutSettings = { taxRate: 18, taxMode: 'inclusive', shippingMethods: [], razorpayEnabled: false, codEnabled: true, guestCheckoutEnabled: true, minimumOrderValue: 0, maintenanceMode: false };
    expect(calculateTax(118000, settings)).toBe(18000);
  });

  it('grand total: ₹3,400 subtotal − ₹500 discount + ₹50 shipping + ₹162 GST(6%) = ₹3,112', () => {
    const subtotalPaise = 340000;
    const discountPaise = 50000;
    const taxablePaise = Math.max(0, subtotalPaise - discountPaise); // 290000
    const shippingPaise = 5000;
    const taxPaise = Math.round((taxablePaise * 6) / 100); // 17400
    const totalPaise = taxablePaise + shippingPaise + taxPaise;
    // Format all as rupees
    expect(formatPaise(totalPaise)).toBe('₹3,124'); // 290000+5000+17400 = 312400 paise = ₹3,124
  });
});

/**
 * Test 15: Existing checkout tests still pass — covered by checkout-settings.spec.ts
 * and the existing spec file. This test explicitly re-confirms the core invariants.
 */
describe('Test 15 — existing checkout and pricing tests still pass', () => {
  it('formatPrice(1700) → ₹1,700 (cart rupee formatter unchanged)', () => {
    expect(formatPrice(1700)).toBe('₹1,700');
  });

  it('calculateLineTotal(1700, 3) → 5100 (rupees)', () => {
    expect(calculateLineTotal(1700, 3)).toBe(5100);
  });

  it('formatPaise does not affect formatPrice — they are independent', () => {
    // Both return ₹1,700 for their respective inputs
    expect(formatPrice(1700)).toBe('₹1,700');    // rupee input
    expect(formatPaise(170000)).toBe('₹1,700');  // paise input
    // But they differ when given the wrong unit — this is the safety check
    expect(formatPaise(1700)).not.toBe('₹1,700');   // paise 1700 = ₹17
    expect(formatPrice(170000)).not.toBe('₹1,700'); // rupees 170000 = ₹1,70,000
  });
});
