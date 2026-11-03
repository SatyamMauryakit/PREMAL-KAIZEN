'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { getCheckoutSettings, ShippingMethodOption } from '@/lib/checkout-settings';

interface InventoryItem {
  size: string | null;
  color: string | null;
  available: number;
}

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
  inventory?: InventoryItem[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cheapestShipping, setCheapestShipping] = useState<ShippingMethodOption | null>(null);
  const cart = useCart();
  const wishlist = useWishlist();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const response = await fetch(`${API_BASE}/api/products/${productId}`);

        if (!response.ok) throw new Error('Product not found');

        const data = await response.json();
        setProduct(data);
        setSelectedImageIndex(0);

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

  useEffect(() => {
    getCheckoutSettings()
      .then((settings) => {
        const cheapest = [...settings.shippingMethods].sort((a, b) => a.price - b.price)[0];
        setCheapestShipping(cheapest || null);
      })
      .catch(() => setCheapestShipping(null));
  }, []);

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  // A size/color combination with no matching inventory row is treated as
  // available - this store only enforces a stock limit where one is actually
  // configured, rather than inventing a number.
  const trackedStock = useMemo(() => {
    if (!product?.inventory || product.inventory.length === 0 || !selectedSize) return null;
    const match = product.inventory.find(
      (i) => i.size === selectedSize && (i.color === selectedColor || i.color === null)
    );
    return match ? match.available : null;
  }, [product, selectedSize, selectedColor]);

  const isSizeOutOfStock = (size: string) => {
    if (!product?.inventory) return false;
    const match = product.inventory.find(
      (i) => i.size === size && (i.color === selectedColor || i.color === null)
    );
    return !!match && match.available <= 0;
  };

  const handleAddToCart = () => {
    if (!product) return;
    cart.addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0]?.url || '',
      quantity,
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    wishlist.toggleItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0]?.url || '',
      category: product.category?.name || '',
    });
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

  const outOfStock = !product.isActive || trackedStock === 0;

  return (
    <>
    <div className="min-h-screen bg-cream pt-20 md:pt-24 py-12 px-4 sm:px-6 lg:px-8 pb-28 md:pb-12">
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
                    src={product.images[selectedImageIndex]?.url || product.images[0].url}
                    alt={product.images[selectedImageIndex]?.alt || product.name}
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
                  {product.images.map((image, idx) => (
                    <button
                      key={image.id}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`bg-white rounded border overflow-hidden transition-colors ${
                        selectedImageIndex === idx ? 'border-black' : 'border-gray-light hover:border-black'
                      }`}
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
                    {product.sizes.map((size) => {
                      const outOfStockSize = isSizeOutOfStock(size);
                      return (
                        <button
                          key={size}
                          onClick={() => !outOfStockSize && setSelectedSize(size)}
                          disabled={outOfStockSize}
                          className={`px-4 py-2 rounded border-2 transition-colors ${
                            outOfStockSize
                              ? 'border-gray-light text-gray-300 line-through cursor-not-allowed'
                              : selectedSize === size
                                ? 'border-black bg-black text-cream'
                                : 'border-gray-light text-black hover:border-black'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                  {trackedStock !== null && trackedStock > 0 && trackedStock <= 5 && (
                    <p className="text-sm text-orange-600 mt-2">Only {trackedStock} left in this size</p>
                  )}
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
                    onChange={(e) => {
                      const next = Math.max(1, parseInt(e.target.value) || 1);
                      setQuantity(trackedStock !== null ? Math.min(next, trackedStock) : next);
                    }}
                    className="px-4 py-2 text-center border-l border-r border-gray-light w-16 focus:outline-none"
                    min="1"
                    max={trackedStock !== null ? trackedStock : undefined}
                  />
                  <button
                    onClick={() => setQuantity((q) => (trackedStock !== null ? Math.min(q + 1, trackedStock) : q + 1))}
                    className="px-4 py-2 hover:bg-gray-light transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Add to Cart & Wishlist */}
              <div className="flex gap-4 mb-8">
                <button
                  onClick={handleAddToCart}
                  disabled={outOfStock}
                  className="flex-1 px-6 py-3 bg-black text-cream font-semibold rounded hover:bg-gray-dark transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addedToCart ? 'Added ✓' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <button
                  onClick={handleToggleWishlist}
                  className={`flex-1 px-6 py-3 border-2 font-semibold rounded transition-colors text-lg ${
                    wishlist.isInWishlist(product.id)
                      ? 'bg-black text-cream border-black'
                      : 'border-black text-black hover:bg-black hover:text-cream'
                  }`}
                >
                  {wishlist.isInWishlist(product.id) ? '♥ Wishlisted' : '♡ Wishlist'}
                </button>
              </div>

              {/* Additional Info */}
              <div className="border-t border-gray-light pt-6 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-medium">Availability</span>
                  <span className={!outOfStock ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {!outOfStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                {cheapestShipping && (
                  <div className="flex justify-between">
                    <span className="text-gray-medium">Shipping</span>
                    <span className="text-black font-semibold">
                      {cheapestShipping.name} - {formatPrice(cheapestShipping.price)}
                      {cheapestShipping.estimatedDays ? ` (${cheapestShipping.estimatedDays} days)` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky purchase bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-light p-4 flex items-center gap-4 z-30">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-medium truncate">{product.name}</p>
          <p className="text-lg font-bold text-black">{formatPrice(product.price)}</p>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          className="px-6 py-3 bg-black text-cream font-semibold rounded hover:bg-gray-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {addedToCart ? 'Added ✓' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </>
  );
}
