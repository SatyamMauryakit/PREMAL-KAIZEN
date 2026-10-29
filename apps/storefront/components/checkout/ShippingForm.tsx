'use client';

import { useCheckout, ShippingAddress } from '@/lib/checkout-context';
import { useState } from 'react';

export default function ShippingForm() {
  const { goToStep, updateShippingAddress, setShippingMethod, shippingAddress, setError } = useCheckout();
  const [form, setForm] = useState<ShippingAddress>(shippingAddress || {
    firstName: '', lastName: '', phoneNumber: '', street1: '', street2: '', city: '', state: '', postalCode: '', country: 'India'
  });

  const handleNext = () => {
    if (!form.firstName || !form.lastName || !form.street1 || !form.city || !form.state || !form.postalCode) {
      setError('Please fill in all required fields');
      return;
    }
    updateShippingAddress(form);
    goToStep('payment');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-black mb-6">Shipping Address</h2>
      <div className="bg-white rounded-lg p-8">
        <div className="space-y-6">
          {/* Shipping form fields */}
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="First Name *" value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />
            <input type="text" placeholder="Last Name *" value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />
          </div>

          <input type="tel" placeholder="Phone Number *" value={form.phoneNumber} onChange={(e) => setForm({...form, phoneNumber: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />

          <input type="text" placeholder="Street Address *" value={form.street1} onChange={(e) => setForm({...form, street1: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />

          <input type="text" placeholder="Apartment, Suite, etc." value={form.street2} onChange={(e) => setForm({...form, street2: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" />

          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="City *" value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />
            <input type="text" placeholder="State *" value={form.state} onChange={(e) => setForm({...form, state: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />
          </div>

          <input type="text" placeholder="Postal Code *" value={form.postalCode} onChange={(e) => setForm({...form, postalCode: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />

          <div className="pt-6 border-t">
            <h3 className="font-bold text-black mb-4">Shipping Method</h3>
            <div className="space-y-3">
              <label className="flex items-center"><input type="radio" name="shipping" onChange={() => setShippingMethod('standard')} className="mr-2" /> Standard (Free)</label>
              <label className="flex items-center"><input type="radio" name="shipping" onChange={() => setShippingMethod('express')} className="mr-2" /> Express (+$50)</label>
              <label className="flex items-center"><input type="radio" name="shipping" onChange={() => setShippingMethod('overnight')} className="mr-2" /> Overnight (+$100)</label>
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button onClick={() => goToStep('information')} className="flex-1 px-4 py-3 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors">BACK</button>
            <button onClick={handleNext} className="flex-1 px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors">CONTINUE TO PAYMENT</button>
          </div>
        </div>
      </div>
    </div>
  );
}
