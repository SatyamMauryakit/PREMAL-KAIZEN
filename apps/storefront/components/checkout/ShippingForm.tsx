'use client';

import { useCheckout, ShippingAddress } from '@/lib/checkout-context';
import { useEffect, useState } from 'react';
import { INDIAN_STATES, isValidIndianPincode, isValidIndianMobile, formatINR } from '@/lib/india';
import { getCheckoutSettings, ShippingMethodOption } from '@/lib/checkout-settings';

export default function ShippingForm() {
  const { goToStep, updateShippingAddress, setShippingMethod, shippingAddress, shippingMethod, setError } = useCheckout();
  const [form, setForm] = useState<ShippingAddress>(shippingAddress || {
    firstName: '', lastName: '', phoneNumber: '', street1: '', street2: '', landmark: '', city: '', state: '', postalCode: '', country: 'India'
  });
  const [methods, setMethods] = useState<ShippingMethodOption[]>([]);
  const [methodsError, setMethodsError] = useState<string | null>(null);

  useEffect(() => {
    getCheckoutSettings()
      .then((settings) => {
        setMethods(settings.shippingMethods);
        if (settings.shippingMethods.length > 0 && !shippingMethod) {
          setShippingMethod(settings.shippingMethods[0].id);
        }
      })
      .catch(() => setMethodsError('Could not load shipping options. Please refresh and try again.'));
  }, []);

  const handleNext = () => {
    if (!form.firstName || !form.lastName || !form.street1 || !form.city || !form.state || !form.postalCode) {
      setError('Please fill in all required fields');
      return;
    }
    if (!isValidIndianMobile(form.phoneNumber)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!isValidIndianPincode(form.postalCode)) {
      setError('Enter a valid 6-digit PIN code');
      return;
    }
    if (methods.length > 0 && !shippingMethod) {
      setError('Please select a shipping method');
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

          <input type="tel" placeholder="Mobile Number * (e.g. 98765 43210)" value={form.phoneNumber} onChange={(e) => setForm({...form, phoneNumber: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />

          <input type="text" placeholder="Flat / House No., Building *" value={form.street1} onChange={(e) => setForm({...form, street1: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />

          <input type="text" placeholder="Area, Street (optional)" value={form.street2} onChange={(e) => setForm({...form, street2: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" />

          <input type="text" placeholder="Landmark (optional)" value={form.landmark} onChange={(e) => setForm({...form, landmark: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" />

          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="City *" value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" required />
            <select value={form.state} onChange={(e) => setForm({...form, state: e.target.value})} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige bg-white" required>
              <option value="">State / UT *</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <input type="text" placeholder="PIN Code * (6 digits)" value={form.postalCode} onChange={(e) => setForm({...form, postalCode: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige" maxLength={6} required />

          <div className="pt-6 border-t">
            <h3 className="font-bold text-black mb-4">Shipping Method</h3>
            {methodsError && <p className="text-red-600 text-sm mb-3">{methodsError}</p>}
            {!methodsError && methods.length === 0 && (
              <p className="text-gray-500 text-sm">No shipping methods are configured yet. Please contact support.</p>
            )}
            <div className="space-y-3">
              {methods.map((method) => (
                <label key={method.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 cursor-pointer">
                  <span className="flex items-center">
                    <input type="radio" name="shipping" checked={shippingMethod === method.id} onChange={() => setShippingMethod(method.id)} className="mr-3" />
                    <span>
                      <span className="block font-medium">{method.name}</span>
                      {method.description && <span className="block text-sm text-gray-500">{method.description}</span>}
                    </span>
                  </span>
                  <span className="font-medium">
                    {method.freeShippingThreshold ? `From ${formatINR(method.price)} (free above ${formatINR(method.freeShippingThreshold)})` : formatINR(method.price)}
                  </span>
                </label>
              ))}
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
