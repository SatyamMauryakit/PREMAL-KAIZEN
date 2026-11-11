'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminOrdersService, Order } from '@/lib/orders-service';

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const PAYMENT_STATUS_OPTIONS = ['pending', 'completed', 'failed', 'refunded'];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailsPage({ params }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [paymentStatusUpdate, setPaymentStatusUpdate] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    params.then(p => setResolvedParams(p));
  }, [params]);

  useEffect(() => {
    if (resolvedParams?.id) {
      loadOrder();
    }
  }, [resolvedParams?.id]);

  const loadOrder = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const data = await adminOrdersService.getOrder(resolvedParams!.id, token);
      setOrder(data);
      setStatusUpdate(data.status);
      setPaymentStatusUpdate(data.paymentStatus);
      setTrackingNumber(data.trackingNumber || '');
      setCarrier(data.carrier || '');
      setInternalNotes(data.internalNotes || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!order || statusUpdate === order.status) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const updated = await adminOrdersService.updateStatus(order.id, statusUpdate, token);
      setOrder(updated);
      alert('Order status updated successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaymentStatusUpdate = async () => {
    if (!order || paymentStatusUpdate === order.paymentStatus) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const updated = await adminOrdersService.updatePaymentStatus(order.id, paymentStatusUpdate, token);
      setOrder(updated);
      alert('Payment status updated successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShippingUpdate = async () => {
    if (!order) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const updated = await adminOrdersService.updateShipping(
        order.id,
        {
          trackingNumber: trackingNumber || undefined,
          carrier: carrier || undefined,
        },
        token
      );
      setOrder(updated);
      alert('Shipping information updated successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update shipping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesUpdate = async () => {
    if (!order) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const updated = await adminOrdersService.addNotes(order.id, internalNotes, token);
      setOrder(updated);
      alert('Internal notes updated successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update notes');
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-light">
        <Header title="Order Details" subtitle="" />
        <div className="p-6 text-center text-gray-medium">Loading order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-light">
        <Header title="Order Details" subtitle="" />
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error || 'Order not found'}
          </div>
          <Link href="/admin/orders" className="text-black hover:text-gray-dark font-medium">
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title={`Order ${order.orderNumber}`}
        subtitle={new Date(order.createdAt).toLocaleDateString('en-IN')}
      />

      <div className="p-6 max-w-6xl">
        <Link href="/admin/orders" className="text-black hover:text-gray-dark font-medium mb-6 inline-block">
          ← Back to Orders
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Customer Information</h2>
              <div className="space-y-2 text-sm">
                <p className="text-gray-dark">
                  <span className="font-medium text-black">Name:</span> {order.user?.firstName} {order.user?.lastName}
                </p>
                <p className="text-gray-dark">
                  <span className="font-medium text-black">Email:</span> {order.user?.email}
                </p>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Delivery Address</h2>
              {order.address ? (
                <div className="space-y-1 text-sm text-gray-dark">
                  <p className="font-medium text-black">{order.address.firstName} {order.address.lastName}</p>
                  <p>{order.address.street1}</p>
                  {order.address.street2 && <p>{order.address.street2}</p>}
                  {order.address.landmark && <p>Near {order.address.landmark}</p>}
                  <p>{order.address.city}, {order.address.state} - {order.address.postalCode}</p>
                  <p>{order.address.country}</p>
                  <p>Phone: {order.address.phoneNumber}</p>
                </div>
              ) : (
                <p className="text-sm text-amber-700">No delivery address on file for this order.</p>
              )}
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Items</h2>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start border-b border-gray-light pb-4 last:border-b-0">
                    <div className="flex-1">
                      <p className="font-medium text-black">{item.product?.name || 'Product'}</p>
                      <p className="text-sm text-gray-medium">SKU: {item.product?.sku}</p>
                      {item.selectedSize && <p className="text-sm text-gray-medium">Size: {item.selectedSize}</p>}
                      {item.selectedColor && <p className="text-sm text-gray-medium">Color: {item.selectedColor}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-medium">Qty: {item.quantity}</p>
                      <p className="font-medium text-black">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Pricing</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-dark">Subtotal:</span>
                  <span className="text-black font-medium">{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-dark">Shipping:</span>
                  <span className="text-black font-medium">{formatPrice(order.shipping)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-dark">GST{order.taxRate ? ` (${order.taxRate}%)` : ''}:</span>
                  <span className="text-black font-medium">{formatPrice(order.tax)}</span>
                </div>
                {!!order.cgst && (
                  <div className="flex justify-between pl-4 text-xs">
                    <span className="text-gray-medium">CGST:</span>
                    <span className="text-gray-medium">{formatPrice(order.cgst)}</span>
                  </div>
                )}
                {!!order.sgst && (
                  <div className="flex justify-between pl-4 text-xs">
                    <span className="text-gray-medium">SGST:</span>
                    <span className="text-gray-medium">{formatPrice(order.sgst)}</span>
                  </div>
                )}
                {!!order.igst && (
                  <div className="flex justify-between pl-4 text-xs">
                    <span className="text-gray-medium">IGST:</span>
                    <span className="text-gray-medium">{formatPrice(order.igst)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-light pt-2 mt-2">
                  <span className="font-semibold text-black">Total:</span>
                  <span className="font-semibold text-black">{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Shipping Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Carrier</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                    placeholder="e.g., Delhivery, Blue Dart, India Post"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                    placeholder="e.g., 1234567890"
                  />
                </div>
                <button
                  onClick={handleShippingUpdate}
                  disabled={isSaving}
                  className="w-full px-4 py-2 bg-black text-white rounded font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
                >
                  Update Shipping
                </button>
              </div>
            </div>

            {/* Internal Notes */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Internal Notes</h2>
              <div className="space-y-4">
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                  placeholder="Admin-only notes..."
                  rows={4}
                />
                <button
                  onClick={handleNotesUpdate}
                  disabled={isSaving}
                  className="w-full px-4 py-2 bg-black text-white rounded font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm font-semibold text-black mb-3">Fulfillment Status</h3>
              <div className="mb-4 flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                  {formatStatus(order.status)}
                </span>
              </div>
              <select
                value={statusUpdate}
                onChange={(e) => setStatusUpdate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-light rounded text-sm mb-3 focus:outline-none focus:border-black"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{formatStatus(s)}</option>
                ))}
              </select>
              <button
                onClick={handleStatusUpdate}
                disabled={isSaving || statusUpdate === order.status}
                className="w-full px-4 py-2 bg-black text-white rounded text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                Update Status
              </button>
            </div>

            {/* Payment Status */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm font-semibold text-black mb-3">Payment Status</h3>
              <div className="mb-4 flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  order.paymentStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {formatStatus(order.paymentStatus)}
                </span>
              </div>
              <p className="text-xs text-gray-medium mb-3">
                <span className="font-medium text-black">Method:</span> {formatStatus(order.paymentMethod)}
              </p>
              <select
                value={paymentStatusUpdate}
                onChange={(e) => setPaymentStatusUpdate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-light rounded text-sm mb-3 focus:outline-none focus:border-black"
              >
                {PAYMENT_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{formatStatus(s)}</option>
                ))}
              </select>
              <button
                onClick={handlePaymentStatusUpdate}
                disabled={isSaving || paymentStatusUpdate === order.paymentStatus}
                className="w-full px-4 py-2 bg-black text-white rounded text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                Update Payment
              </button>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
                ⚠️ Changing payment status does not process refunds or charges. Update this only to reflect actual payment state.
              </div>
            </div>

            {/* Order Info */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm font-semibold text-black mb-3">Order Info</h3>
              <div className="space-y-2 text-xs">
                <p className="text-gray-dark">
                  <span className="font-medium text-black">Order ID:</span> {order.orderNumber}
                </p>
                <p className="text-gray-dark">
                  <span className="font-medium text-black">Placed:</span> {new Date(order.createdAt).toLocaleDateString('en-IN')}
                </p>
                <p className="text-gray-dark">
                  <span className="font-medium text-black">Method:</span> {formatStatus(order.shippingMethod)}
                </p>
              </div>
            </div>

            {/* Invoice */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-sm font-semibold text-black mb-3">Invoice</h3>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
                    if (!token) return;
                    try {
                      // Ensure invoice exists first (idempotent)
                      await adminOrdersService.generateInvoice(order.id, token);
                      const blob = await adminOrdersService.downloadInvoicePdf(order.id, token);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `invoice-${order.orderNumber}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Could not download invoice');
                    }
                  }}
                  disabled={isSaving}
                  className="w-full px-4 py-2 bg-black text-white rounded text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Invoice PDF
                </button>
                <p className="text-xs text-gray-medium">Invoice is generated automatically for paid and COD orders.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
