'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminOrdersService, Order } from '@/lib/orders-service';

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadOrders();
  }, [page, search, status]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const result = await adminOrdersService.getOrders(token, page, 20, status || undefined, undefined, search || undefined);
      setOrders(result.data);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'shipped':
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-700';
      case 'processing':
      case 'packed':
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Orders"
        subtitle="Manage customer orders and fulfillment."
      />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-light">
          {/* Filters */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center gap-4 flex-col md:flex-row">
            <div className="flex gap-3 flex-1 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search by order number..."
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
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{formatStatus(s)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Orders Table */}
          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">No orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-light bg-gray-light">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-light hover:bg-gray-light">
                      <td className="px-6 py-4 text-sm font-medium text-black">{order.orderNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">
                        {order.user?.firstName} {order.user?.lastName}
                      </td>
                      <td className="px-6 py-4 text-sm text-black">{order.items.length}</td>
                      <td className="px-6 py-4 text-sm font-medium text-black">{formatPrice(order.total)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                          {formatStatus(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.paymentStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {formatStatus(order.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-medium">
                        {new Date(order.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <Link href={`/admin/orders/${order.id}`} className="text-black hover:text-gray-dark font-medium">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && orders.length > 0 && (
            <div className="p-6 border-t border-gray-light flex justify-between items-center">
              <p className="text-sm text-gray-medium">
                Showing {orders.length} of {total} orders
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
                  disabled={orders.length < 20}
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
