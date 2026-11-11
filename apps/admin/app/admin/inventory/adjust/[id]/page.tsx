'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminInventoryService } from '@/lib/inventory-service';
import { useRouter } from 'next/navigation';

const ADJUSTMENT_TYPES = [
  { value: 'received', label: 'Stock Received' },
  { value: 'correction', label: 'Count Correction' },
  { value: 'damage', label: 'Damaged/Defective' },
  { value: 'manual_reconciliation', label: 'Manual Reconciliation' },
];

interface PageProps {
  params: Promise<{ id: string }>;
}

interface VariantContext {
  size: string | null;
  color: string | null;
  name: string | null;
  sku: string | null;
  onHand: string | null;
}

export default function AdjustInventoryPage({ params }: PageProps) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  // `[id]` here is the product ID (see the Inventory list page's link) - the
  // specific variant to adjust is identified by size/color, carried via the
  // query string rather than the route param, since one product can have many
  // inventory rows (one per size/color combination).
  const [variant, setVariant] = useState<VariantContext>({ size: null, color: null, name: null, sku: null, onHand: null });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: 'received',
    quantity: '',
    reason: '',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    params.then(p => setResolvedParams(p));
  }, [params]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setVariant({
      size: search.get('size') || null,
      color: search.get('color') || null,
      name: search.get('name'),
      sku: search.get('sku'),
      onHand: search.get('onHand'),
    });
    setLoading(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.type || !formData.quantity || !formData.reason) {
      setError('Type, quantity, and reason are required');
      return;
    }

    const qty = parseInt(formData.quantity);
    if (isNaN(qty) || qty === 0) {
      setError('Quantity must be a non-zero number');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      await adminInventoryService.adjustInventory(token, resolvedParams!.id, {
        size: variant.size || undefined,
        color: variant.color || undefined,
        type: formData.type,
        quantity: qty,
        reason: formData.reason,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      });

      setSuccess('Inventory adjusted successfully');
      setTimeout(() => {
        router.push('/admin/inventory');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust inventory');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-light">
        <Header title="Adjust Inventory" subtitle="" />
        <div className="p-6 text-center text-gray-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Adjust Inventory"
        subtitle="Record stock adjustments with audit trail"
      />

      <div className="p-6 max-w-2xl">
        <Link href="/admin/inventory" className="text-black hover:text-gray-dark font-medium mb-6 inline-block">
          ← Back to Inventory
        </Link>

        {variant.name && (
          <div className="bg-white rounded-lg border border-gray-light p-4 mb-6">
            <p className="text-sm font-semibold text-black">{variant.name}</p>
            <p className="text-xs text-gray-medium">
              SKU: {variant.sku}
              {variant.size && ` • Size: ${variant.size}`}
              {variant.color && ` • Color: ${variant.color}`}
              {variant.onHand !== null && ` • Current stock: ${variant.onHand}`}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-light p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Adjustment Type */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">Adjustment Type *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
            >
              {ADJUSTMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-medium mt-1">
              Select the reason for this inventory adjustment
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">Quantity *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, quantity: (parseInt(prev.quantity) || 0) - 1 + '' }))}
                className="px-4 py-2 border border-gray-light rounded hover:bg-gray-light font-medium"
              >
                −
              </button>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="0"
                className="flex-1 px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black text-center font-semibold text-lg"
              />
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, quantity: (parseInt(prev.quantity) || 0) + 1 + '' }))}
                className="px-4 py-2 border border-gray-light rounded hover:bg-gray-light font-medium"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-medium mt-1">
              Positive numbers increase stock, negative numbers decrease it
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">Reason *</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="e.g., 'Received shipment from supplier', 'Inventory count mismatch', 'Damaged during handling'"
              className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              rows={4}
            />
            <p className="text-xs text-gray-medium mt-1">
              Describe the reason for this adjustment (required for audit trail)
            </p>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">Reference (Optional)</label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleInputChange}
              placeholder="e.g., PO-12345, INV-789, RMA-456"
              className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
            />
            <p className="text-xs text-gray-medium mt-1">
              Reference number (PO, invoice, RMA, etc.) for traceability
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Additional notes or comments..."
              className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              rows={3}
            />
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900">
              <strong>⚠️ Important:</strong> This adjustment will be recorded in the audit log with your timestamp and user ID.
              All inventory changes are permanent and cannot be undone.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-black text-white font-semibold rounded hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adjusting...' : 'Confirm Adjustment'}
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
