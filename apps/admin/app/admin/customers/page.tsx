'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminCustomersService, Customer, CustomerStatistics } from '@/lib/customers-service';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statistics, setStatistics] = useState<CustomerStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, [page, search, status]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      // Load statistics
      const stats = await adminCustomersService.getStatistics(token);
      setStatistics(stats);

      // Load customers
      const result = await adminCustomersService.getCustomers(
        token,
        page,
        20,
        search || undefined,
        status || undefined
      );
      setCustomers(result.data);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  const verificationBadge = (status?: Customer['verificationStatus']) => {
    switch (status) {
      case 'both_verified':
        return { label: 'Both Verified', className: 'bg-green-100 text-green-700' };
      case 'email_verified':
        return { label: 'Email Verified', className: 'bg-blue-100 text-blue-700' };
      case 'mobile_verified':
        return { label: 'Mobile Verified', className: 'bg-blue-100 text-blue-700' };
      default:
        return { label: 'Pending Verification', className: 'bg-gray-100 text-gray-700' };
    }
  };

  return (
    <RequirePermission permission="customers:view">
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Customers"
        subtitle="Manage customer accounts and order history"
      />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm text-gray-medium font-medium mb-2">Total Customers</h3>
              <p className="text-3xl font-bold text-black">{statistics.totalCustomers}</p>
              <p className="text-xs text-gray-medium mt-1">
                {statistics.activeCustomers} active
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm text-gray-medium font-medium mb-2">Verified Emails</h3>
              <p className="text-3xl font-bold text-green-600">{statistics.verifiedEmails}</p>
              <p className="text-xs text-gray-medium mt-1">
                {statistics.totalCustomers > 0
                  ? Math.round((statistics.verifiedEmails / statistics.totalCustomers) * 100)
                  : 0}
                % verified
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm text-gray-medium font-medium mb-2">Fully Verified</h3>
              <p className="text-3xl font-bold text-green-600">{statistics.fullyVerified}</p>
              <p className="text-xs text-gray-medium mt-1">
                Email + mobile ({statistics.verifiedMobiles} mobiles verified)
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm text-gray-medium font-medium mb-2">Total Order Value</h3>
              <p className="text-3xl font-bold text-blue-600">{formatPrice(statistics.totalOrderValue)}</p>
              <p className="text-xs text-gray-medium mt-1">
                Avg: {formatPrice(statistics.avgOrderValue)} per customer
              </p>
            </div>
          </div>
        )}

        {/* Customers Table */}
        <div className="bg-white rounded-lg border border-gray-light">
          {/* Filters */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center gap-4 flex-col md:flex-row">
            <div className="flex gap-3 flex-1 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search by name or email..."
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
                <option value="">All Customers</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Customers Table */}
          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">No customers found</div>
          ) : (
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Verification</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Joined</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-gray-light hover:bg-gray-light">
                      <td className="px-6 py-4 text-sm font-medium text-black">
                        {customer.firstName} {customer.lastName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-dark">{customer.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">
                        {customer.phoneNumber || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-black">
                        {customer.orderCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-black">
                        {formatPrice(customer.totalSpent)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            customer.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {(() => {
                          const badge = verificationBadge(customer.verificationStatus);
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-medium">
                        {new Date(customer.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="text-black hover:text-gray-dark font-medium"
                        >
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
          {!isLoading && customers.length > 0 && (
            <div className="p-6 border-t border-gray-light flex justify-between items-center">
              <p className="text-sm text-gray-medium">
                Showing {customers.length} of {total} customers
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
                  disabled={customers.length < 20}
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
