'use client';

import { Header } from '@/components/Header';

const orders = [
  { id: '#PK-001', customer: 'Yuki Tanaka', amount: '₹30,800', status: 'Delivered', date: 'Oct 28', items: 2 },
  { id: '#PK-002', customer: 'Sara Chen', amount: '₹18,500', status: 'Shipped', date: 'Oct 27', items: 1 },
  { id: '#PK-003', customer: 'Alex Kumar', amount: '₹45,200', status: 'Processing', date: 'Oct 27', items: 3 },
  { id: '#PK-004', customer: 'Jordan Smith', amount: '₹12,300', status: 'Pending', date: 'Oct 26', items: 1 },
  { id: '#PK-005', customer: 'Maria Garcia', amount: '₹56,800', status: 'Delivered', date: 'Oct 25', items: 4 },
];

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Orders"
        subtitle="Manage customer orders and shipping."
      />

      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-light">
          {/* Filters */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center gap-4">
            <div className="flex gap-3 flex-1">
              <input
                type="text"
                placeholder="Search order ID..."
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black flex-1"
              />
              <select className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black">
                <option>All Status</option>
                <option>Pending</option>
                <option>Processing</option>
                <option>Shipped</option>
                <option>Delivered</option>
              </select>
            </div>
            <button className="px-4 py-2 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors text-sm">
              Export
            </button>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-light bg-gray-light">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-light hover:bg-gray-light">
                    <td className="px-6 py-4 text-sm font-medium text-black">{order.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-dark">{order.customer}</td>
                    <td className="px-6 py-4 text-sm text-black">{order.items} item(s)</td>
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
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button className="text-black hover:text-gray-dark font-medium">View</button>
                      <span className="text-gray-light">|</span>
                      <button className="text-black hover:text-gray-dark font-medium">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Info */}
          <div className="p-6 border-t border-gray-light flex justify-between items-center">
            <p className="text-sm text-gray-medium">Showing 5 of 234 orders</p>
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors">
                ← Previous
              </button>
              <button className="px-4 py-2 border border-black text-black rounded text-sm">1</button>
              <button className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors">
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming Soon:</strong> Order fulfillment, shipping integration, and customer communication tools will be available in Phase 6.
          </p>
        </div>
      </div>
    </div>
  );
}
