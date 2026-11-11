'use client';

import { useRecentlyViewed } from '@/lib/recently-viewed';
import { ProductCard } from './ProductCard';

interface RecentlyViewedProductsProps {
  /** Omit the current product from its own "recently viewed" rail (pass on product detail pages). */
  excludeProductId?: string;
  title?: string;
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-40 sm:w-48 animate-pulse">
      <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-6 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export const RecentlyViewedProducts: React.FC<RecentlyViewedProductsProps> = ({
  excludeProductId,
  title = 'Recently Viewed',
}) => {
  const { products, isLoading } = useRecentlyViewed(excludeProductId);

  // Nothing ever viewed (or everything viewed has since been removed/unpublished) -
  // don't show an empty rail at all, matching standard "recently viewed" UX.
  if (!isLoading && products.length === 0) return null;

  return (
    <section className="py-12 px-4 sm:px-6 md:px-8" aria-label={title}>
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">{title}</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map((product) => (
                <div key={product.id} className="flex-shrink-0 w-40 sm:w-48 snap-start">
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    // Product here comes from lib/products.ts, which converts price to
                    // rupees (see toProduct()) - ProductCard expects paise, so convert back.
                    price={product.price * 100}
                    originalPrice={product.originalPrice ? product.originalPrice * 100 : undefined}
                    image={product.image}
                    href={`/products/${product.id}`}
                    category={product.category}
                  />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
};
