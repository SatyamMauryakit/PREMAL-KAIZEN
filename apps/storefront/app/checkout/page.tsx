'use client';

import { useCart } from '@/lib/cart-context';
import { useCheckout } from '@/lib/checkout-context';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect } from 'react';
import CheckoutProgress from '@/components/checkout/CheckoutProgress';
import CartReview from '@/components/checkout/CartReview';
import CustomerInfo from '@/components/checkout/CustomerInfo';
import ShippingForm from '@/components/checkout/ShippingForm';
import PaymentForm from '@/components/checkout/PaymentForm';
import OrderReview from '@/components/checkout/OrderReview';

export default function CheckoutPage() {
  const { items } = useCart();
  const { currentStep, goToStep, error, isLoading } = useCheckout();
  const { user } = useAuth();

  useEffect(() => {
    if (items.length === 0) {
      // Redirect to cart if empty
      window.location.href = '/cart';
    }
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <main className="min-h-screen bg-cream pt-20 md:pt-24">
      {/* Breadcrumb */}
      <div className="px-4 md:px-8 py-4 border-b border-gray-300">
        <nav className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
          <Link href="/" className="hover:text-black transition-colors">HOME</Link>
          <span>/</span>
          <Link href="/cart" className="hover:text-black transition-colors">CART</Link>
          <span>/</span>
          <span className="text-black font-medium">CHECKOUT</span>
        </nav>
      </div>

      {/* Page Header */}
      <div className="px-4 md:px-8 py-8 border-b border-gray-300">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-black mb-2">Checkout</h1>
        <p className="text-gray-700 text-sm md:text-base">
          Complete your purchase in 4 simple steps
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-4 md:mx-8 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Progress Indicator */}
      <div className="px-4 md:px-8 py-8">
        <CheckoutProgress />
      </div>

      {/* Main Checkout Flow */}
      <div className="px-4 md:px-8 pb-16">
        {currentStep === 'cart' && <CartReview />}
        {currentStep === 'information' && <CustomerInfo />}
        {currentStep === 'shipping' && <ShippingForm />}
        {currentStep === 'payment' && <PaymentForm />}
        {currentStep === 'review' && <OrderReview />}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-cream rounded-lg p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4"></div>
            <p className="text-black font-medium">Processing...</p>
          </div>
        </div>
      )}
    </main>
  );
}
