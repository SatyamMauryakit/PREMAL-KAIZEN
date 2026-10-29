'use client';

import { useState, useEffect, useCallback } from 'react';
import { PRODUCTS, PRICE_RANGE, filterProducts, sortProducts } from '@/lib/products';
import { FilterSidebar } from '@/components/FilterSidebar';
import { ProductGrid } from '@/components/ProductGrid';
import { SortDropdown } from '@/components/SortDropdown';

type SortOption = 'featured' | 'price-low' | 'price-high' | 'newest' | 'rating';

export default function ShopPage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState(PRICE_RANGE.min);
  const [priceMax, setPriceMax] = useState(PRICE_RANGE.max);
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState(PRODUCTS);

  // Update filtered products when filters change
  useEffect(() => {
    const filtered = filterProducts(PRODUCTS, {
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      priceMin,
      priceMax,
      searchQuery: searchQuery || undefined,
    });

    const sorted = sortProducts(filtered, sortBy);
    setFilteredProducts(sorted);
  }, [selectedCategories, selectedSizes, selectedColors, priceMin, priceMax, sortBy, searchQuery]);

  const handleClearAll = useCallback(() => {
    setSelectedCategories([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setPriceMin(PRICE_RANGE.min);
    setPriceMax(PRICE_RANGE.max);
    setSearchQuery('');
  }, []);

  const resultCount = filteredProducts.length;
  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSizes.length > 0 ||
    selectedColors.length > 0 ||
    priceMin > PRICE_RANGE.min ||
    priceMax < PRICE_RANGE.max ||
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
          {resultCount} product{resultCount !== 1 ? 's' : ''} available
          {hasActiveFilters && ` • ${resultCount} matching your filters`}
        </p>
      </div>

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
              ⚙️ Filters
              {hasActiveFilters && (
                <span className="ml-2 px-2 py-1 bg-black text-cream text-xs rounded">
                  {selectedCategories.length +
                    selectedSizes.length +
                    selectedColors.length +
                    (priceMin > PRICE_RANGE.min ? 1 : 0) +
                    (priceMax < PRICE_RANGE.max ? 1 : 0) +
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
          <ProductGrid products={filteredProducts} />

          {/* Empty State */}
          {filteredProducts.length === 0 && (
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
