'use client';

import { Header } from '@/components/Header';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Settings" subtitle="Configure store settings and preferences." />

      <div className="p-6 max-w-4xl">
        <div className="space-y-6">
          {/* Store Settings */}
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h2 className="text-lg font-bold text-black mb-4">Store Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Store Name</label>
                <input
                  type="text"
                  defaultValue="PREMAL KAIZEN"
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Store Email</label>
                <input
                  type="email"
                  defaultValue="support@premalkaizen.com"
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Store Phone</label>
                <input
                  type="tel"
                  defaultValue="+81-50-1234-5678"
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          {/* Payment Settings */}
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h2 className="text-lg font-bold text-black mb-4">Payment Gateway</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-medium">Configure your payment processor for checkout</p>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Payment Provider</label>
                <select className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black">
                  <option>Select a provider...</option>
                  <option>Stripe</option>
                  <option>Razorpay</option>
                  <option>PayPal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Shipping Settings */}
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h2 className="text-lg font-bold text-black mb-4">Shipping Settings</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-medium">Set up shipping zones and rates</p>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Default Shipping Rate</label>
                <input
                  type="text"
                  defaultValue="FREE"
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          {/* Tax Settings */}
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h2 className="text-lg font-bold text-black mb-4">Tax Settings</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-medium">Configure tax rates by region</p>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Default Tax Rate (%)</label>
                <input
                  type="number"
                  defaultValue="10"
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button className="px-6 py-2 border border-gray-light text-black rounded hover:border-black transition-colors">
              Cancel
            </button>
            <button className="px-6 py-2 bg-black text-cream rounded hover:bg-gray-dark transition-colors">
              Save Settings
            </button>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming Soon:</strong> API key management, webhook configuration, and advanced settings will be available in Phase 6.
          </p>
        </div>
      </div>
    </div>
  );
}
