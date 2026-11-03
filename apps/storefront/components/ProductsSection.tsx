'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProductCard } from './ProductCard';

interface ApiProduct {
  id: string;
  name: string;
  price: number;
  category?: { name: string } | null;
  images?: Array<{ url: string; alt?: string }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export const ProductsSection: React.FC = () => {
  const [products, setProducts] = useState<ApiProduct[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/products?limit=4&sort=newest`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled) setProducts(data.data || []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-cream py-20 md:py-32 px-4 sm:px-6 md:px-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
            Shop the Collection
          </h2>
          <p className="text-base md:text-lg text-gray-700">
            Curated essentials. Hoodies, tees, and more.
          </p>
        </div>

        {/* Products grid */}
        {products === null ? (
          <div className="text-center text-gray-medium py-12">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-center text-gray-medium py-12">
            No products available yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                category={product.category?.name || ''}
                image={product.images?.[0]?.url}
                href={`/products/${product.id}`}
              />
            ))}
          </div>
        )}

        {/* View all CTA */}
        <div className="flex justify-center">
          <Link
            href="/shop"
            className="px-8 py-3 border border-black text-black font-semibold hover:bg-black hover:text-cream transition-colors rounded"
          >
            View All Products
          </Link>
        </div>
      </div>
    </section>
  );
};
