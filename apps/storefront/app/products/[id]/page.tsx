'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images?: Array<{ id: string; url: string; alt?: string }>;
  sku: string;
  isActive: boolean;
  colors?: string[];
  sizes?: string[];
  category?: { id: string; name: string; slug: string };
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const response = await fetch(`${API_BASE}/api/products/${productId}`);

        if (!response.ok) throw new Error('Product not found');

        const data = await response.json();
        setProduct(data);

        // Set default selections
        if (data.colors && data.colors.length > 0) {
          setSelectedColor(data.colors[0]);
        }
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        setIsLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-gray-medium">Loading product...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center pt-20">
        <p className="text-red-600 mb-4">{error || 'Product not found'}</p>
        <Link href="/shop" className="text-black font-semibold hover:text-gray-dark">
          Back to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pt-20 md:pt-24 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/shop" className="hover:text-black">Shop</Link>
          <span>/</span>
          <span className="text-black font-medium">{product.name}</span>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Images */}
            <div>
              <div className="bg-white rounded-lg border border-gray-light overflow-hidden mb-4">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].alt || product.name}
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="w-full h-96 bg-gray-light flex items-center justify-center">
                    <span className="text-gray-medium">No image available</span>
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              {product.images && product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {product.images.map((image) => (
                    <button
                      key={image.id}
                      className="bg-white rounded border border-gray-light overflow-hidden hover:border-black transition-colors"
                    >
                      <img
                        src={image.url}
                        alt={image.alt || product.name}
                        className="w-full h-24 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div>
              <h1 className="text-4xl font-bold text-black mb-2">{product.name}</h1>

              {/* SKU */}
              <p className="text-sm text-gray-medium mb-4">SKU: {product.sku}</p>

              {/* Rating (placeholder) */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-lg">★</span>
                  ))}
                </div>
                <span className="text-sm text-gray-medium">(127 reviews)</span>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-black">
                    {formatPrice(product.price)}
                  </span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="text-lg text-gray-medium line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-dark mb-6 leading-relaxed">
                {product.description}
              </p>

              {/* Color Selection */}
              {product.colors && product.colors.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-black mb-3">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {product.colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`px-4 py-2 rounded border-2 transition-colors ${
                          selectedColor === color
                            ? 'border-black bg-black text-cream'
                            : 'border-gray-light text-black hover:border-black'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-black mb-3">
                    Size
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 rounded border-2 transition-colors ${
                          selectedSize === size
                            ? 'border-black bg-black text-cream'
                            : 'border-gray-light text-black hover:border-black'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-black mb-3">
                  Quantity
                </label>
                <div className="flex items-center border border-gray-light rounded w-fit">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 hover:bg-gray-light transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="px-4 py-2 text-center border-l border-r border-gray-light w-16 focus:outline-none"
                    min="1"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-2 hover:bg-gray-light transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Add to Cart & Wishlist */}
              <div className="flex gap-4 mb-8">
                <button className="flex-1 px-6 py-3 bg-black text-cream font-semibold rounded hover:bg-gray-dark transition-colors text-lg">
                  Add to Cart
                </button>
                <button className="flex-1 px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-cream transition-colors text-lg">
                  ♡ Wishlist
                </button>
              </div>

              {/* Additional Info */}
              <div className="border-t border-gray-light pt-6 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-medium">Availability</span>
                  <span className={product.isActive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {product.isActive ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-medium">Shipping</span>
                  <span className="text-black font-semibold">Free on orders over ₹500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-medium">Returns</span>
                  <span className="text-black font-semibold">30 days easy return</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
