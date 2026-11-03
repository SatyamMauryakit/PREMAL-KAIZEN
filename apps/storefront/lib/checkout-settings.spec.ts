import { describe, it, expect } from 'vitest';
import { calculateTax, calculateShipping, CheckoutSettings, ShippingMethodOption } from './checkout-settings';

function makeSettings(overrides: Partial<CheckoutSettings> = {}): CheckoutSettings {
  return {
    shippingMethods: [],
    taxRate: 18,
    taxMode: 'exclusive',
    razorpayEnabled: true,
    codEnabled: true,
    guestCheckoutEnabled: true,
    minimumOrderValue: 0,
    maintenanceMode: false,
    ...overrides,
  };
}

describe('calculateTax', () => {
  it('returns 0 when taxRate is 0', () => {
    expect(calculateTax(10000, makeSettings({ taxRate: 0 }))).toBe(0);
  });

  it('computes exclusive tax as a straightforward percentage on top of the amount', () => {
    // 18% exclusive GST on 10000 paise -> 1800 paise added on top
    expect(calculateTax(10000, makeSettings({ taxRate: 18, taxMode: 'exclusive' }))).toBe(1800);
  });

  it('computes inclusive tax as the portion already embedded in the amount', () => {
    // 18% inclusive GST on 11800 paise (which already contains the tax) -> extracts 1800
    expect(calculateTax(11800, makeSettings({ taxRate: 18, taxMode: 'inclusive' }))).toBe(1800);
  });

  it('rounds to the nearest paisa rather than leaving fractional currency', () => {
    const result = calculateTax(999, makeSettings({ taxRate: 18, taxMode: 'exclusive' }));
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('calculateShipping', () => {
  const standard: ShippingMethodOption = {
    id: 'standard',
    name: 'Standard Shipping',
    price: 5000,
    enabled: true,
  };

  it('returns 0 when no shipping method is selected yet', () => {
    expect(calculateShipping(10000, undefined)).toBe(0);
  });

  it('charges the method\'s configured price when under the free-shipping threshold', () => {
    expect(calculateShipping(10000, standard)).toBe(5000);
  });

  it('waives shipping once the subtotal meets the free-shipping threshold', () => {
    const withThreshold = { ...standard, freeShippingThreshold: 100000 };
    expect(calculateShipping(150000, withThreshold)).toBe(0);
  });

  it('does not waive shipping when the subtotal is just under the threshold', () => {
    const withThreshold = { ...standard, freeShippingThreshold: 100000 };
    expect(calculateShipping(99999, withThreshold)).toBe(5000);
  });

  it('charges the full price when no free-shipping threshold is configured at all', () => {
    expect(calculateShipping(1000000, standard)).toBe(5000);
  });
});
