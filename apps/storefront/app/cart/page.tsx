'use client';

import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/pricing';
import Link from 'next/link';

export default function CartPage() {
  const { items, removeItem, updateQuantity } = useCart();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-cream pt-20 md:pt-24">
        {/* Breadcrumbs */}
        <div className="px-4 md:px-8 py-4 border-b border-gray-300">
          <nav className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
            <Link href="/" className="hover:text-black transition-colors">
              HOME
            </Link>
            <span>/</span>
            <span className="text-black font-medium">CART</span>
          </nav>
        </div>

        {/* Empty State */}
        <div className="px-4 md:px-8 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">Your Cart is Empty</h1>
          <p className="text-gray-700 text-base md:text-lg mb-8">
            Add items to your cart and they'll appear here.
          </p>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 bg-black text-cream font-medium rounded hover:bg-gray-900 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream pt-20 md:pt-24">
      {/* Breadcrumbs */}
      <div className="px-4 md:px-8 py-4 border-b border-gray-300">
        <nav className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
          <Link href="/" className="hover:text-black transition-colors">
            HOME
          </Link>
          <span>/</span>
          <span className="text-black font-medium">CART</span>
        </nav>
      </div>

      {/* Page Header */}
      <div className="px-4 md:px-8 py-8 border-b border-gray-300">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-black mb-2">Shopping Cart</h1>
        <p className="text-gray-700 text-sm md:text-base">
          {items.length} item{items.length !== 1 ? 's' : ''} in your cart
        </p>
      </div>

      {/* Cart Layout */}
      <div className="flex flex-col lg:flex-row gap-8 px-4 md:px-8 py-8">
        {/* Cart Items */}
        <div className="flex-1 min-w-0">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 pb-4 border-b border-gray-light last:border-0"
              >
                {/* Product Image */}
                <div className="w-20 h-20 md:w-32 md:h-32 flex-shrink-0 bg-gray-light rounded overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Product Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-medium text-black text-sm md:text-base mb-1">
                      {item.name}
                    </h3>
                    <div className="text-xs md:text-sm text-gray-medium mb-2">
                      {item.selectedSize && (
                        <span>
                          Size: <span className="font-medium">{item.selectedSize}</span>
                        </span>
                      )}
                      {item.selectedSize && item.selectedColor && <span> • </span>}
                      {item.selectedColor && (
                        <span>
                          Color: <span className="font-medium capitalize">{item.selectedColor}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-base md:text-lg font-medium text-black">
                      {formatPrice(item.price)}
                    </p>
                  </div>

                  {/* Quantity and Remove */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-black rounded">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-black hover:bg-gray-light transition-colors"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-black">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-black hover:bg-gray-light transition-colors"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs font-medium text-gray-dark hover:text-black transition-colors"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>

                {/* Line Total */}
                <div className="text-right flex-shrink-0">
                  <p className="text-base md:text-lg font-medium text-black">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                  <p className="text-xs text-gray-medium mt-1">
                    {item.quantity}x {formatPrice(item.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Continue Shopping */}
          <div className="mt-8">
            <Link
              href="/shop"
              className="inline-block px-4 py-2 border border-black text-black text-sm font-medium hover:bg-black hover:text-cream transition-colors rounded"
            >
              CONTINUE SHOPPING →
            </Link>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-cream rounded-lg p-6 sticky top-24">
            <h2 className="text-lg font-bold text-black mb-6">Order Summary</h2>

            {/* Summary Lines */}
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between text-gray-dark">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-dark">
                <span>Shipping</span>
                <span className="text-gray-medium">Calculated at checkout</span>
              </div>
              <div className="flex justify-between text-gray-dark">
                <span>Tax</span>
                <span className="text-gray-medium">Calculated at checkout</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between text-base font-bold text-black pt-6 border-t border-gray-light mb-6">
              <span>TOTAL (excl. shipping)</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {/* Checkout Button */}
            <Link
              href="/checkout"
              className="block w-full px-4 py-3 bg-black text-cream font-medium rounded hover:bg-gray-dark transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              PROCEED TO CHECKOUT
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
