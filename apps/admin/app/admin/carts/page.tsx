'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminCartsService, CartListRow } from '@/lib/carts-service';

/** Carts untouched for 24+ hours are flagged as likely abandoned. */
const ABANDONED_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export default function CartsPage() {
  const [carts, setCarts] = useState<CartListRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadCarts();
  }, [page, search]);

  const loadCarts = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const result = await adminCartsService.getCarts(token, page, 20, search || undefined);
      setCarts(result.data);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carts');
      setCarts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const isAbandoned = (lastUpdated: string | null) => {
    if (!lastUpdated) return false;
    return Date.now() - new Date(lastUpdated).getTime() > ABANDONED_THRESHOLD_MS;
  };

  const formatRelative = (lastUpdated: string | null) => {
    if (!lastUpdated) return '-';
    const ms = Date.now() - new Date(lastUpdated).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const abandonedCount = carts.filter((c) => isAbandoned(c.lastUpdated)).length;

  return (
    <RequirePermission permission="customers:view">
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Customer Carts"
        subtitle="View what logged-in customers currently have in their cart. Read-only - nothing here can be modified."
      />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Active Carts</h3>
            <p className="text-3xl font-bold text-black">{isLoading ? '-' : total}</p>
            <p className="text-xs text-gray-medium mt-1">Logged-in customers with items saved</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Likely Abandoned (this page)</h3>
            <p className="text-3xl font-bold text-yellow-600">{isLoading ? '-' : abandonedCount}</p>
            <p className="text-xs text-gray-medium mt-1">Not updated in 24+ hours</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Note</h3>
            <p className="text-xs text-gray-medium mt-1">
              Guest (not logged in) carts are not shown here - they live only in the customer&apos;s browser.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-light">
          <div className="p-6 border-b border-gray-light">
            <input
              type="text"
              placeholder="Search by customer name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full max-w-sm px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
            />
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading carts...</div>
          ) : carts.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">No customers currently have items in their cart.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-light bg-gray-light">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Cart Total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Last Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {carts.map((cart) => (
                    <tr key={cart.userId} className="border-b border-gray-light hover:bg-gray-light">
                      <td className="px-6 py-4 text-sm">
                        <p className="font-medium text-black">{cart.customerName || 'Unnamed Customer'}</p>
                        <p className="text-xs text-gray-medium">{cart.customerEmail}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-dark">
                        {cart.itemCount} {cart.itemCount === 1 ? 'unit' : 'units'} ({cart.distinctProducts} {cart.distinctProducts === 1 ? 'product' : 'products'})
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-black">{formatPrice(cart.subtotal)}</td>
                      <td className="px-6 py-4 text-sm text-gray-medium">{formatRelative(cart.lastUpdated)}</td>
                      <td className="px-6 py-4 text-sm">
                        {isAbandoned(cart.lastUpdated) ? (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            Likely Abandoned
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/admin/customers/${cart.userId}`}
                          className="text-black hover:text-gray-dark font-medium"
                        >
                          View Customer
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && total > 0 && (
            <div className="p-6 border-t border-gray-light flex justify-between items-center">
              <p className="text-sm text-gray-medium">Showing {carts.length} of {total} active carts</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button className="px-4 py-2 border border-black text-black rounded text-sm">
                  {page}
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={carts.length < 20}
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
    </RequirePermission>
  );
}
