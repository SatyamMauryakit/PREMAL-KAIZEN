'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCheckoutSettings, ShippingMethodOption } from '@/lib/checkout-settings';

export default function ShippingContent() {
  const [methods, setMethods] = useState<ShippingMethodOption[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getCheckoutSettings()
      .then((settings) => setMethods(settings.shippingMethods))
      .catch(() => setError(true));
  }, []);

  const formatPrice = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Breadcrumb */}
        <div className="mb-12 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Shipping Information</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-black mb-6">Shipping Information</h1>
        <p className="text-gray-dark text-lg leading-relaxed mb-12">
          We currently ship across India. Below are the delivery options available at checkout.
        </p>

        <div className="bg-white rounded-lg border border-gray-light p-8 mb-12">
          <h2 className="text-xl font-bold text-black mb-6">Delivery Options</h2>
          {error && (
            <p className="text-red-600">Could not load shipping options right now. Please try again later.</p>
          )}
          {!error && methods === null && (
            <p className="text-gray-medium">Loading shipping options...</p>
          )}
          {!error && methods !== null && methods.length === 0 && (
            <p className="text-gray-medium">No shipping options are configured yet. Please contact us for delivery details.</p>
          )}
          {!error && methods && methods.length > 0 && (
            <div className="space-y-4">
              {methods.map((method) => (
                <div key={method.id} className="flex justify-between items-start border-b border-gray-light pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-black">{method.name}</p>
                    {method.description && <p className="text-sm text-gray-medium mt-1">{method.description}</p>}
                  </div>
                  <p className="font-semibold text-black whitespace-nowrap ml-4">
                    {method.freeShippingThreshold
                      ? `${formatPrice(method.price)} (free above ${formatPrice(method.freeShippingThreshold)})`
                      : formatPrice(method.price)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 text-gray-dark leading-relaxed">
          <p>
            Delivery timelines shown at checkout are estimates and may vary based on your location and courier
            availability. You can track the status of your order anytime from{' '}
            <Link href="/orders" className="text-black underline hover:no-underline">Track Order</Link>.
          </p>
          <p>
            Have a question about delivery to your area? <Link href="/contact" className="text-black underline hover:no-underline">Contact us</Link> and we'll help.
          </p>
        </div>
      </div>
    </div>
  );
}
