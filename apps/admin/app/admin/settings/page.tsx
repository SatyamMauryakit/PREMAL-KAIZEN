'use client';

import { Header } from '@/components/Header';
import { useState, useEffect } from 'react';
import { adminSettingsService, StoreSettings, ShippingMethod } from '@/lib/settings-service';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'regional' | 'shipping' | 'tax' | 'checkout' | 'notifications' | 'security'>('general');
  const [formData, setFormData] = useState<Partial<StoreSettings>>({});
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminFirstName, setNewAdminFirstName] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminCreateMessage, setAdminCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCreateMessage(null);
    if (newAdminPassword.length < 8) {
      setAdminCreateMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    setIsCreatingAdmin(true);
    try {
      const token = localStorage.getItem('adminSessionToken');
      const response = await fetch(`${API_BASE}/api/auth/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newAdminEmail, password: newAdminPassword, firstName: newAdminFirstName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create administrator');
      setAdminCreateMessage({ type: 'success', text: `Administrator ${data.user.email} created successfully` });
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminFirstName('');
    } catch (err) {
      setAdminCreateMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create administrator' });
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const data = await adminSettingsService.getSettings(token);
      setSettings(data);
      setFormData(data);
      setShippingMethods(data.shippingMethods || []);
      setMaintenanceEnabled(data.maintenanceMode || false);
      setMaintenanceMessage(data.maintenanceMessage || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSuccess(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      await adminSettingsService.updateSettings(token, formData);
      setSettings(formData as StoreSettings);
      setHasChanges(false);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShippingChange = (index: number, field: string, value: any) => {
    const updated = [...shippingMethods];
    updated[index] = { ...updated[index], [field]: value };
    setShippingMethods(updated);
    handleInputChange('shippingMethods', updated);
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-light">
        <Header title="Settings" subtitle="Configure store settings and preferences." />
        <div className="p-6 text-center text-gray-medium">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Settings" subtitle="Configure store settings and preferences." />

      <div className="p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {hasChanges && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
            You have unsaved changes. Remember to save before leaving.
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg border border-gray-light mb-6">
          <div className="flex flex-wrap border-b border-gray-light">
            {[
              { id: 'general', label: 'General' },
              { id: 'regional', label: 'Regional' },
              { id: 'shipping', label: 'Shipping' },
              { id: 'tax', label: 'Tax' },
              { id: 'checkout', label: 'Checkout' },
              { id: 'notifications', label: 'Notifications' },
              { id: 'security', label: 'Security' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-medium hover:text-black'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Store Name</label>
                <input
                  type="text"
                  value={formData.storeName || ''}
                  onChange={(e) => handleInputChange('storeName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Support Email</label>
                <input
                  type="email"
                  value={formData.storeEmail || ''}
                  onChange={(e) => handleInputChange('storeEmail', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Support Phone</label>
                <input
                  type="tel"
                  value={formData.storePhone || ''}
                  onChange={(e) => handleInputChange('storePhone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Business Address</label>
                <textarea
                  value={formData.businessAddress || ''}
                  onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
            </div>
          )}

          {/* Regional Tab */}
          {activeTab === 'regional' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Timezone</label>
                <select
                  value={formData.timezone || 'Asia/Kolkata'}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Locale</label>
                <select
                  value={formData.locale || 'en-IN'}
                  onChange={(e) => handleInputChange('locale', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Currency</label>
                <input
                  type="text"
                  value={formData.currency || 'INR'}
                  disabled
                  className="w-full px-4 py-2 border border-gray-light rounded bg-gray-50 text-gray-medium"
                />
                <p className="text-xs text-gray-medium mt-1">Currency is fixed to INR and cannot be changed</p>
              </div>
            </div>
          )}

          {/* Shipping Tab */}
          {activeTab === 'shipping' && (
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-900">
                Configure shipping methods available to customers. All prices are in INR.
              </div>
              <div className="space-y-4">
                {shippingMethods.map((method, idx) => (
                  <div key={method.id} className="border border-gray-light rounded p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-medium mb-1">Method Name</label>
                        <input
                          type="text"
                          value={method.name}
                          onChange={(e) => handleShippingChange(idx, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-light rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-medium mb-1">Price (₹)</label>
                        <input
                          type="number"
                          value={method.price / 100}
                          onChange={(e) => handleShippingChange(idx, 'price', Math.round(parseFloat(e.target.value) * 100))}
                          className="w-full px-3 py-2 border border-gray-light rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-medium mb-1">Estimated Days</label>
                        <input
                          type="number"
                          value={method.estimatedDays || 0}
                          onChange={(e) => handleShippingChange(idx, 'estimatedDays', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-light rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-medium mb-1">Enabled</label>
                        <input
                          type="checkbox"
                          checked={method.enabled}
                          onChange={(e) => handleShippingChange(idx, 'enabled', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs text-gray-medium mb-1">Description</label>
                      <input
                        type="text"
                        value={method.description || ''}
                        onChange={(e) => handleShippingChange(idx, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-light rounded text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tax Tab */}
          {activeTab === 'tax' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Default Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.defaultTaxRate || 0}
                  onChange={(e) => handleInputChange('defaultTaxRate', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Tax Calculation Mode</label>
                <select
                  value={formData.taxCalculationMode || 'exclusive'}
                  onChange={(e) => handleInputChange('taxCalculationMode', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                >
                  <option value="exclusive">Tax Exclusive (added to price)</option>
                  <option value="inclusive">Tax Inclusive (included in price)</option>
                </select>
                <p className="text-xs text-gray-medium mt-2">
                  {formData.taxCalculationMode === 'exclusive'
                    ? 'Tax is calculated and added on top of the product price'
                    : 'Tax is already included in the displayed price'}
                </p>
              </div>
            </div>
          )}

          {/* Checkout Tab */}
          {activeTab === 'checkout' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.guestCheckoutEnabled || false}
                    onChange={(e) => handleInputChange('guestCheckoutEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-black">Allow Guest Checkout</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Minimum Order Value (₹)</label>
                <input
                  type="number"
                  value={(formData.minimumOrderValue || 0) / 100}
                  onChange={(e) => handleInputChange('minimumOrderValue', Math.round(parseFloat(e.target.value) * 100))}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
              <div className="border-t border-gray-light pt-4">
                <label className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={maintenanceEnabled}
                    onChange={(e) => {
                      setMaintenanceEnabled(e.target.checked);
                      handleInputChange('maintenanceMode', e.target.checked);
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-black">Enable Maintenance Mode</span>
                </label>
                {maintenanceEnabled && (
                  <textarea
                    value={maintenanceMessage}
                    onChange={(e) => {
                      setMaintenanceMessage(e.target.value);
                      handleInputChange('maintenanceMessage', e.target.value);
                    }}
                    placeholder="Message to display during maintenance..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                  />
                )}
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.orderConfirmationEnabled !== false}
                    onChange={(e) => handleInputChange('orderConfirmationEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-black">Order Confirmation Emails</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.paymentNotificationsEnabled !== false}
                    onChange={(e) => handleInputChange('paymentNotificationsEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-black">Payment Status Notifications</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.shippingNotificationsEnabled !== false}
                    onChange={(e) => handleInputChange('shippingNotificationsEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-black">Shipping & Delivery Updates</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.lowStockNotificationsEnabled !== false}
                    onChange={(e) => handleInputChange('lowStockNotificationsEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-black">Low Stock Alerts</span>
                </label>
              </div>
              <div className="border-t border-gray-light pt-4 space-y-3">
                <h3 className="text-sm font-medium text-black">Notification Channels</h3>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.emailNotificationsEnabled !== false}
                    onChange={(e) => handleInputChange('emailNotificationsEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-black">Email (✓ Configured)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    disabled
                    checked={false}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-medium">SMS (Not Configured)</span>
                </label>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-medium text-black">Payment Providers</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-gray-light rounded">
                  <div>
                    <p className="text-sm font-medium text-black">Stripe</p>
                    <p className="text-xs text-gray-medium">Credit card payments</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">Not Configured</span>
                </div>
                <div className="flex items-center justify-between p-3 border border-gray-light rounded">
                  <div>
                    <p className="text-sm font-medium text-black">Razorpay</p>
                    <p className="text-xs text-gray-medium">Multiple payment methods (India)</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">Not Configured</span>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-4 mt-4 text-sm text-blue-900">
                <strong>Note:</strong> Payment provider keys and secrets are configured via environment variables for security. Do not store them in database settings.
              </div>

              <div className="border-t border-gray-light pt-6 mt-6">
                <h3 className="text-sm font-medium text-black mb-1">Add Administrator</h3>
                <p className="text-xs text-gray-medium mb-4">
                  Create another administrator account. They will have full access to this admin panel.
                </p>

                {adminCreateMessage && (
                  <div
                    className={`mb-4 px-4 py-3 rounded text-sm ${
                      adminCreateMessage.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}
                  >
                    {adminCreateMessage.text}
                  </div>
                )}

                <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="First name"
                    value={newAdminFirstName}
                    onChange={(e) => setNewAdminFirstName(e.target.value)}
                    className="px-3 py-2 border border-gray-light rounded text-sm"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="px-3 py-2 border border-gray-light rounded text-sm"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password (min 8 characters)"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    minLength={8}
                    className="px-3 py-2 border border-gray-light rounded text-sm"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isCreatingAdmin}
                    className="md:col-span-3 px-4 py-2 bg-black text-cream rounded hover:bg-gray-dark disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    {isCreatingAdmin ? 'Creating...' : 'Create Administrator'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Save/Cancel Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => {
              setFormData(settings || {});
              setHasChanges(false);
            }}
            disabled={!hasChanges}
            className="px-6 py-2 border border-gray-light text-black rounded hover:border-black disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-6 py-2 bg-black text-cream rounded hover:bg-gray-dark disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
