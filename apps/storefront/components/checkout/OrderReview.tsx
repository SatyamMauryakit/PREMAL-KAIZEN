'use client';

import { useCart } from '@/lib/cart-context';
import { useCheckout } from '@/lib/checkout-context';
import { useAuth } from '@/lib/auth-context';
import { formatPrice, formatPaise } from '@/lib/pricing';
import { useEffect, useState } from 'react';
import { getCheckoutSettings, calculateTax, calculateShipping, CheckoutSettings } from '@/lib/checkout-settings';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export default function OrderReview() {
  const { items } = useCart();
  const { goToStep, shippingAddress, paymentMethod, shippingMethod, appliedCoupon, setError } = useCheckout();
  const { user } = useAuth();
  const [isPlacing, setIsPlacing] = useState(false);
  const [settings, setSettings] = useState<CheckoutSettings | null>(null);

  useEffect(() => {
    getCheckoutSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  // Cart stores prices in rupees (integer). calculateShipping and calculateTax
  // expect paise (the unit the settings API returns). Convert once here so the
  // entire checkout summary is consistent with what the backend will compute.
  const subtotalRupees = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotalPaise = subtotalRupees * 100;
  // Coupon discountAmount comes back from the validate-coupon API in paise
  // (PromotionsService computes discounts against a paise-based subtotal).
  const discountPaise = appliedCoupon?.discountAmount || 0;
  const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
  const selectedMethod = settings?.shippingMethods.find((m) => m.id === shippingMethod);
  const shippingPaise = settings ? calculateShipping(subtotalPaise, selectedMethod) : 0;
  const taxPaise = settings ? calculateTax(taxablePaise, settings) : 0;
  const totalPaise = taxablePaise + taxPaise + shippingPaise;

  // For display we keep using formatPrice (rupees) since these are all now in paise.
  // formatPaise divides by 100 before formatting.
  const subtotal = subtotalRupees; // kept for item display (cart is in rupees)
  const discount = discountPaise;
  const taxable = taxablePaise;
  const shipping = shippingPaise;
  const tax = taxPaise;
  const total = totalPaise;

  const handlePlaceOrder = async () => {
    setIsPlacing(true);
    setError(null);
    try {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        throw new Error('Please log in to place an order.');
      }
      if (!shippingAddress) {
        throw new Error('Please add a shipping address.');
      }

      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            selectedSize: i.selectedSize,
            selectedColor: i.selectedColor,
          })),
          couponCode: appliedCoupon?.code,
          paymentMethod,
          shippingMethod,
          shippingAddress,
        }),
      });

      const order = await response.json();
      if (!response.ok) {
        throw new Error(order.message || 'Failed to place order');
      }

      // COD: the order is already placed and confirmed - no payment step needed.
      // The cart is cleared on the confirmation page itself, not here - clearing it
      // on this page raced against checkout's own "redirect to /cart when empty"
      // effect and could bounce the customer to an empty cart instead.
      if (!order.razorpay) {
        window.location.href = `/order-confirmation/${order.id}`;
        return;
      }

      // Online payment: open Razorpay Checkout for the order the server just created.
      // A successful callback here is NOT proof of payment on its own - it is only
      // sent to the server's /verify endpoint, which independently confirms the
      // signature and the payment's real amount/status with Razorpay before the
      // order is ever marked paid.
      let paymentResult;
      try {
        paymentResult = await openRazorpayCheckout({
          keyId: order.razorpay.keyId,
          razorpayOrderId: order.razorpay.orderId,
          amount: order.razorpay.amount,
          currency: order.razorpay.currency,
          orderNumber: order.orderNumber,
          customerName: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
          customerEmail: user?.email,
          customerPhone: shippingAddress.phoneNumber,
        });
      } catch (checkoutErr) {
        // Payment was cancelled or failed client-side. The order remains pending/
        // unpaid in the database (not deleted) - it is not marked paid here, and
        // no confirmation email has been sent.
        throw new Error(checkoutErr instanceof Error ? checkoutErr.message : 'Payment was not completed.');
      }

      const verifyResponse = await fetch(`${API_BASE}/api/payments/razorpay/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature,
        }),
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyResult.message || 'Payment could not be verified. Please contact support with your order number.');
      }

      window.location.href = `/order-confirmation/${order.id}`;
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
              {shippingAddress.landmark && <p>Near {shippingAddress.landmark}</p>}
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
          <p className="text-xs text-gray-600 mb-4">
            {paymentMethod === 'cod'
              ? 'Pay in cash or by UPI when your order is delivered.'
              : 'Your payment will be processed by our payment partner at checkout.'}
          </p>
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
          {discount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Voucher ({appliedCoupon?.code})</span><span>-{formatPaise(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-700"><span>Shipping{selectedMethod ? ` (${selectedMethod.name})` : ''}</span><span>{shipping === 0 ? 'FREE' : formatPaise(shipping)}</span></div>
          <div className="flex justify-between text-gray-700"><span>{settings && settings.taxRate > 0 ? `GST (${settings.taxRate}%)` : 'GST'}</span><span>{formatPaise(tax)}</span></div>
          <div className="flex justify-between pt-2 border-t font-bold text-black"><span>Total</span><span>{formatPaise(total)}</span></div>
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => goToStep('payment')} className="flex-1 px-4 py-3 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors" disabled={isPlacing}>BACK</button>
        <button onClick={handlePlaceOrder} className="flex-1 px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors disabled:bg-gray-400" disabled={isPlacing}>{isPlacing ? 'PLACING ORDER...' : 'PLACE ORDER'}</button>
      </div>
    </div>
  );
}
