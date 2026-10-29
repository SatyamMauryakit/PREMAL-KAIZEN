'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminPromotionsService, Promotion } from '@/lib/promotions-service';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadPromotions();
  }, [page, search, status]);

  const loadPromotions = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const result = await adminPromotionsService.getPromotions(token, page, 20, search, status || undefined);
      setPromotions(result.data);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions');
      setPromotions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      await adminPromotionsService.togglePromotion(token, id, !isActive);
      setPromotions(promotions.map(p => p.id === id ? { ...p, isActive: !isActive } : p));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle promotion');
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'expired':
        return 'bg-gray-100 text-gray-700';
      case 'disabled':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'percentage':
        return '%';
      case 'fixed_amount':
        return '₹';
      case 'free_shipping':
        return 'Free Ship';
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Promotions & Coupons"
        subtitle="Manage discounts, promotions, and coupon codes"
      />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-light">
          {/* Actions & Filters */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center gap-4 flex-col md:flex-row">
            <div className="flex gap-3 flex-1 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search by name or code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black flex-1"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <Link
              href="/admin/promotions/create"
              className="px-4 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark transition-colors text-sm whitespace-nowrap"
            >
              + New Promotion
            </Link>
          </div>

          {/* Promotions Table */}
          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading promotions...</div>
          ) : promotions.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">No promotions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-light bg-gray-light">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Usage</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Expiry</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((promo) => (
                    <tr key={promo.id} className="border-b border-gray-light hover:bg-gray-light">
                      <td className="px-6 py-4 text-sm">
                        <p className="font-medium text-black">{promo.name}</p>
                        {promo.code && <p className="text-xs text-gray-medium">{promo.code}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-dark">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                          {getTypeLabel(promo.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-black">
                        {promo.type === 'percentage' ? `${promo.value}%` : promo.type === 'fixed_amount' ? `₹${promo.value}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(promo.status)}`}>
                          {formatStatus(promo.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-dark">
                        {promo.totalUsageLimit ? `${promo.usageCount}/${promo.totalUsageLimit}` : `${promo.usageCount}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-dark">
                        {promo.expiryDate ? new Date(promo.expiryDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <Link
                          href={`/admin/promotions/${promo.id}`}
                          className="text-black hover:text-gray-dark font-medium"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleToggle(promo.id, promo.isActive)}
                          className="text-black hover:text-gray-dark font-medium"
                        >
                          {promo.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && promotions.length > 0 && (
            <div className="p-6 border-t border-gray-light flex justify-between items-center">
              <p className="text-sm text-gray-medium">
                Showing {promotions.length} of {total} promotions
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button className="px-4 py-2 border border-black text-black rounded text-sm">
                  {page}
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={promotions.length < 20}
                  className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
