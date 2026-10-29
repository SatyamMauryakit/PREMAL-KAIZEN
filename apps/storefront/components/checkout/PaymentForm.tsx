'use client';

import { useCheckout } from '@/lib/checkout-context';

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit/Debit Card', icon: '💳' },
  { id: 'upi', label: 'UPI', icon: '📱' },
  { id: 'netbanking', label: 'Net Banking', icon: '🏦' },
  { id: 'cod', label: 'Cash on Delivery', icon: '💵' },
];

export default function PaymentForm() {
  const { goToStep, setPaymentMethod, paymentMethod, setError } = useCheckout();

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
          {PAYMENT_METHODS.map((method) => (
            <label key={method.id} className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:border-black transition-colors" style={{borderColor: paymentMethod === method.id ? '#000' : '#ddd'}}>
              <input type="radio" name="payment" checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id as any)} className="mr-4" />
              <span className="text-2xl mr-3">{method.icon}</span>
              <span className="font-medium text-black">{method.label}</span>
            </label>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-8">
          <p className="text-sm text-blue-700"><strong>Note:</strong> Secure payment processing. Your card details are encrypted and never stored.</p>
        </div>

        <div className="flex gap-4">
          <button onClick={() => goToStep('shipping')} className="flex-1 px-4 py-3 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors">BACK</button>
          <button onClick={handleNext} className="flex-1 px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors">REVIEW ORDER</button>
        </div>
      </div>
    </div>
  );
}
