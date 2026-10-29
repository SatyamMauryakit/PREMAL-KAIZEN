'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';

interface MetricCard {
  label: string;
  value: string;
  change: string;
  icon: string;
}

const metrics: MetricCard[] = [
  { label: 'Total Revenue', value: '₹2,45,000', change: '+12% from last month', icon: '💰' },
  { label: 'Total Orders', value: '234', change: '+8 today', icon: '🛒' },
  { label: 'Active Customers', value: '1,245', change: '+45 this week', icon: '👥' },
  { label: 'Products', value: '147', change: '12 in stock', icon: '📦' },
];

const recentOrders = [
  { id: '#PK-001', customer: 'Yuki Tanaka', amount: '₹30,800', status: 'Delivered', date: 'Oct 28' },
  { id: '#PK-002', customer: 'Sara Chen', amount: '₹18,500', status: 'Shipped', date: 'Oct 27' },
  { id: '#PK-003', customer: 'Alex Kumar', amount: '₹45,200', status: 'Processing', date: 'Oct 27' },
  { id: '#PK-004', customer: 'Jordan Smith', amount: '₹12,300', status: 'Pending', date: 'Oct 26' },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your store today."
      />

      <div className="p-6 space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-white rounded-lg border border-gray-light p-6 hover:border-gray-medium transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-2xl">{metric.icon}</span>
                <span className="text-xs text-green-600 font-medium">{metric.change}</span>
              </div>
              <h3 className="text-sm text-gray-medium font-medium mb-1">{metric.label}</h3>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-light bg-gray-light">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-light hover:bg-gray-light">
                      <td className="px-6 py-4 text-sm font-medium text-black">{order.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">{order.customer}</td>
                      <td className="px-6 py-4 text-sm font-medium text-black">{order.amount}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            order.status === 'Delivered'
                              ? 'bg-green-100 text-green-700'
                              : order.status === 'Shipped'
                                ? 'bg-blue-100 text-blue-700'
                                : order.status === 'Processing'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-medium">{order.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-gray-light text-center">
              <Link
                href="/admin/orders"
                className="text-sm font-medium text-black hover:text-gray-dark transition-colors"
              >
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
                  href="/admin/products?action=create"
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
                  <span className="text-gray-dark">API Status</span>
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-dark">Database</span>
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-dark">Storefront</span>
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
