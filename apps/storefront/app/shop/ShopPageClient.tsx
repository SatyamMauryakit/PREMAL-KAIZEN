'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Product,
  ProductFacets,
  fetchProducts,
  fetchProductFacets,
  applyFeaturedOrder,
} from '@/lib/products';
import { FilterSidebar } from '@/components/FilterSidebar';
import { ProductGrid } from '@/components/ProductGrid';
import { SortDropdown } from '@/components/SortDropdown';

type SortOption = 'featured' | 'price-low' | 'price-high' | 'newest';

const SORT_TO_API: Record<SortOption, 'price_asc' | 'price_desc' | 'newest'> = {
  featured: 'newest', // no server equivalent - re-ordered client-side, see applyFeaturedOrder
  'price-low': 'price_asc',
  'price-high': 'price_desc',
  newest: 'newest',
};

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const EMPTY_FACETS: ProductFacets = {
  sizes: [],
  colors: [],
  categories: [],
  priceRange: { min: 0, max: 0 },
};

export default function ShopPageClient() {
  return (
    <Suspense fallback={null}>
      <ShopPageContent />
    </Suspense>
  );
}

function ShopPageContent() {
  const searchParams = useSearchParams();

  const [facets, setFacets] = useState<ProductFacets>(EMPTY_FACETS);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true); // first page of the current filter set
  const [isPageLoading, setIsPageLoading] = useState(false); // navigating to a different page via Previous/Next
  const [loadError, setLoadError] = useState<string | null>(null);
  const productGridTopRef = useRef<HTMLDivElement>(null);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>(
    searchParams.get('filter') === 'new' ? 'newest' : 'featured'
  );
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Load filter-sidebar options once - independent of pagination/filtering, so the
  // sidebar never loses options as the user narrows down the product list.
  useEffect(() => {
    let cancelled = false;
    fetchProductFacets()
      .then((f) => {
        if (cancelled) return;
        setFacets(f);
        setPriceMin(f.priceRange.min);
        setPriceMax(f.priceRange.max);
      })
      .catch(() => {
        // Filter sidebar degrades to "no options yet" rather than blocking the page -
        // the product grid below has its own independent error handling.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce the search box: commits to `searchQuery` (which actually triggers a
  // fetch) only after the user pauses typing, not on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const activeFilterKey = useMemo(
    () =>
      JSON.stringify({
        selectedCategories,
        selectedSizes,
        selectedColors,
        priceMin,
        priceMax,
        sortBy,
        searchQuery,
      }),
    [selectedCategories, selectedSizes, selectedColors, priceMin, priceMax, sortBy, searchQuery]
  );

  // A request fired after this effect's cleanup must not land on state - guards
  // against a slow page-1 response overwriting a newer page-1 response issued by a
  // fast filter change right after it (classic stale-response race).
  const requestIdRef = useRef(0);

  // Any filter/sort/search change starts over from page 1.
  useEffect(() => {
    if (facets === EMPTY_FACETS && priceMax === 0) return; // wait for the price bounds to load once
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setLoadError(null);

    fetchProducts({
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      search: searchQuery || undefined,
      sort: SORT_TO_API[sortBy],
      sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      priceMin: priceMin > facets.priceRange.min ? priceMin : undefined,
      priceMax: priceMax < facets.priceRange.max ? priceMax : undefined,
      page: 1,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (requestIdRef.current !== requestId) return; // a newer request superseded this one
        setProducts(sortBy === 'featured' ? applyFeaturedOrder(result.products) : result.products);
        setTotal(result.total);
        setPage(1);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setLoadError('Failed to load products. Please try again later.');
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoading(false);
      });
    // Deliberately depends on the stable `activeFilterKey` string rather than each
    // filter value individually, so a filter-object identity change doesn't matter -
    // only an actual value change (reflected in the JSON string) re-triggers this.
  }, [activeFilterKey, facets]);

  // Previous/Next page navigation - replaces the product list with just that
  // page's items (rather than appending, the way "Load More" used to), matching
  // the paginated-page pattern already used throughout the admin panel.
  const goToPage = useCallback((targetPage: number) => {
    setIsPageLoading(true);
    setLoadError(null);
    fetchProducts({
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      search: searchQuery || undefined,
      sort: SORT_TO_API[sortBy],
      sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      priceMin: priceMin > facets.priceRange.min ? priceMin : undefined,
      priceMax: priceMax < facets.priceRange.max ? priceMax : undefined,
      page: targetPage,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        setProducts(sortBy === 'featured' ? applyFeaturedOrder(result.products) : result.products);
        setTotal(result.total);
        setPage(targetPage);
        productGridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(() => {
        setLoadError('Failed to load that page. Please try again.');
      })
      .finally(() => setIsPageLoading(false));
  }, [selectedCategories, searchQuery, sortBy, selectedSizes, selectedColors, priceMin, priceMax, facets]);

  const handleClearAll = useCallback(() => {
    setSelectedCategories([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setPriceMin(facets.priceRange.min);
    setPriceMax(facets.priceRange.max);
    setSearchInput('');
    setSearchQuery('');
  }, [facets]);

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSizes.length > 0 ||
    selectedColors.length > 0 ||
    priceMin > facets.priceRange.min ||
    priceMax < facets.priceRange.max ||
    searchQuery.length > 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-cream pt-20 md:pt-24">
      {/* Breadcrumbs */}
      <div className="px-4 md:px-8 py-2 border-b border-gray-300">
        <nav className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
          <a href="/" className="hover:text-black transition-colors">
            HOME
          </a>
          <span>/</span>
          <span className="text-black font-medium">SHOP</span>
        </nav>
      </div>

      {/* Page Header - compact: heading only, no product-count text */}
      <div className="px-4 md:px-8 py-3 border-b border-gray-300">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-black">Shop</h1>
      </div>

      {loadError && (
        <div className="mx-4 md:mx-8 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {loadError}
        </div>
      )}

      {/* Shop Layout */}
      <div className="flex flex-col md:flex-row gap-8 px-4 md:px-8 py-4">
        {/* Sidebar - Desktop Only */}
        <aside className="hidden md:block md:w-64 flex-shrink-0">
          <FilterSidebar
            selectedCategories={selectedCategories}
            selectedSizes={selectedSizes}
            selectedColors={selectedColors}
            priceMin={priceMin}
            priceMax={priceMax}
            categories={facets.categories}
            sizes={facets.sizes}
            colors={facets.colors}
            priceRange={facets.priceRange}
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
        <div className="flex-1 min-w-0" ref={productGridTopRef}>
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
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
                    (priceMin > facets.priceRange.min ? 1 : 0) +
                    (priceMax < facets.priceRange.max ? 1 : 0) +
                    (searchQuery ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Search */}
            <div className="relative md:w-72">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products..."
                className="w-full px-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-black"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                >
                  ×
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="md:ml-auto">
              <SortDropdown value={sortBy} onChange={setSortBy} />
            </div>
          </div>

          {/* Product Grid */}
          {isLoading || isPageLoading ? (
            <div className="py-16 text-center text-gray-medium">Loading products...</div>
          ) : (
            <ProductGrid products={products} />
          )}

          {/* Pagination: Previous / page indicator / Next */}
          {!isLoading && !isPageLoading && products.length > 0 && totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-10">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                aria-label="Previous page"
                className="w-10 h-10 flex items-center justify-center border border-black text-black rounded hover:bg-black hover:text-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-black"
              >
                ‹
              </button>
              <span className="text-sm text-gray-700 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                aria-label="Next page"
                className="w-10 h-10 flex items-center justify-center border border-black text-black rounded hover:bg-black hover:text-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-black"
              >
                ›
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && products.length === 0 && (
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
          categories={facets.categories}
          sizes={facets.sizes}
          colors={facets.colors}
          priceRange={facets.priceRange}
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
