'use client';

import Link from 'next/link';
import { useWishlist } from '@/lib/wishlist-context';

export default function WishlistPage() {
  const { items } = useWishlist();

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-black mb-6">My Wishlist</h2>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-6">Your wishlist is empty</p>
          <Link href="/shop" className="inline-block bg-black text-cream px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.productId} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="font-semibold text-black mb-2">{item.name}</h3>
                <p className="text-beige font-bold mb-4">₹{(item.price / 100).toLocaleString('en-IN')}</p>
                <button className="w-full bg-black text-cream py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
