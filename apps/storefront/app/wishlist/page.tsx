'use client';

import { useWishlist } from '@/lib/wishlist-context';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/pricing';
import Link from 'next/link';

export default function WishlistPage() {
  const { items, removeItem } = useWishlist();
  const { addItem } = useCart();

  const handleAddToCart = (item: (typeof items)[0]) => {
    addItem({
      productId: item.productId,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: 1,
    });
  };

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-white pt-20 md:pt-24">
        {/* Breadcrumbs */}
        <div className="px-4 md:px-8 py-4 border-b border-gray-light">
          <nav className="flex items-center gap-2 text-xs md:text-sm text-gray-dark">
            <Link href="/" className="hover:text-black">
              HOME
            </Link>
            <span>/</span>
            <span className="text-black font-medium">WISHLIST</span>
          </nav>
        </div>

        {/* Empty State */}
        <div className="px-4 md:px-8 py-16 md:py-24 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-4">Your Wishlist is Empty</h1>
          <p className="text-gray-dark text-base md:text-lg mb-8">
            Add items to your wishlist and they'll appear here.
          </p>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 bg-black text-cream font-medium rounded hover:bg-gray-dark transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pt-20 md:pt-24">
      {/* Breadcrumbs */}
      <div className="px-4 md:px-8 py-4 border-b border-gray-light">
        <nav className="flex items-center gap-2 text-xs md:text-sm text-gray-dark">
          <Link href="/" className="hover:text-black">
            HOME
          </Link>
          <span>/</span>
          <span className="text-black font-medium">WISHLIST</span>
        </nav>
      </div>

      {/* Page Header */}
      <div className="px-4 md:px-8 py-8 border-b border-gray-light">
        <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">Wishlist</h1>
        <p className="text-gray-dark text-sm md:text-base">
          {items.length} item{items.length !== 1 ? 's' : ''} saved for later
        </p>
      </div>

      {/* Wishlist Grid */}
      <div className="px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex flex-col bg-white rounded-lg border border-gray-light hover:border-gray-medium transition-colors overflow-hidden"
            >
              {/* Product Image */}
              <div className="w-full aspect-square bg-gray-light overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                />
              </div>

              {/* Product Info */}
              <div className="flex-1 p-4 flex flex-col">
                <h3 className="font-medium text-black text-sm mb-1 line-clamp-2">
                  {item.name}
                </h3>
                <p className="text-xs text-gray-medium mb-3 capitalize">{item.category}</p>
                <p className="text-base font-medium text-black mb-4 mt-auto">
                  {formatPrice(item.price)}
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="w-full px-3 py-2 bg-black text-cream text-xs font-medium rounded hover:bg-gray-dark transition-colors"
                  >
                    ADD TO CART
                  </button>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="w-full px-3 py-2 border border-black text-black text-xs font-medium rounded hover:bg-black hover:text-cream transition-colors"
                  >
                    REMOVE
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Continue Shopping */}
        <div className="mt-12">
          <Link
            href="/shop"
            className="inline-block px-4 py-2 border border-black text-black text-sm font-medium hover:bg-black hover:text-cream transition-colors rounded"
          >
            CONTINUE SHOPPING →
          </Link>
        </div>
      </div>
    </main>
  );
}
