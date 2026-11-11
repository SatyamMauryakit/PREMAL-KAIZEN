'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import { useState, useEffect } from 'react';
import { adminEnquiriesService, ContactMessage } from '@/lib/enquiries-service';

const CATEGORY_LABELS: Record<string, string> = {
  'order-status': 'Order Status',
  shipping: 'Shipping',
  returns: 'Returns',
  'product-question': 'Product Question',
  'payment-issue': 'Payment Issue',
  general: 'General',
};

export default function EnquiriesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const result = await adminEnquiriesService.getMessages(token, 50, 0);
      setMessages(result.messages);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enquiries');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <RequirePermission permission="enquiries:view">
    <div className="min-h-screen bg-gray-light">
      <Header title="Enquiries" subtitle="Messages submitted through the storefront contact form" />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-medium">Loading...</p>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-light p-12 text-center">
            <p className="text-gray-medium">No enquiries yet.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-medium mb-4">{total} total enquiries</p>
            <div className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className="bg-white rounded-lg border border-gray-light p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-black">{m.name}</p>
                      <a href={`mailto:${m.email}`} className="text-sm text-gray-medium hover:text-black hover:underline">
                        {m.email}
                      </a>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-beige text-neutral-900 text-xs font-medium px-2 py-1 rounded mb-1">
                        {CATEGORY_LABELS[m.category] || m.category}
                      </span>
                      <p className="text-xs text-gray-medium">{formatDate(m.createdAt)}</p>
                    </div>
                  </div>
                  <p className="font-medium text-black mb-1">{m.subject}</p>
                  {m.orderNumber && (
                    <p className="text-xs text-gray-medium mb-2">Order: {m.orderNumber}</p>
                  )}
                  <p className="text-sm text-gray-dark whitespace-pre-wrap">{m.message}</p>
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
