'use client';

import { useCart } from '@/lib/cart-context';
import { useCheckout } from '@/lib/checkout-context';
import { formatPrice } from '@/lib/pricing';
import { useState } from 'react';

export default function OrderReview() {
  const { items, clearCart } = useCart();
  const { goToStep, shippingAddress, paymentMethod, setError } = useCheckout();
  const [isPlacing, setIsPlacing] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 10000 ? 0 : 100;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shipping + tax;

  const handlePlaceOrder = async () => {
    setIsPlacing(true);
    try {
      // TODO: Call backend API to create order
      // const response = await fetch('/api/orders', { method: 'POST', body: JSON.stringify({...}) });
      // if (!response.ok) throw new Error('Order failed');

      // Simulate order creation
      await new Promise(r => setTimeout(r, 1500));

      clearCart();
      window.location.href = `/order-confirmation/${Math.random().toString(36).substr(2, 9)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
      setIsPlacing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-black mb-6">Order Review</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Shipping Address */}
        <div className="bg-white rounded-lg p-6">
          <h3 className="font-bold text-black mb-4">Shipping Address</h3>
          {shippingAddress && (
            <div className="text-sm text-gray-700 space-y-1">
              <p>{shippingAddress.firstName} {shippingAddress.lastName}</p>
              <p>{shippingAddress.street1}</p>
              {shippingAddress.street2 && <p>{shippingAddress.street2}</p>}
              <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}</p>
              <p>{shippingAddress.phoneNumber}</p>
            </div>
          )}
          <button onClick={() => goToStep('shipping')} className="text-black font-medium hover:underline text-sm mt-4">Edit</button>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-lg p-6">
          <h3 className="font-bold text-black mb-4">Payment Method</h3>
          <p className="text-sm text-gray-700 capitalize mb-4">{paymentMethod || 'Not selected'}</p>
          <p className="text-xs text-gray-600 mb-4">Your payment will be securely processed.</p>
          <button onClick={() => goToStep('payment')} className="text-black font-medium hover:underline text-sm">Edit</button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-white rounded-lg p-6 mb-8">
        <h3 className="font-bold text-black mb-4">Order Summary</h3>
        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between pb-4 border-b last:border-0">
              <div><p className="font-medium text-black">{item.name}</p><p className="text-xs text-gray-600">Qty: {item.quantity}</p></div>
              <p className="font-medium text-black">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
          <div className="flex justify-between text-gray-700"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span></div>
          <div className="flex justify-between text-gray-700"><span>Tax (18%)</span><span>{formatPrice(tax)}</span></div>
          <div className="flex justify-between pt-2 border-t font-bold text-black"><span>Total</span><span>{formatPrice(total)}</span></div>
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => goToStep('payment')} className="flex-1 px-4 py-3 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors" disabled={isPlacing}>BACK</button>
        <button onClick={handlePlaceOrder} className="flex-1 px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors disabled:bg-gray-400" disabled={isPlacing}>{isPlacing ? 'PLACING ORDER...' : 'PLACE ORDER'}</button>
      </div>
    </div>
  );
}
