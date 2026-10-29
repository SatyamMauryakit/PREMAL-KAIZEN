'use client';

import Link from 'next/link';
import { use } from 'react';

interface OrderConfirmationPageProps {
  params: Promise<{ orderId: string }>;
}

export default function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params;

  return (
    <main className="min-h-screen bg-cream pt-20 md:pt-24 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg p-8 md:p-12 text-center">
          <div className="text-6xl mb-6">✓</div>
          <h1 className="text-4xl font-display font-bold text-black mb-4">Order Confirmed!</h1>
          <p className="text-gray-700 text-lg mb-2">Thank you for your purchase.</p>
          <p className="text-gray-600 mb-8">Order ID: <span className="font-mono font-bold">{resolvedParams.orderId}</span></p>

          <div className="bg-cream rounded-lg p-6 mb-8 text-left">
            <p className="text-sm text-gray-700 mb-4">
              A confirmation email has been sent to your email address. You can track your order status in your account.
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>✓ Order placed successfully</li>
              <li>✓ Payment processing</li>
              <li>✓ Confirmation email sent</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Link href="/" className="flex-1 px-4 py-3 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors">CONTINUE SHOPPING</Link>
            <Link href="/account/orders" className="flex-1 px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-800 transition-colors">VIEW ORDERS</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
