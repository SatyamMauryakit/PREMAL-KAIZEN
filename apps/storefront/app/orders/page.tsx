'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { orderService, Order, OrderTimeline } from '@/lib/order-service';
import { formatPaise } from '@/lib/pricing';

type TrackingMode = 'authenticated' | 'guest' | null;

export default function TrackOrderPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [mode, setMode] = useState<TrackingMode>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderTimeline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user is authenticated, set to authenticated mode
  useEffect(() => {
    if (!authLoading && user) {
      setMode('authenticated');
    }
  }, [user, authLoading]);

  const handleAuthenticatedSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError('Please enter an order number');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOrder(null);
    setTimeline([]);

    try {
      const token = localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      // Find order by number from user's order history
      const response = await orderService.getOrders(token);
      const foundOrder = response.orders?.find(
        (o: Order) => o.orderNumber.toLowerCase() === orderNumber.toLowerCase()
      );

      if (!foundOrder) {
        setError('Order not found. Please check your order number and try again.');
        return;
      }

      setOrder(foundOrder);
      const orderTimeline = await orderService.getOrderTimeline(foundOrder.id, token);
      setTimeline(orderTimeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !verificationCode.trim()) {
      setError('Please enter both order number and email address');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOrder(null);
    setTimeline([]);

    try {
      if (!verificationCode.includes('@')) {
        setError('Please enter a valid email address to verify your order.');
        return;
      }

      const foundOrder = await orderService.trackGuestOrder(orderNumber.trim(), verificationCode.trim());
      setOrder(foundOrder);
      setTimeline(orderService.timelineForOrder(foundOrder));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-blue-100 text-blue-800',
    packed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    out_for_delivery: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-red-100 text-red-800',
  };

  return (
    <div className="min-h-screen bg-cream pt-20 pb-16">
      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Track Order</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-black mb-3 tracking-tight">
            Track Your Order
          </h1>
          <p className="text-lg text-gray-dark leading-relaxed">
            {user
              ? "Enter your order number to see the latest status and tracking information."
              : "Enter your order number and email to track your shipment."}
          </p>
        </div>

        {/* Mode Selection (for non-authenticated users) */}
        {!user && mode === null && (
          <div className="bg-white rounded-lg border border-gray-light p-8 mb-8">
            <p className="text-center text-gray-dark mb-6">
              How would you like to track your order?
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <button
                onClick={() => setMode('authenticated')}
                className="px-6 py-3 bg-black text-cream rounded hover:bg-gray-dark transition-colors font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => setMode('guest')}
                className="px-6 py-3 border border-black text-black rounded hover:bg-black hover:text-cream transition-colors font-medium"
              >
                Track as Guest
              </button>
            </div>
          </div>
        )}

        {/* Sign In Prompt */}
        {!user && mode === 'authenticated' && !order && (
          <div className="bg-white rounded-lg border border-gray-light p-8 mb-8">
            <p className="text-center text-gray-dark mb-6">
              Please sign in to your account to track your order.
            </p>
            <div className="text-center">
              <Link
                href="/auth/signin"
                className="inline-block px-6 py-2 bg-black text-cream rounded hover:bg-gray-dark transition-colors font-medium"
              >
                Sign In to Your Account
              </Link>
            </div>
            <div className="text-center mt-4">
              <button
                onClick={() => setMode(null)}
                className="text-sm text-gray-medium hover:text-black transition-colors underline"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Search Form */}
        {(authLoading || (user && !order) || (mode === 'guest' && !order)) && (
          <div className="bg-white rounded-lg border border-gray-light p-8 mb-8">
            <form
              onSubmit={mode === 'authenticated' || (user && !order) ? handleAuthenticatedSearch : handleGuestSearch}
              className="space-y-6"
            >
              {/* Order Number Input */}
              <div>
                <label htmlFor="orderNumber" className="block text-sm font-medium text-black mb-2">
                  Order Number *
                </label>
                <input
                  id="orderNumber"
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g., PK-2024-001"
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black transition-colors"
                  required
                />
                <p className="text-xs text-gray-medium mt-1">
                  You'll find this in your confirmation email
                </p>
              </div>

              {/* Email Input (Guest Only) */}
              {mode === 'guest' && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-black mb-2">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black transition-colors"
                    required
                  />
                  <p className="text-xs text-gray-medium mt-1">
                    Enter the email address associated with your order
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-black text-cream rounded hover:bg-gray-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Searching...' : 'Track Order'}
              </button>

              {mode === 'guest' && (
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="w-full text-sm text-gray-medium hover:text-black transition-colors underline text-center py-2"
                >
                  ← Back
                </button>
              )}
            </form>
          </div>
        )}

        {/* Order Details */}
        {order && (
          <div className="space-y-8">
            {/* Order Summary */}
            <div className="bg-white rounded-lg border border-gray-light p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div>
                  <p className="text-xs text-gray-medium uppercase tracking-wide font-medium mb-1">
                    Order Number
                  </p>
                  <p className="text-lg font-bold text-black">{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-medium uppercase tracking-wide font-medium mb-1">
                    Order Date
                  </p>
                  <p className="text-lg font-bold text-black">
                    {new Date(order.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-medium uppercase tracking-wide font-medium mb-1">
                    Total
                  </p>
                  <p className="text-lg font-bold text-black">{formatPaise(order.total)}</p>
                </div>
              </div>

              {/* Status Badges */}
              <div className="border-t border-gray-light pt-6 space-y-4">
                <div>
                  <p className="text-xs text-gray-medium uppercase tracking-wide font-medium mb-2">
                    Order Status
                  </p>
                  <span
                    className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                      statusStyles[order.orderStatus as keyof typeof statusStyles]
                    }`}
                  >
                    {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1).replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-medium uppercase tracking-wide font-medium mb-2">
                    Payment Status
                  </p>
                  <span
                    className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                      order.paymentStatus === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : order.paymentStatus === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-light p-8">
                <h2 className="text-xl font-bold text-black mb-8">Shipment Timeline</h2>
                <div className="space-y-6">
                  {timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-4 h-4 bg-black rounded-full"></div>
                        {idx < timeline.length - 1 && (
                          <div className="w-0.5 h-12 bg-gray-light mt-2"></div>
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="font-bold text-black">
                          {event.status.charAt(0).toUpperCase() + event.status.slice(1).replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-dark mt-1">{event.description}</p>
                        <p className="text-xs text-gray-medium mt-2">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shipping Information */}
            {order.carrier && order.trackingNumber && (
              <div className="bg-white rounded-lg border border-gray-light p-8">
                <h2 className="text-xl font-bold text-black mb-6">Shipping Information</h2>
                <div className="space-y-4">
                  {order.carrier && (
                    <div>
                      <p className="text-xs text-gray-medium uppercase tracking-wide font-medium mb-1">
                        Carrier
                      </p>
                      <p className="text-lg text-black">{order.carrier}</p>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div>
                      <p className="text-xs text-gray-medium uppercase tracking-wide font-medium mb-1">
                        Tracking Number
                      </p>
                      <p className="text-lg font-mono text-black">{order.trackingNumber}</p>
                    </div>
                  )}
                  {order.estimatedDelivery && (
                    <div>
                      <p className="text-xs text-gray-medium uppercase tracking-wide font-medium mb-1">
                        Estimated Delivery
                      </p>
                      <p className="text-lg text-black">
                        {new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-medium mt-6 pt-6 border-t border-gray-light">
                  Note: Carrier tracking information is not currently available. Please check back soon for updates.
                </p>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-white rounded-lg border border-gray-light p-8">
              <h2 className="text-xl font-bold text-black mb-6">Order Items</h2>
              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start pb-4 border-b border-gray-light last:border-b-0">
                    <div className="flex-1">
                      <p className="font-medium text-black">{item.name}</p>
                      <p className="text-sm text-gray-medium mt-1">
                        Quantity: {item.quantity}
                        {item.selectedSize && ` • Size: ${item.selectedSize}`}
                        {item.selectedColor && ` • Color: ${item.selectedColor}`}
                      </p>
                    </div>
                    <p className="font-medium text-black text-right">
                      {formatPaise(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-lg border border-gray-light p-8">
              <h2 className="text-xl font-bold text-black mb-6">Delivery Address</h2>
              <div className="text-gray-dark space-y-1">
                <p className="font-medium text-black">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </p>
                <p>{order.shippingAddress.street1}</p>
                {order.shippingAddress.street2 && <p>{order.shippingAddress.street2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                </p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => {
                setOrder(null);
                setTimeline([]);
                setOrderNumber('');
                setVerificationCode('');
                setError(null);
                setMode(null);
              }}
              className="w-full py-3 border border-black text-black rounded hover:bg-black hover:text-cream transition-colors font-medium"
            >
              Track Another Order
            </button>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-16 pt-12 border-t border-gray-light">
          <h2 className="text-2xl font-bold text-black mb-8">Need Help?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-black mb-2">Can't find your order?</h3>
              <p className="text-gray-dark text-sm mb-4">
                If you're having trouble locating your order, please check your email for your order confirmation. It contains your order number.
              </p>
              <Link
                href="/contact"
                className="inline-block text-black font-medium underline hover:no-underline"
              >
                Contact Support →
              </Link>
            </div>
            <div>
              <h3 className="font-bold text-black mb-2">Lost your order number?</h3>
              <p className="text-gray-dark text-sm mb-4">
                If you created an account with us, sign in to view all your orders and their details in one place.
              </p>
              <Link
                href="/account/orders"
                className="inline-block text-black font-medium underline hover:no-underline"
              >
                View My Orders →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
