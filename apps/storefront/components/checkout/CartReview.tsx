'use client';

import { useCart } from '@/lib/cart-context';
import { useCheckout } from '@/lib/checkout-context';
import { formatPrice } from '@/lib/pricing';
import Link from 'next/link';

export default function CartReview() {
  const { items } = useCart();
  const { goToStep } = useCheckout();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 10000 ? 0 : 100;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shipping + tax;

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
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-medium text-black">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Shipping</span>
                <span className="font-medium text-black">{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Tax (18%)</span>
                <span className="font-medium text-black">{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between pt-4 border-t border-gray-300">
                <span className="font-bold text-black">Total</span>
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
