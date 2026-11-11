'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import { useState, useEffect, useCallback } from 'react';
import { adminReviewsService, AdminReview } from '@/lib/reviews-service';

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
};

function getToken(): string | null {
  return localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await adminReviewsService.list(token, { status: statusFilter || undefined, limit: 50 });
      setReviews(result.data);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleModerate = async (reviewId: string, status: 'approved' | 'rejected') => {
    const token = getToken();
    if (!token) return;
    setActioningId(reviewId);
    try {
      await adminReviewsService.moderate(token, reviewId, status);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to moderate review');
    } finally {
      setActioningId(null);
    }
  };

  const handleRemove = async (reviewId: string) => {
    const token = getToken();
    if (!token) return;
    if (!confirm('Permanently remove this review? This cannot be undone.')) return;
    setActioningId(reviewId);
    try {
      await adminReviewsService.remove(token, reviewId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove review');
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <RequirePermission permission="reviews:moderate">
    <div className="min-h-screen bg-gray-light">
      <Header title="Reviews" subtitle="Moderate product reviews submitted by verified customers" />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">{error}</div>
        )}

        {/* Status tabs */}
        <div className="flex gap-2 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                statusFilter === tab.value
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-gray-300 hover:border-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-gray-medium">Loading...</p>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-light p-12 text-center">
            <p className="text-gray-medium">No {statusFilter || ''} reviews.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-medium mb-4">{total} review{total === 1 ? '' : 's'}</p>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-lg border border-gray-light p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-black">{review.product.name}</p>
                      <p className="text-xs text-gray-medium">SKU: {review.product.sku}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded mb-1 ${STATUS_BADGE[review.status] || 'bg-gray-100 text-gray-700'}`}>
                        {review.status}
                      </span>
                      <p className="text-xs text-gray-medium">{formatDate(review.createdAt)}</p>
                      {review.reportCount > 0 && (
                        <p className="text-xs text-red-600 font-medium">{review.reportCount} report{review.reportCount === 1 ? '' : 's'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-beige text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                    <p className="font-medium text-black">{review.title}</p>
                  </div>
                  <p className="text-sm text-gray-dark whitespace-pre-wrap mb-3">{review.description}</p>

                  <p className="text-xs text-gray-medium mb-4">
                    {review.user.firstName || review.user.email} ({review.user.email}) · Order{' '}
                    {review.orderItem.order.orderNumber}
                  </p>

                  {review.moderationNote && (
                    <p className="text-xs text-gray-medium italic mb-3">Note: {review.moderationNote}</p>
                  )}

                  <div className="flex gap-2">
                    {review.status !== 'approved' && (
                      <button
                        onClick={() => handleModerate(review.id, 'approved')}
                        disabled={actioningId === review.id}
                        className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    {review.status !== 'rejected' && (
                      <button
                        onClick={() => handleModerate(review.id, 'rejected')}
                        disabled={actioningId === review.id}
                        className="px-4 py-1.5 border border-gray-300 text-black text-sm font-medium rounded hover:border-black disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(review.id)}
                      disabled={actioningId === review.id}
                      className="px-4 py-1.5 border border-red-300 text-red-600 text-sm font-medium rounded hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
    </RequirePermission>
  );
}
