'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { orderService, Order, OrderTimeline, OrderStatus } from '@/lib/order-service';
import { formatPrice } from '@/lib/pricing';
import Link from 'next/link';

const STATUS_SEQUENCE: OrderStatus[] = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export default function OrderDetailsPage({ params }: { params: { orderId: string } }) {
  const { user, isLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderTimeline[]>([]);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !user) return;

    const loadOrder = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        if (!token) throw new Error('Not authenticated');
        const orderData = await orderService.getOrder(params.orderId, token);
        if (!orderData) throw new Error('Order not found');
        setOrder(orderData);

        const timelineData = await orderService.getOrderTimeline(params.orderId, token);
        setTimeline(timelineData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setIsLoadingOrder(false);
      }
    };

    loadOrder();
  }, [user, isLoading, params.orderId]);

  if (isLoading || isLoadingOrder) {
    return <div className="text-center py-12"><p className="text-gray-600">Loading order...</p></div>;
  }

  if (error || !order) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error || 'Order not found'}
        <Link href="/account/orders" className="block mt-4 text-black font-medium hover:underline">← Back to Orders</Link>
      </div>
    );
  }

  const statusIndex = STATUS_SEQUENCE.indexOf(order.orderStatus);

  return (
    <div className="space-y-8">
      <Link href="/account/orders" className="text-black font-medium hover:underline">← Back to Orders</Link>

      {/* Order Header */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">Order {order.orderNumber}</h1>
            <p className="text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-4 py-2 rounded text-sm font-bold ${
              order.orderStatus === 'delivered' ? 'bg-green-100 text-green-800' :
              order.orderStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1).replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-8 pt-8 border-t">
          <h2 className="font-bold text-black mb-6">Order Status</h2>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-300"></div>

            {/* Timeline items */}
            <div className="space-y-8 relative z-10">
              {STATUS_SEQUENCE.map((status, idx) => (
                <div key={status} className="ml-16">
                  <div className={`absolute left-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx <= statusIndex ? 'bg-black text-cream' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className={idx <= statusIndex ? 'text-black' : 'text-gray-500'}>
                    <p className="font-medium capitalize">{status.replace('_', ' ')}</p>
                    {timeline[idx] && <p className="text-sm text-gray-600">{new Date(timeline[idx].timestamp).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-black mb-6">Order Items</h2>
        <div className="space-y-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex gap-4 pb-4 border-b last:border-0">
              <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded bg-gray-200" />
              <div className="flex-1">
                <h3 className="font-medium text-black">{item.name}</h3>
                {item.selectedSize && <p className="text-xs text-gray-600">Size: {item.selectedSize}</p>}
                {item.selectedColor && <p className="text-xs text-gray-600">Color: {item.selectedColor}</p>}
                <p className="text-sm text-gray-600 mt-1">Qty: {item.quantity}</p>
              </div>
              <p className="font-bold text-black text-right">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Order Summary & Shipping */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Totals */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="font-bold text-black mb-6">Order Totals</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-700">Subtotal</span><span className="font-medium">{formatPrice(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-700">Shipping</span><span className="font-medium">{order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</span></div>
            <div className="flex justify-between"><span className="text-gray-700">Tax</span><span className="font-medium">{formatPrice(order.tax)}</span></div>
            <div className="flex justify-between pt-3 border-t font-bold text-black"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="font-bold text-black mb-6">Shipping Address</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p className="font-medium text-black">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
            <p>{order.shippingAddress.street1}</p>
            {order.shippingAddress.street2 && <p>{order.shippingAddress.street2}</p>}
            <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
            <p className="text-xs text-gray-600 mt-2">{order.shippingAddress.phoneNumber}</p>
          </div>
        </div>
      </div>

      {/* Payment & Tracking Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-cream rounded-lg p-8">
          <h3 className="font-bold text-black mb-3">Payment Information</h3>
          <p className="text-sm text-gray-700 mb-2">Method: <span className="capitalize font-medium">{order.paymentMethod}</span></p>
          <p className="text-sm text-gray-700">Status: <span className={`${order.paymentStatus === 'completed' ? 'text-green-700' : 'text-blue-700'} font-medium capitalize`}>{order.paymentStatus}</span></p>
        </div>

        {order.trackingNumber && (
          <div className="bg-cream rounded-lg p-8">
            <h3 className="font-bold text-black mb-3">Tracking Information</h3>
            <p className="text-sm text-gray-700 mb-2">Number: <span className="font-mono font-bold">{order.trackingNumber}</span></p>
            <p className="text-sm text-gray-700">Carrier: <span className="font-medium">{order.carrier}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
