'use client';

import { Header } from '@/components/Header';

const customers = [
  { id: 1, name: 'Yuki Tanaka', email: 'yuki.tanaka@example.jp', phone: '+81-90-1234-5678', orders: 3, spent: '₹89,400', status: 'Active', joined: 'Oct 1' },
  { id: 2, name: 'Sara Chen', email: 'sara.chen@example.com', phone: '+1-555-123-4567', orders: 1, spent: '₹18,500', status: 'Active', joined: 'Oct 15' },
  { id: 3, name: 'Alex Kumar', email: 'alex.kumar@example.in', phone: '+91-98765-43210', orders: 2, spent: '₹45,200', status: 'Active', joined: 'Oct 10' },
  { id: 4, name: 'Jordan Smith', email: 'jordan@example.com', phone: '+1-555-987-6543', orders: 1, spent: '₹12,300', status: 'Inactive', joined: 'Sep 20' },
];

export default function CustomersPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Customers"
        subtitle="Manage customer accounts and view purchase history."
      />

      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-light">
          {/* Filters */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center gap-4">
            <div className="flex gap-3 flex-1">
              <input
                type="text"
                placeholder="Search by name or email..."
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black flex-1"
              />
              <select className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black">
                <option>All Status</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>

          {/* Customers Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-light bg-gray-light">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Orders</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Total Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-light hover:bg-gray-light">
                    <td className="px-6 py-4 text-sm font-medium text-black">{customer.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-dark">{customer.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-dark">{customer.phone}</td>
                    <td className="px-6 py-4 text-sm text-black font-medium">{customer.orders}</td>
                    <td className="px-6 py-4 text-sm font-medium text-black">{customer.spent}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          customer.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-medium">{customer.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Info */}
          <div className="p-6 border-t border-gray-light flex justify-between items-center">
            <p className="text-sm text-gray-medium">Showing 4 of 1,245 customers</p>
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming Soon:</strong> Customer authentication, segments, loyalty programs, and communication will be available in Phase 6.
          </p>
        </div>
      </div>
    </div>
  );
}
