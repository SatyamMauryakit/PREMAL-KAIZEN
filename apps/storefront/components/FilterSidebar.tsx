'use client';

import { SIZES, COLORS } from '@/lib/products';

interface FilterSidebarProps {
  selectedCategories: string[];
  selectedSizes: string[];
  selectedColors: string[];
  priceMin: number;
  priceMax: number;
  onCategoriesChange: (categories: string[]) => void;
  onSizesChange: (sizes: string[]) => void;
  onColorsChange: (colors: string[]) => void;
  onPriceChange: (min: number, max: number) => void;
  onClearAll: () => void;
  isMobile?: boolean;
  onClose?: () => void;
  /** Category options derived from the live catalog (replaces any hardcoded list). */
  categories: Array<{ id: string; label: string }>;
  /** Price slider bounds derived from the live catalog. */
  priceRange: { min: number; max: number };
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  selectedCategories,
  selectedSizes,
  selectedColors,
  priceMin,
  priceMax,
  onCategoriesChange,
  onSizesChange,
  onColorsChange,
  onPriceChange,
  onClearAll,
  isMobile = false,
  onClose,
  categories,
  priceRange,
}) => {
  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoriesChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoriesChange([...selectedCategories, category]);
    }
  };

  const toggleSize = (size: string) => {
    if (selectedSizes.includes(size)) {
      onSizesChange(selectedSizes.filter((s) => s !== size));
    } else {
      onSizesChange([...selectedSizes, size]);
    }
  };

  const toggleColor = (color: string) => {
    if (selectedColors.includes(color)) {
      onColorsChange(selectedColors.filter((c) => c !== color));
    } else {
      onColorsChange([...selectedColors, color]);
    }
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSizes.length > 0 ||
    selectedColors.length > 0 ||
    priceMin > priceRange.min ||
    priceMax < priceRange.max;

  return (
    <div className={`${isMobile ? 'fixed inset-0 z-40 bg-black/50' : ''}`} onClick={isMobile ? onClose : undefined}>
      <div
        className={`${
          isMobile
            ? 'fixed inset-y-0 left-0 w-64 bg-cream overflow-y-auto'
            : 'w-64 bg-cream rounded-lg p-6'
        } ${isMobile ? 'p-6' : ''}`}
        onClick={(e) => isMobile && e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-black">FILTERS</h2>
          {isMobile && (
            <button
              onClick={onClose}
              className="text-2xl text-black hover:text-gray-dark"
              aria-label="Close filters"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <h3 className="font-bold text-black text-sm mb-3">CATEGORY</h3>
          <div className="space-y-2">
            {categories.length === 0 && (
              <p className="text-xs text-gray-medium">No categories yet</p>
            )}
            {categories.map((category) => (
              <label key={category.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                  className="w-4 h-4 rounded border border-gray-medium cursor-pointer"
                />
                <span className="text-sm text-gray-dark">{category.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Size Filter */}
        <div className="mb-8">
          <h3 className="font-bold text-black text-sm mb-3">SIZE</h3>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((size) => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={`w-10 h-10 flex items-center justify-center border rounded text-xs font-medium transition-colors ${
                  selectedSizes.includes(size)
                    ? 'bg-black text-cream border-black'
                    : 'bg-white border-gray-light text-gray-dark hover:border-black'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Price Filter */}
        <div className="mb-8">
          <h3 className="font-bold text-black text-sm mb-3">PRICE</h3>
          <div className="space-y-4">
            <input
              type="range"
              min={priceRange.min}
              max={priceRange.max}
              value={priceMin}
              onChange={(e) => onPriceChange(Number(e.target.value), priceMax)}
              className="w-full"
            />
            <div className="flex gap-2 text-xs">
              <span className="text-gray-dark">¥{priceMin.toLocaleString('en-IN')}</span>
              <span className="text-gray-dark">—</span>
              <span className="text-gray-dark">¥{priceMax.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={priceRange.min}
              max={priceRange.max}
              value={priceMax}
              onChange={(e) => onPriceChange(priceMin, Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Color Filter */}
        <div className="mb-8">
          <h3 className="font-bold text-black text-sm mb-3">COLOR</h3>
          <div className="flex flex-wrap gap-3">
            {COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => toggleColor(color.id)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  selectedColors.includes(color.id)
                    ? 'border-black scale-110'
                    : 'border-gray-light hover:border-gray-dark'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.label}
                aria-label={color.label}
              />
            ))}
          </div>
        </div>

        {/* Clear All */}
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="w-full px-4 py-2 border border-black text-black text-sm font-medium hover:bg-black hover:text-cream transition-colors rounded"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
};
