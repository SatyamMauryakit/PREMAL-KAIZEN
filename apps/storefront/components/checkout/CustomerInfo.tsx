'use client';

import { useCheckout } from '@/lib/checkout-context';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';

export default function CustomerInfo() {
  const { user } = useAuth();
  const { goToStep, setError } = useCheckout();
  const [email, setEmail] = useState(user?.email || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState('');

  const handleNext = () => {
    if (!email || !firstName || !lastName || !phone) {
      setError('Please fill in all required fields');
      return;
    }
    goToStep('shipping');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-black mb-6">Contact Information</h2>
      <div className="bg-white rounded-lg p-8">
        <div className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige"
                required
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige"
              placeholder="+91 98765 43210"
              required
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button
              onClick={() => goToStep('cart')}
              className="flex-1 px-4 py-3 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors"
            >
              BACK
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors"
            >
              CONTINUE TO SHIPPING
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
