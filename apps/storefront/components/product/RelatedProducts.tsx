'use client';

import { useEffect, useState } from 'react';
import { fetchProducts, Product } from '@/lib/products';
import { ProductCard } from '../ProductCard';

interface RelatedProductsProps {
  currentProductId: string;
}

// Capped at 2 rows of the desktop grid (lg:grid-cols-4 x 2 rows = 8). Fetches one
// extra as a buffer in case the current product itself is in the result set.
const MAX_DISPLAYED = 8;

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-6 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

/**
 * Shows a bounded preview (2 rows) of the live catalog, reusing the existing
 * /api/products endpoint - no category/price narrowing. Active-only and
 * excluding the current product are satisfied by that same endpoint
 * (isActive:true is always applied server-side) plus a client-side filter for
 * the current id.
 *
 * Known limitation: the product list endpoint doesn't include per-variant
 * inventory data (only the single-product endpoint does), so "exclude
 * out-of-stock" isn't applied here - doing so would need an extra inventory
 * lookup per candidate product, which conflicts with "avoid unnecessary API
 * calls." Not implemented; documented rather than faked.
 */
export function RelatedProducts({ currentProductId }: RelatedProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchProducts({ limit: MAX_DISPLAYED + 1 }) // +1 buffer in case the current product is itself in the result
      .then((result) => {
        if (cancelled) return;
        setProducts(result.products.filter((p) => p.id !== currentProductId).slice(0, MAX_DISPLAYED));
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentProductId]);

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="py-12" aria-label="Related products">
      <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">You May Also Like</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                // lib/products.ts's Product type is in rupees (see toProduct()) - ProductCard expects paise.
                price={product.price * 100}
                originalPrice={product.originalPrice ? product.originalPrice * 100 : undefined}
                image={product.image}
                href={`/products/${product.id}`}
                category={product.category}
              />
            ))}
      </div>
    </section>
  );
}
