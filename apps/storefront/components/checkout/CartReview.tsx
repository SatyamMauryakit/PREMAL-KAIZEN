'use client';

import { useCart } from '@/lib/cart-context';
import { useCheckout } from '@/lib/checkout-context';
import { useAuth } from '@/lib/auth-context';
import { formatPrice, formatPaise } from '@/lib/pricing';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCheckoutSettings } from '@/lib/checkout-settings';

export default function CartReview() {
  const { items } = useCart();
  const { goToStep, appliedCoupon, couponError, isApplyingCoupon, applyCoupon, removeCoupon } = useCheckout();
  const { user } = useAuth();
  const [couponInput, setCouponInput] = useState('');
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => {
    getCheckoutSettings().then((s) => setTaxRate(s.taxRate)).catch(() => setTaxRate(0));
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // discountAmount from validate-coupon is paise; convert to rupees for this
  // step-1 estimate (CartReview works in rupees; final authority is the backend).
  const discountRupees = Math.round((appliedCoupon?.discountAmount || 0) / 100);
  const discount = discountRupees;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round((taxable * taxRate) / 100);
  const total = taxable + tax;

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) return;
    if (!user) {
      return;
    }
    applyCoupon(
      couponInput.trim(),
      user.id,
      items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
      subtotal
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-black mb-6">Order Summary</h2>
          <div className="bg-white rounded-lg p-6 space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded" />
                <div className="flex-1">
                  <h3 className="font-medium text-black">{item.name}</h3>
                  {item.selectedSize && <p className="text-xs text-gray-600">Size: {item.selectedSize}</p>}
                  <p className="text-lg font-bold text-black mt-2">{formatPrice(item.price * item.quantity)}</p>
                  <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/cart" className="text-black font-medium hover:underline">
              ← Back to Cart
            </Link>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-cream rounded-lg p-6 sticky top-24">
            <h3 className="text-lg font-bold text-black mb-4">Totals</h3>

            {/* Voucher / Coupon */}
            <div className="mb-6">
              {!appliedCoupon ? (
                <>
                  {!user ? (
                    <p className="text-xs text-gray-600 mb-2">
                      <Link href="/auth/login" className="underline font-medium">Log in</Link> to apply a voucher code.
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          placeholder="Voucher code"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm uppercase focus:outline-none focus:border-black"
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={isApplyingCoupon || !couponInput.trim()}
                          className="px-4 py-2 border border-black text-black text-sm font-medium rounded hover:bg-black hover:text-cream transition-colors disabled:opacity-50"
                        >
                          {isApplyingCoupon ? '...' : 'Apply'}
                        </button>
                      </div>
                      {couponError && <p className="text-xs text-red-600 mt-2">{couponError}</p>}
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-green-800">{appliedCoupon.code} applied</p>
                    <p className="text-xs text-green-700">-{formatPaise(appliedCoupon.discountAmount)}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs text-green-800 underline">
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-medium text-black">{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Voucher discount</span>
                  <span className="font-medium">-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-700">Shipping</span>
                <span className="font-medium text-gray-500">Calculated at next step</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">{taxRate > 0 ? `GST (${taxRate}%)` : 'GST'}</span>
                <span className="font-medium text-black">{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between pt-4 border-t border-gray-300">
                <span className="font-bold text-black">Total (excl. shipping)</span>
                <span className="font-bold text-lg text-black">{formatPrice(total)}</span>
              </div>
            </div>
            <button
              onClick={() => goToStep('information')}
              className="w-full px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors"
            >
              CONTINUE TO INFO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
