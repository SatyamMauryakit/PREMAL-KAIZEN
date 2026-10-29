'use client';

import { Product, formatPrice } from '@/lib/products';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import Link from 'next/link';
import { useState } from 'react';

interface ProductGridProps {
  products: Product[];
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products }) => {
  const cart = useCart();
  const wishlist = useWishlist();
  const [addedToCart, setAddedToCart] = useState<string | null>(null);

  const handleAddToCart = (product: Product) => {
    cart.addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
    });
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 2000);
  };

  const handleToggleWishlist = (product: Product) => {
    wishlist.toggleItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
    });
  };

  if (products.length === 0) {
    return (
      <div className="col-span-full py-16 text-center">
        <p className="text-lg text-gray-dark mb-4">No products found.</p>
        <p className="text-sm text-gray-medium">Try adjusting your filters or search query.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <div
          key={product.id}
          className="group flex flex-col h-full bg-white rounded-lg overflow-hidden border border-gray-light hover:border-gray-medium transition-colors"
        >
          {/* Image Container */}
          <div className="relative aspect-square overflow-hidden bg-gray-light flex items-center justify-center">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            />
            {/* Wishlist Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                handleToggleWishlist(product);
              }}
              className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                wishlist.isInWishlist(product.id)
                  ? 'bg-black text-cream'
                  : 'bg-white/80 text-black hover:bg-white'
              }`}
              aria-label={
                wishlist.isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'
              }
            >
              ♡
            </button>
            {/* New Badge */}
            {product.isNew && (
              <div className="absolute top-3 left-3 bg-black text-cream text-xs font-bold px-2 py-1 rounded">
                NEW
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col flex-1 p-4">
            <Link href={`/products/${product.id}`} className="hover:underline">
              <h3 className="text-sm font-medium text-black mb-2 line-clamp-2">
                {product.name}
              </h3>
            </Link>

            {/* Rating */}
            <div className="flex items-center gap-1 mb-2 text-xs">
              <span className="text-black">★ {product.rating}</span>
              <span className="text-gray-medium">({product.reviewCount})</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-4 mt-auto">
              <span className="text-base font-medium text-black">
                ¥{product.price.toLocaleString('en-IN')}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-gray-medium line-through">
                  ¥{product.originalPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                handleAddToCart(product);
              }}
              className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors ${
                addedToCart === product.id
                  ? 'bg-green-600 text-white'
                  : 'bg-black text-cream hover:bg-gray-dark'
              }`}
            >
              {addedToCart === product.id ? '✓ ADDED' : 'ADD TO CART'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
