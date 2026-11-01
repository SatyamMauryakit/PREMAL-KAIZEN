'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  fetchProducts,
  deriveCategories,
  derivePriceRange,
  filterProducts,
  sortProducts,
} from '@/lib/products';
import { FilterSidebar } from '@/components/FilterSidebar';
import { ProductGrid } from '@/components/ProductGrid';
import { SortDropdown } from '@/components/SortDropdown';

type SortOption = 'featured' | 'price-low' | 'price-high' | 'newest' | 'rating';

export default function ShopPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  const categories = useMemo(() => deriveCategories(allProducts), [allProducts]);
  const priceRange = useMemo(() => derivePriceRange(allProducts), [allProducts]);

  // Load the live catalog once on mount.
  useEffect(() => {
    let cancelled = false;

    fetchProducts()
      .then((products) => {
        if (cancelled) return;
        setAllProducts(products);
        const range = derivePriceRange(products);
        setPriceMin(range.min);
        setPriceMax(range.max);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Failed to load products. Please try again later.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const filtered = filterProducts(allProducts, {
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      priceMin,
      priceMax,
      searchQuery: searchQuery || undefined,
    });
    return sortProducts(filtered, sortBy);
  }, [allProducts, selectedCategories, selectedSizes, selectedColors, priceMin, priceMax, sortBy, searchQuery]);

  const handleClearAll = useCallback(() => {
    setSelectedCategories([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setPriceMin(priceRange.min);
    setPriceMax(priceRange.max);
    setSearchQuery('');
  }, [priceRange]);

  const resultCount = filteredProducts.length;
  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSizes.length > 0 ||
    selectedColors.length > 0 ||
    priceMin > priceRange.min ||
    priceMax < priceRange.max ||
    searchQuery.length > 0;

  return (
    <main className="min-h-screen bg-cream pt-20 md:pt-24">
      {/* Breadcrumbs */}
      <div className="px-4 md:px-8 py-4 border-b border-gray-300">
        <nav className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
          <a href="/" className="hover:text-black transition-colors">
            HOME
          </a>
          <span>/</span>
          <span className="text-black font-medium">SHOP</span>
        </nav>
      </div>

      {/* Page Header */}
      <div className="px-4 md:px-8 py-8 border-b border-gray-300">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-black mb-2">Shop</h1>
        <p className="text-gray-700 text-sm md:text-base">
          {isLoading
            ? 'Loading products...'
            : `${resultCount} product${resultCount !== 1 ? 's' : ''} available${
                hasActiveFilters ? ` • matching your filters` : ''
              }`}
        </p>
      </div>

      {loadError && (
        <div className="mx-4 md:mx-8 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {loadError}
        </div>
      )}

      {/* Shop Layout */}
      <div className="flex flex-col md:flex-row gap-8 px-4 md:px-8 py-8">
        {/* Sidebar - Desktop Only */}
        <aside className="hidden md:block md:w-64 flex-shrink-0">
          <FilterSidebar
            selectedCategories={selectedCategories}
            selectedSizes={selectedSizes}
            selectedColors={selectedColors}
            priceMin={priceMin}
            priceMax={priceMax}
            categories={categories}
            priceRange={priceRange}
            onCategoriesChange={setSelectedCategories}
            onSizesChange={setSelectedSizes}
            onColorsChange={setSelectedColors}
            onPriceChange={(min, max) => {
              setPriceMin(min);
              setPriceMax(max);
            }}
            onClearAll={handleClearAll}
            isMobile={false}
          />
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            {/* Filter Button - Mobile Only */}
            <button
              onClick={() => setShowFiltersDrawer(true)}
              className="md:hidden px-4 py-2 border border-black rounded text-sm font-medium text-black hover:bg-black hover:text-cream transition-colors flex items-center gap-2"
            >
              Filters
              {hasActiveFilters && (
                <span className="ml-2 px-2 py-1 bg-black text-cream text-xs rounded">
                  {selectedCategories.length +
                    selectedSizes.length +
                    selectedColors.length +
                    (priceMin > priceRange.min ? 1 : 0) +
                    (priceMax < priceRange.max ? 1 : 0) +
                    (searchQuery ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="md:ml-auto">
              <SortDropdown value={sortBy} onChange={setSortBy} />
            </div>
          </div>

          {/* Product Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-gray-medium">Loading products...</div>
          ) : (
            <ProductGrid products={filteredProducts} />
          )}

          {/* Empty State */}
          {!isLoading && filteredProducts.length === 0 && allProducts.length > 0 && (
            <div className="py-16 text-center">
              <p className="text-lg text-gray-dark mb-4">No products found</p>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 border border-black text-black text-sm font-medium hover:bg-black hover:text-cream transition-colors rounded"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showFiltersDrawer && (
        <FilterSidebar
          selectedCategories={selectedCategories}
          selectedSizes={selectedSizes}
          selectedColors={selectedColors}
          priceMin={priceMin}
          priceMax={priceMax}
          categories={categories}
          priceRange={priceRange}
          onCategoriesChange={setSelectedCategories}
          onSizesChange={setSelectedSizes}
          onColorsChange={setSelectedColors}
          onPriceChange={(min, max) => {
            setPriceMin(min);
            setPriceMax(max);
          }}
          onClearAll={handleClearAll}
          isMobile={true}
          onClose={() => setShowFiltersDrawer(false)}
        />
      )}
    </main>
  );
}
