'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { orderService, Order } from '@/lib/order-service';
import Link from 'next/link';
import { formatPaise } from '@/lib/pricing';

export default function OrdersPage() {
  const { user, isLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !user) return;

    const loadOrders = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        if (!token) throw new Error('Not authenticated');
        const data = await orderService.getOrders(token);
        setOrders(data.orders || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setIsLoadingOrders(false);
      }
    };

    loadOrders();
  }, [user, isLoading]);

  if (isLoading || isLoadingOrders) {
    return <div className="text-center py-12"><p className="text-gray-600">Loading orders...</p></div>;
  }

  if (!user) {
    return <div className="text-center py-12"><p className="text-gray-600">Please sign in to view your orders</p></div>;
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <h2 className="text-2xl font-bold text-black mb-6">My Orders</h2>
        <p className="text-gray-600 mb-6">You haven't placed any orders yet.</p>
        <Link href="/shop" className="inline-block px-6 py-2 bg-black text-cream rounded hover:bg-gray-800">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-black mb-6">My Orders ({orders.length})</h2>

      <div className="space-y-4">
        {orders.map((order) => (
          <Link key={order.id} href={`/account/orders/${order.id}`}>
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:gap-6 mb-3">
                    <h3 className="font-bold text-black">Order {order.orderNumber}</h3>
                    <span className={`inline-block px-3 py-1 rounded text-xs font-medium w-fit ${
                      order.orderStatus === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.orderStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1).replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                  <p className="text-sm text-gray-600 mt-1">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-black">{formatPaise(order.total)}</p>
                  <p className="text-xs text-gray-600 mt-2">→</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
