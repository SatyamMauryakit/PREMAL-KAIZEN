'use client';

import { useCheckout } from '@/lib/checkout-context';

const steps = [
  { id: 'cart', label: 'Cart' },
  { id: 'information', label: 'Information' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
];

export default function CheckoutProgress() {
  const { currentStep } = useCheckout();
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center justify-between md:justify-start md:gap-4">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
              index <= currentIndex
                ? 'bg-black text-cream'
                : 'bg-gray-300 text-gray-600'
            }`}
          >
            {index + 1}
          </div>
          <div className={`hidden md:block ml-3 text-sm font-medium ${
            index <= currentIndex ? 'text-black' : 'text-gray-600'
          }`}>
            {step.label}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`hidden md:block w-12 h-1 mx-4 ${
                index < currentIndex ? 'bg-black' : 'bg-gray-300'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
