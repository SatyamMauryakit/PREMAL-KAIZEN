'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { formatPrice } from '@/lib/pricing';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface OrderConfirmationPageProps {
  params: Promise<{ orderId: string }>;
}

interface OrderDetail {
  orderNumber: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  items: Array<{ id: string; quantity: number; price: number; product: { name: string } }>;
}

export default function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    fetch(`${API_BASE}/api/orders/${resolvedParams.orderId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Order not found'))))
      .then(setOrder)
      .catch((e) => setError(e.message));
  }, [resolvedParams.orderId]);

  return (
    <main className="min-h-screen bg-cream pt-20 md:pt-24 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg p-8 md:p-12 text-center">
          <div className="text-6xl mb-6">✓</div>
          <h1 className="text-4xl font-display font-bold text-black mb-4">Order Confirmed!</h1>
          <p className="text-gray-700 text-lg mb-2">Thank you for your purchase.</p>
          <p className="text-gray-600 mb-8">
            Order: <span className="font-mono font-bold">{order?.orderNumber || resolvedParams.orderId}</span>
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-8 text-left text-sm">
              {error}
            </div>
          )}

          {order && (
            <div className="bg-cream rounded-lg p-6 mb-8 text-left">
              <div className="space-y-2 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm text-gray-700">
                    <span>{item.product.name} × {item.quantity}</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 pt-4 border-t border-gray-300 text-sm">
                <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Voucher {order.couponCode ? `(${order.couponCode})` : ''}</span>
                    <span>-{formatPrice(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-700"><span>Shipping</span><span>{order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</span></div>
                <div className="flex justify-between text-gray-700"><span>Tax</span><span>{formatPrice(order.tax)}</span></div>
                <div className="flex justify-between font-bold text-black pt-2 border-t"><span>Total</span><span>{formatPrice(order.total)}</span></div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Link href="/" className="flex-1 px-4 py-3 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors">CONTINUE SHOPPING</Link>
            <Link href="/account/orders" className="flex-1 px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors">VIEW ORDERS</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
