'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { orderService, Order } from '@/lib/order-service';
import { formatPaise } from '@/lib/pricing';

const STATUS_BADGE: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-red-100 text-red-800',
};

const RECENT_INVOICES_LIMIT = 5;

export default function ProfilePage() {
  const { user, isLoading, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      setIsLoadingOrders(false);
      return;
    }
    orderService
      .getOrders(token, 1, RECENT_INVOICES_LIMIT)
      .then((data) => {
        setOrders(data.orders);
        setTotalOrders(data.total);
      })
      .catch(() => setOrders([]))
      .finally(() => setIsLoadingOrders(false));
  }, [user]);

  const handleDownloadInvoice = async (order: Order) => {
    const token = localStorage.getItem('sessionToken');
    if (!token) return;
    setDownloadingId(order.id);
    setDownloadError(null);
    try {
      await orderService.downloadInvoice(order.id, order.orderNumber, token);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download invoice. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      await updateProfile(formData);
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-8">
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-black mb-6">My Profile</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      <div className="mb-8 pb-8 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="text-lg font-medium text-black">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-medium text-black">
              {user?.emailVerified ? (
                <span className="text-green-600">Verified</span>
              ) : (
                <span className="text-yellow-600">Unverified</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={formData.firstName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
              placeholder="John"
              disabled={isSaving}
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={formData.lastName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
              placeholder="Doe"
              disabled={isSaving}
            />
          </div>
        </div>

        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            value={formData.phoneNumber}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
            placeholder="+91 98765 43210"
            disabled={isSaving}
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="bg-black text-cream px-6 py-2 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>

    {/* Invoices */}
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-beige/60 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-black">Invoices</h2>
            <p className="text-sm text-gray-600">Download the invoice for any completed order</p>
          </div>
        </div>
        {totalOrders > RECENT_INVOICES_LIMIT && (
          <Link href="/account/orders" className="text-sm font-medium text-black hover:underline whitespace-nowrap">
            View all orders →
          </Link>
        )}
      </div>

      {downloadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {downloadError}
        </div>
      )}

      {isLoadingOrders ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10 px-6 rounded-xl bg-gradient-to-br from-cream to-gray-50 border border-dashed border-gray-300">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white shadow-sm flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">No invoices yet - they'll appear here once you place an order.</p>
          <Link href="/shop" className="inline-block px-5 py-2 bg-black text-cream rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const canDownload = orderService.isInvoiceable(order);
            const isDownloading = downloadingId === order.id;
            return (
              <div
                key={order.id}
                className="group flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-xl border border-gray-200 bg-gradient-to-r from-white to-cream/40 hover:to-cream hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 rounded-lg bg-black text-cream flex items-center justify-center flex-shrink-0 font-bold text-xs tracking-wide">
                  PDF
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-semibold text-black truncate">Order {order.orderNumber}</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.orderStatus] || 'bg-blue-100 text-blue-800'}`}>
                      {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1).replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{order.items.length} item{order.items.length !== 1 ? 's' : ''}
                    {' · '}<span className="font-medium text-black">{formatPaise(order.total)}</span>
                  </p>
                </div>

                {canDownload ? (
                  <button
                    onClick={() => handleDownloadInvoice(order)}
                    disabled={isDownloading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-cream text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex-shrink-0 sm:w-auto w-full"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {isDownloading ? 'Downloading…' : 'Download Invoice'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-500 italic flex-shrink-0">Available after payment</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}
