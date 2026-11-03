'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminCustomersService, CustomerDetails, Order } from '@/lib/customers-service';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailsPage({ params }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    params.then(p => setResolvedParams(p));
  }, [params]);

  useEffect(() => {
    if (resolvedParams?.id) {
      loadCustomer();
    }
  }, [resolvedParams?.id]);

  const loadCustomer = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const [customerData, ordersData] = await Promise.all([
        adminCustomersService.getCustomer(token, resolvedParams!.id),
        adminCustomersService.getOrderHistory(token, resolvedParams!.id, 1, 10),
      ]);

      setCustomer(customerData);
      setOrders(ordersData.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!customer) return;

    setIsChangingStatus(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      await adminCustomersService.setAccountStatus(
        token,
        customer.id,
        !customer.isActive,
        reason
      );

      setSuccess(`Customer ${!customer.isActive ? 'reactivated' : 'suspended'} successfully`);
      setCustomer({ ...customer, isActive: !customer.isActive });
      setShowStatusConfirm(false);
      setReason('');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change account status');
    } finally {
      setIsChangingStatus(false);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-light">
        <Header title="Customer Details" subtitle="" />
        <div className="p-6 text-center text-gray-medium">Loading customer...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-light">
        <Header title="Customer Details" subtitle="" />
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error || 'Customer not found'}
          </div>
          <Link href="/admin/customers" className="text-black hover:text-gray-dark font-medium">
            ← Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title={`${customer.firstName} ${customer.lastName}`}
        subtitle={customer.email}
      />

      <div className="p-6 max-w-6xl">
        <Link href="/admin/customers" className="text-black hover:text-gray-dark font-medium mb-6 inline-block">
          ← Back to Customers
        </Link>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Information */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Profile Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-medium">Email</p>
                  <p className="text-sm font-medium text-black">{customer.email}</p>
                  {customer.emailVerified && (
                    <p className="text-xs text-green-600">✓ Verified</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-medium">Phone</p>
                  <p className="text-sm font-medium text-black">{customer.phoneNumber || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-medium">Registered</p>
                    <p className="text-sm font-medium text-black">
                      {new Date(customer.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-medium">Last Login</p>
                    <p className="text-sm font-medium text-black">
                      {customer.lastLogin ? new Date(customer.lastLogin).toLocaleDateString('en-IN') : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Addresses */}
            {customer.addresses.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-light p-6">
                <h2 className="text-lg font-semibold text-black mb-4">Addresses</h2>
                <div className="space-y-4">
                  {customer.addresses.map((address) => (
                    <div key={address.id} className="border-b border-gray-light pb-4 last:border-b-0">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-black">{address.label}</p>
                        {address.isDefault && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-dark">
                        {address.firstName} {address.lastName}
                      </p>
                      <p className="text-sm text-gray-dark">{address.street1}</p>
                      {address.street2 && <p className="text-sm text-gray-dark">{address.street2}</p>}
                      {address.landmark && <p className="text-sm text-gray-dark">Near {address.landmark}</p>}
                      <p className="text-sm text-gray-dark">
                        {address.city}, {address.state} - {address.postalCode}
                      </p>
                      <p className="text-sm text-gray-dark">{address.country}</p>
                      <p className="text-sm text-gray-dark">{address.phoneNumber}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order History */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Recent Orders</h2>
              {orders.length === 0 ? (
                <p className="text-sm text-gray-medium">No orders yet</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex justify-between items-start pb-3 border-b border-gray-light last:border-b-0 hover:bg-gray-50 p-2 rounded transition-colors"
                    >
                      <div>
                        <p className="font-medium text-black">{order.orderNumber}</p>
                        <p className="text-xs text-gray-medium">
                          {new Date(order.createdAt).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-black">{formatPrice(order.total)}</p>
                        <p className={`text-xs font-medium ${
                          order.status === 'delivered' ? 'text-green-600' :
                          order.status === 'cancelled' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>
                          {formatStatus(order.status)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Status */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm font-semibold text-black mb-4">Account Status</h3>
              <div className="mb-4">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    customer.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {customer.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {showStatusConfirm ? (
                <div className="space-y-3">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for status change..."
                    className="w-full px-3 py-2 border border-gray-light rounded text-sm"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleStatusChange}
                      disabled={isChangingStatus}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {isChangingStatus ? 'Confirming...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setShowStatusConfirm(false)}
                      className="flex-1 px-3 py-2 border border-gray-light rounded text-sm font-medium hover:border-black"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowStatusConfirm(true)}
                  className={`w-full px-4 py-2 rounded font-medium text-white transition-colors ${
                    customer.isActive
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {customer.isActive ? 'Suspend Account' : 'Reactivate Account'}
                </button>
              )}
            </div>

            {/* Order Statistics */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm font-semibold text-black mb-4">Order Statistics</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-medium">Total Orders</p>
                  <p className="text-2xl font-bold text-black">{customer.orderCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-medium">Total Spent</p>
                  <p className="text-2xl font-bold text-black">{formatPrice(customer.totalSpent)}</p>
                </div>
                {customer.completedOrders !== undefined && (
                  <div>
                    <p className="text-xs text-gray-medium">Completed Orders</p>
                    <p className="text-2xl font-bold text-green-600">{customer.completedOrders}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-black mb-2">Account ID</h4>
              <p className="text-xs text-gray-dark font-mono break-all">{customer.id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
