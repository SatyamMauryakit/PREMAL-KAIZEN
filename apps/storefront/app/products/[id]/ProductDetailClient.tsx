'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { getCheckoutSettings, ShippingMethodOption } from '@/lib/checkout-settings';
import { getStoreContactInfo } from '@/lib/store-info';
import { recordProductView } from '@/lib/recently-viewed';
import { ImageGallery } from '@/components/product/ImageGallery';
import { SizeGuideModal } from '@/components/product/SizeGuideModal';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { ProductReviews } from '@/components/product/ProductReviews';

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

interface ProductDetailClientProps {
  productId: string;
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-cream pt-20 md:pt-24 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-200 rounded-lg" />
          <div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-6" />
            <div className="h-10 bg-gray-200 rounded w-1/3 mb-6" />
            <div className="h-20 bg-gray-200 rounded w-full mb-6" />
            <div className="h-12 bg-gray-200 rounded w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailClient({ productId }: ProductDetailClientProps) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [cheapestShipping, setCheapestShipping] = useState<ShippingMethodOption | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
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

        // Default to an actually in-stock combination when one exists, rather
        // than blindly picking colors[0]/sizes[0] independently - if that
        // first color and first size happen to form an out-of-stock pair
        // (common once a popular variant sells out), defaulting to it anyway
        // left every other size/color looking disabled too (each one checked
        // only against the other's current, dead-stock selection), even
        // though other combinations were still purchasable. Falls back to
        // colors[0]/sizes[0] when the product has no tracked inventory at all
        // (untracked = always available) or is genuinely out of stock everywhere.
        const inStockRow = Array.isArray(data.inventory)
          ? data.inventory.find((i: { size: string | null; color: string | null; available: number }) => i.available > 0)
          : null;

        if (inStockRow) {
          setSelectedColor(inStockRow.color ?? (data.colors?.[0] || null));
          setSelectedSize(inStockRow.size ?? (data.sizes?.[0] || null));
        } else {
          if (data.colors && data.colors.length > 0) {
            setSelectedColor(data.colors[0]);
          }
          if (data.sizes && data.sizes.length > 0) {
            setSelectedSize(data.sizes[0]);
          }
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

  // Records a view only once per distinct loaded product (keyed on product?.id,
  // not the whole product object), never for a product that failed to load.
  useEffect(() => {
    if (product?.id) {
      recordProductView(product.id);
    }
  }, [product?.id]);

  useEffect(() => {
    getCheckoutSettings()
      .then((settings) => {
        const cheapest = [...settings.shippingMethods].sort((a, b) => a.price - b.price)[0];
        setCheapestShipping(cheapest || null);
      })
      .catch(() => setCheapestShipping(null));
  }, []);

  // Real, admin-configured store name (same source Footer/Contact use) - used as
  // the "Brand" field below, since this is a single-brand store (no Brand model
  // exists in the schema) rather than a fabricated per-product brand.
  useEffect(() => {
    getStoreContactInfo()
      .then((info) => setStoreName(info.storeName))
      .catch(() => setStoreName(null));
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

  // A size/color swatch is only disabled when NO combination offers it in
  // stock at all - checked across every tracked row for that size/color, not
  // just against whatever the other dimension currently happens to be
  // selected. Anchoring to the other current selection (as this used to)
  // meant that if the *first* color+size pair (the default selection) was
  // itself out of stock, every other size looked disabled too (each checked
  // only against that dead color) and every other color looked disabled too
  // (each checked only against that dead size) - cascading into the entire
  // selector appearing unavailable even when other in-stock combinations
  // existed. The exact selected pair is still enforced separately by
  // `outOfStock`/`trackedStock` below, which gates the actual Add to Cart action.
  const isSizeOutOfStock = (size: string) => {
    if (!product?.inventory) return false;
    const rows = product.inventory.filter((i) => i.size === size);
    if (rows.length === 0) return false; // untracked = always available
    return rows.every((i) => i.available <= 0);
  };

  const isColorOutOfStock = (color: string) => {
    if (!product?.inventory) return false;
    const rows = product.inventory.filter((i) => i.color === color);
    if (rows.length === 0) return false;
    return rows.every((i) => i.available <= 0);
  };

  const discountPercent =
    product?.originalPrice && product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : null;

  const addToCart = () => {
    if (!product) return;
    cart.addItem({
      productId: product.id,
      name: product.name,
      // cart/wishlist state is stored in rupees (matching lib/products.ts and
      // lib/pricing.ts's formatPrice) - product.price here is still the raw
      // paise value from the API response, used as-is elsewhere on this page
      // only for this local formatPrice()'s own /100 display conversion.
      price: Math.round(product.price / 100),
      image: product.images?.[0]?.url || '',
      quantity,
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined,
    });
  };

  const handleAddToCart = () => {
    addToCart();
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  // Reuses the exact same cart + checkout flow as the regular cart - checkout
  // reads whatever is currently in CartContext, so "Buy Now" is just "add this
  // item, then go straight to checkout" with zero new checkout logic.
  const handleBuyNow = () => {
    addToCart();
    router.push('/checkout');
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    wishlist.toggleItem({
      productId: product.id,
      name: product.name,
      // Same rupee conversion as addToCart above - wishlist state uses the same
      // convention as cart state.
      price: Math.round(product.price / 100),
      image: product.images?.[0]?.url || '',
      category: product.category?.name || '',
    });
  };

  if (isLoading) {
    return <DetailSkeleton />;
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
            <ImageGallery images={product.images || []} productName={product.name} />

            {/* Details */}
            <div>
              <h1 className="text-4xl font-bold text-black mb-1">{product.name}</h1>

              {storeName && (
                <p className="text-sm text-gray-medium mb-2">by <span className="font-medium text-gray-dark">{storeName}</span></p>
              )}

              {/* SKU */}
              <p className="text-sm text-gray-medium mb-4">SKU: {product.sku}</p>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-4xl font-bold text-black">
                    {formatPrice(product.price)}
                  </span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="text-lg text-gray-medium line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  )}
                  {discountPercent !== null && (
                    <span className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                      {discountPercent}% off
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-medium mt-1">Inclusive of all taxes</p>
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
                    {product.colors.map((color) => {
                      const outOfStockColor = isColorOutOfStock(color);
                      return (
                        <button
                          key={color}
                          onClick={() => !outOfStockColor && setSelectedColor(color)}
                          disabled={outOfStockColor}
                          className={`px-4 py-2 rounded border-2 transition-colors ${
                            outOfStockColor
                              ? 'border-gray-light text-gray-300 line-through cursor-not-allowed'
                              : selectedColor === color
                                ? 'border-black bg-black text-cream'
                                : 'border-gray-light text-black hover:border-black'
                          }`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-black">
                      Size
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsSizeGuideOpen(true)}
                      className="text-sm text-black underline hover:no-underline"
                    >
                      Size Guide
                    </button>
                  </div>
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

              {/* Add to Cart, Buy Now & Wishlist */}
              <div className="flex gap-4 mb-4">
                <button
                  onClick={handleAddToCart}
                  disabled={outOfStock}
                  className="flex-1 px-6 py-3 bg-black text-cream font-semibold rounded hover:bg-gray-dark transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addedToCart ? 'Added ✓' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <button
                  onClick={handleToggleWishlist}
                  aria-label={wishlist.isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`px-6 py-3 border-2 font-semibold rounded transition-colors text-lg ${
                    wishlist.isInWishlist(product.id)
                      ? 'bg-black text-cream border-black'
                      : 'border-black text-black hover:bg-black hover:text-cream'
                  }`}
                >
                  {wishlist.isInWishlist(product.id) ? '♥' : '♡'}
                </button>
              </div>
              <button
                onClick={handleBuyNow}
                disabled={outOfStock}
                className="w-full px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-cream transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed mb-8"
              >
                Buy Now
              </button>

              {/* Product quality & delivery info */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl" aria-hidden="true">✨</span>
                  <p className="text-xs text-gray-medium">Premium Quality | Mix Fabrics</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl" aria-hidden="true">🚚</span>
                  <p className="text-xs text-gray-medium">Pan-India Delivery</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl" aria-hidden="true">⚡</span>
                  <p className="text-xs text-gray-medium">Fast &amp; Secure Prepaid Delivery</p>
                </div>
              </div>

              {/* Trust indicators */}
              <div className="grid grid-cols-2 gap-3 mb-8 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl" aria-hidden="true">🔒</span>
                  <p className="text-xs text-gray-medium">Secure Payments via Razorpay</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl" aria-hidden="true">↩️</span>
                  <Link href="/returns" className="text-xs text-gray-medium underline hover:no-underline">
                    Easy Returns &amp; Exchanges
                  </Link>
                </div>
              </div>

              {/* Additional Info */}
              <div className="border-t border-gray-light pt-6 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-medium">Availability</span>
                  <span className={!outOfStock ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {!outOfStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                {product.category && (
                  <div className="flex justify-between">
                    <span className="text-gray-medium">Category</span>
                    <span className="text-black font-semibold">{product.category.name}</span>
                  </div>
                )}
                {cheapestShipping && (
                  <div className="flex justify-between">
                    <span className="text-gray-medium">Shipping</span>
                    <span className="text-black font-semibold">
                      {cheapestShipping.name} - {formatPrice(cheapestShipping.price)}
                      {cheapestShipping.estimatedDays ? ` (${cheapestShipping.estimatedDays} days)` : ''}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-medium">Returns</span>
                  <Link href="/returns" className="text-black font-semibold underline hover:no-underline">
                    7-day return policy
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews */}
          <ProductReviews productId={product.id} />

          {/* Related Products - extra bottom padding on mobile only, since this is
              now the last content before the fixed sticky purchase bar below, which
              would otherwise cover its bottom edge. */}
          <div className="pb-28 md:pb-0">
            <RelatedProducts currentProductId={product.id} />
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

      <SizeGuideModal isOpen={isSizeGuideOpen} onClose={() => setIsSizeGuideOpen(false)} />
    </>
  );
}
