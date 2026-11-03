'use client';

import { useCheckout } from '@/lib/checkout-context';
import { useEffect, useState } from 'react';
import { getCheckoutSettings } from '@/lib/checkout-settings';

export default function PaymentForm() {
  const { goToStep, setPaymentMethod, paymentMethod, setError } = useCheckout();
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [codEnabled, setCodEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCheckoutSettings()
      .then((s) => {
        setRazorpayEnabled(s.razorpayEnabled);
        setCodEnabled(s.codEnabled);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Card, UPI, and Net Banking are all offered through Razorpay Checkout once
  // Razorpay is enabled - which specific methods a customer sees is controlled by
  // the Razorpay account's own configuration, not toggled individually here.
  const methods = [
    { id: 'card', label: 'Credit/Debit Card', icon: '💳', available: razorpayEnabled },
    { id: 'upi', label: 'UPI', icon: '📱', available: razorpayEnabled },
    { id: 'netbanking', label: 'Net Banking', icon: '🏦', available: razorpayEnabled },
    { id: 'cod', label: 'Cash on Delivery', icon: '💵', available: codEnabled },
  ];
  const anyMethodAvailable = methods.some((m) => m.available);

  const handleNext = () => {
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }
    goToStep('review');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-black mb-6">Payment Method</h2>
      <div className="bg-white rounded-lg p-8">
        <div className="space-y-4 mb-8">
          {methods.map((method) => (
            <label
              key={method.id}
              className={`flex items-center justify-between p-4 border-2 rounded-lg transition-colors ${method.available ? 'cursor-pointer hover:border-black' : 'cursor-not-allowed opacity-50'}`}
              style={{ borderColor: paymentMethod === method.id ? '#000' : '#ddd' }}
            >
              <span className="flex items-center">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === method.id}
                  disabled={!method.available}
                  onChange={() => setPaymentMethod(method.id as 'card' | 'upi' | 'netbanking' | 'cod')}
                  className="mr-4"
                />
                <span className="text-2xl mr-3">{method.icon}</span>
                <span className="font-medium text-black">{method.label}</span>
              </span>
              {loaded && !method.available && <span className="text-xs text-gray-500">Not yet available</span>}
            </label>
          ))}
        </div>

        {loaded && !anyMethodAvailable ? (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-8">
            <p className="text-sm text-red-700">
              Checkout is temporarily unavailable - no payment method is currently configured for this store.
              Please check back shortly or contact support.
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-8">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong>{' '}
              {paymentMethod === 'cod'
                ? 'No payment is taken now - pay in cash or by UPI when your order arrives.'
                : razorpayEnabled
                  ? 'Your card and payment details are handled directly by Razorpay and are never stored on our servers.'
                  : 'Online payment is not yet configured for this store. Please choose Cash on Delivery to continue.'}
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button onClick={() => goToStep('shipping')} className="flex-1 px-4 py-3 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors">BACK</button>
          <button onClick={handleNext} className="flex-1 px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors">REVIEW ORDER</button>
        </div>
      </div>
    </div>
  );
}
