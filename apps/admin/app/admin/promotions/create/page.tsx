'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useState } from 'react';
import { adminPromotionsService } from '@/lib/promotions-service';
import { useRouter } from 'next/navigation';

const PROMOTION_TYPES = [
  { value: 'percentage', label: 'Percentage Discount (e.g., 20% off)' },
  { value: 'fixed_amount', label: 'Fixed Amount Discount (e.g., ₹500 off)' },
  { value: 'free_shipping', label: 'Free Shipping' },
];

export default function CreatePromotionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'percentage',
    value: '',
    maxDiscount: '',
    minSubtotal: '',
    firstOrderOnly: false,
    startDate: '',
    expiryDate: '',
    perCustomerLimit: '',
    totalUsageLimit: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.type) {
      setError('Name and type are required');
      return;
    }

    if (!formData.value && formData.type !== 'free_shipping') {
      setError('Value is required for this promotion type');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const payload: any = {
        name: formData.name,
        description: formData.description || null,
        type: formData.type,
        value: formData.type !== 'free_shipping' ? parseInt(formData.value) : null,
        maxDiscount: formData.maxDiscount ? parseInt(formData.maxDiscount) : null,
        minSubtotal: formData.minSubtotal ? parseInt(formData.minSubtotal) : null,
        firstOrderOnly: formData.firstOrderOnly,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : null,
        perCustomerLimit: formData.perCustomerLimit ? parseInt(formData.perCustomerLimit) : null,
        totalUsageLimit: formData.totalUsageLimit ? parseInt(formData.totalUsageLimit) : null,
        isActive: true,
      };

      await adminPromotionsService.createPromotion(token, payload);
      router.push('/admin/promotions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create promotion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Create Promotion"
        subtitle="Set up a new discount or promotion"
      />

      <div className="p-6 max-w-2xl">
        <Link href="/admin/promotions" className="text-black hover:text-gray-dark font-medium mb-6 inline-block">
          ← Back to Promotions
        </Link>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-light p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">Promotion Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Summer Sale 2024"
              className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Internal description for admin reference"
              className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              rows={3}
            />
          </div>

          {/* Type & Value */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Discount Type *</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              >
                {PROMOTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {formData.type !== 'free_shipping' && (
              <div>
                <label className="block text-sm font-semibold text-black mb-2">
                  {formData.type === 'percentage' ? 'Percentage (0-100) *' : 'Amount in Paise *'}
                </label>
                <input
                  type="number"
                  name="value"
                  value={formData.value}
                  onChange={handleInputChange}
                  placeholder={formData.type === 'percentage' ? '20' : '50000'}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
            )}
          </div>

          {/* Max Discount (for percentage) */}
          {formData.type === 'percentage' && (
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Max Discount Cap (in Paise)</label>
              <input
                type="number"
                name="maxDiscount"
                value={formData.maxDiscount}
                onChange={handleInputChange}
                placeholder="e.g., 50000 for ₹500"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              />
              <p className="text-xs text-gray-medium mt-1">Optional. Limits the maximum discount amount.</p>
            </div>
          )}

          {/* Minimum Subtotal */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">Minimum Order Amount (in Paise)</label>
            <input
              type="number"
              name="minSubtotal"
              value={formData.minSubtotal}
              onChange={handleInputChange}
              placeholder="e.g., 50000 for ₹500 minimum"
              className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
            />
            <p className="text-xs text-gray-medium mt-1">Optional. Customer must have this subtotal to use this promotion.</p>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Start Date</label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Expiry Date</label>
              <input
                type="datetime-local"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          {/* Usage Limits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Total Usage Limit</label>
              <input
                type="number"
                name="totalUsageLimit"
                value={formData.totalUsageLimit}
                onChange={handleInputChange}
                placeholder="e.g., 1000 (unlimited if blank)"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Per Customer Limit</label>
              <input
                type="number"
                name="perCustomerLimit"
                value={formData.perCustomerLimit}
                onChange={handleInputChange}
                placeholder="e.g., 3 (times per customer)"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          {/* First Order Only */}
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="firstOrderOnly"
                checked={formData.firstOrderOnly}
                onChange={handleInputChange}
                className="w-4 h-4 border border-gray-light rounded"
              />
              <span className="text-sm font-medium text-black">First Order Only</span>
            </label>
            <p className="text-xs text-gray-medium mt-1">Check to limit this promotion to first-time customers</p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 Tip:</strong> Product and category restrictions can be added after creating the promotion.
              Coupon codes can be generated individually.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-black text-white font-semibold rounded hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Promotion'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 border border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
