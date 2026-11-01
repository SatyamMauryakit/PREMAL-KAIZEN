'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

interface DashboardMetrics {
  netRevenue: number;
  orderCount: number;
  comparison?: { netRevenueChange: number; orderCountChange: number };
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  user: { email: string; firstName: string | null; lastName: string | null };
}

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  shipped: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-yellow-100 text-yellow-700',
};

function formatPrice(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatChange(pct?: number) {
  if (pct === undefined) return null;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}% vs previous period`;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[] | null>(null);
  const [storefrontUp, setStorefrontUp] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('adminSessionToken');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const qs = `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;

    Promise.all([
      fetch(`${API_BASE}/api/admin/analytics/dashboard?${qs}`, { headers }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error('analytics'))
      ),
      fetch(`${API_BASE}/api/products?limit=1`).then((r) => r.json()),
      fetch(`${API_BASE}/api/admin/customers?limit=1`, { headers }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error('customers'))
      ),
      fetch(`${API_BASE}/api/orders?limit=5`, { headers }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error('orders'))
      ),
    ])
      .then(([dash, products, customers, orders]) => {
        setMetrics(dash);
        setProductCount(products.total);
        setCustomerCount(customers.total);
        setRecentOrders(orders.data);
      })
      .catch(() => setError('Failed to load dashboard data'));

    fetch(STOREFRONT_URL, { mode: 'no-cors' })
      .then(() => setStorefrontUp(true))
      .catch(() => setStorefrontUp(false));
  }, []);

  const metricCards = [
    { label: 'Net Revenue (30d)', value: metrics ? formatPrice(metrics.netRevenue) : '—', change: metrics ? formatChange(metrics.comparison?.netRevenueChange) : null },
    { label: 'Orders (30d)', value: metrics ? String(metrics.orderCount) : '—', change: metrics ? formatChange(metrics.comparison?.orderCountChange) : null },
    { label: 'Customers', value: customerCount !== null ? String(customerCount) : '—', change: null },
    { label: 'Products', value: productCount !== null ? String(productCount) : '—', change: null },
  ];

  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your store today."
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((metric) => (
            <div
              key={metric.label}
              className="bg-white rounded-lg border border-gray-light p-6 hover:border-gray-medium transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-sm text-gray-medium font-medium">{metric.label}</h3>
                {metric.change && (
                  <span className={`text-xs font-medium ${metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-black">{metric.value}</p>
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-light">
            <div className="p-6 border-b border-gray-light">
              <h2 className="text-lg font-bold text-black">Recent Orders</h2>
            </div>
            {recentOrders === null ? (
              <div className="p-6 text-center text-gray-medium text-sm">Loading...</div>
            ) : recentOrders.length === 0 ? (
              <div className="p-6 text-center text-gray-medium text-sm">
                No orders yet. Orders will appear here once customers start purchasing.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-light bg-gray-light">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Order ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-light hover:bg-gray-light">
                        <td className="px-6 py-4 text-sm font-medium text-black">{order.orderNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-dark">{order.user.email}</td>
                        <td className="px-6 py-4 text-sm font-medium text-black">{formatPrice(order.total)}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-700'}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-medium">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="p-6 border-t border-gray-light text-center">
              <Link href="/admin/orders" className="text-sm font-medium text-black hover:text-gray-dark transition-colors">
                View All Orders →
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-bold text-black mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/admin/products/create"
                  className="block w-full px-4 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark transition-colors text-center text-sm"
                >
                  + Add Product
                </Link>
                <Link
                  href="/admin/orders"
                  className="block w-full px-4 py-2 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors text-center text-sm"
                >
                  View Orders
                </Link>
                <Link
                  href="/admin/customers"
                  className="block w-full px-4 py-2 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors text-center text-sm"
                >
                  Manage Customers
                </Link>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-bold text-black mb-4">System Status</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-dark">API &amp; Database</span>
                  <span className={`w-3 h-3 rounded-full ${metrics || error === null ? (error ? 'bg-red-500' : metrics ? 'bg-green-500' : 'bg-gray-300') : 'bg-red-500'}`}></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-dark">Storefront</span>
                  <span className={`w-3 h-3 rounded-full ${storefrontUp === null ? 'bg-gray-300' : storefrontUp ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
