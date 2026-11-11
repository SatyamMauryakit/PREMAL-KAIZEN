'use client';

import { useState, useEffect, useRef, useCallback, useId, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Product, CategorySuggestion, fetchProducts, fetchCategorySuggestions, formatPrice } from '@/lib/products';

interface SearchAutocompleteProps {
  /** Focus the input as soon as it mounts (used when the header's search popover opens). */
  autoFocus?: boolean;
  /** Called after any navigation (product click, category click, Enter, "view all") so the parent can close its own popover/drawer. */
  onNavigate?: () => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 300;
const MAX_PRODUCT_SUGGESTIONS = 5;
const MAX_CATEGORY_SUGGESTIONS = 3;

type Suggestion =
  | { type: 'category'; item: CategorySuggestion }
  | { type: 'product'; item: Product }
  | { type: 'view-all' };

/** Wraps the first case-insensitive match of `term` in `text` for visual highlighting. */
function highlightMatch(text: string, term: string) {
  if (!term.trim()) return text;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + term.length);
  const after = text.slice(index + term.length);
  return (
    <>
      {before}
      <span className="text-beige font-semibold">{match}</span>
      {after}
    </>
  );
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  autoFocus,
  onNavigate,
  placeholder = 'Search products...',
}) => {
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Debounce: only fetch after the user pauses typing, never once per keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setCategories([]);
      setProducts([]);
      setIsLoading(false);
      setHasSearched(false);
      setIsOpen(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    const handle = setTimeout(() => {
      Promise.all([
        fetchProducts({ search: trimmed, limit: MAX_PRODUCT_SUGGESTIONS }),
        fetchCategorySuggestions(trimmed, MAX_CATEGORY_SUGGESTIONS),
      ])
        .then(([productPage, categoryList]) => {
          if (requestIdRef.current !== requestId) return; // a newer keystroke's request has already landed
          setProducts(productPage.products);
          setCategories(categoryList);
          setHasSearched(true);
          setIsOpen(true);
          setHighlightedIndex(-1);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setProducts([]);
          setCategories([]);
          setHasSearched(true);
          setIsOpen(true);
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  const suggestions: Suggestion[] = [
    ...categories.map((item): Suggestion => ({ type: 'category', item })),
    ...products.map((item): Suggestion => ({ type: 'product', item })),
    ...(hasSearched ? [{ type: 'view-all' } as Suggestion] : []),
  ];

  const goToResults = useCallback(
    (term: string) => {
      setIsOpen(false);
      onNavigate?.();
      router.push(`/shop?q=${encodeURIComponent(term)}`);
    },
    [router, onNavigate]
  );

  const activate = useCallback(
    (suggestion: Suggestion) => {
      if (suggestion.type === 'product') {
        setIsOpen(false);
        onNavigate?.();
        router.push(`/products/${suggestion.item.id}`);
      } else if (suggestion.type === 'category') {
        setIsOpen(false);
        onNavigate?.();
        router.push(`/shop?category=${encodeURIComponent(suggestion.item.slug)}`);
      } else {
        goToResults(query.trim());
      }
    },
    [router, onNavigate, goToResults, query]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      activate(suggestions[highlightedIndex]);
      return;
    }
    const trimmed = query.trim();
    if (trimmed) goToResults(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && suggestions.length > 0) setIsOpen(true);
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation(); // don't also close the header's outer popover on the same keypress
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    // Enter is handled by the surrounding <form>'s onSubmit (handleSubmit above),
    // including when a suggestion is highlighted - no separate handling needed here.
  };

  const showNoResults = hasSearched && !isLoading && categories.length === 0 && products.length === 0;

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} role="search" className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
          }
          autoComplete="off"
          className="flex-1 min-w-0 px-3 py-2 rounded bg-neutral-900 text-cream text-sm placeholder-gray-500 focus:outline-none"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-cream text-black text-sm font-medium rounded hover:bg-opacity-90 transition-colors flex-shrink-0"
        >
          Go
        </button>
      </form>

      {/* Screen-reader result-count announcement - visual feedback is the dropdown itself. */}
      <span className="sr-only" aria-live="polite">
        {hasSearched && !isLoading
          ? `${categories.length + products.length} suggestion${categories.length + products.length === 1 ? '' : 's'} found`
          : ''}
      </span>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 mt-2 max-h-96 overflow-y-auto bg-neutral-800 rounded-lg shadow-lg z-50 text-left"
        >
          {isLoading && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
          )}

          {!isLoading && showNoResults && (
            <div className="px-4 py-3 text-sm text-gray-400">
              No results for &ldquo;{query.trim()}&rdquo;.
            </div>
          )}

          {!isLoading &&
            suggestions.map((suggestion, index) => {
              const optionId = `${listboxId}-option-${index}`;
              const isHighlighted = index === highlightedIndex;
              const baseClasses = `px-4 py-2 cursor-pointer ${
                isHighlighted ? 'bg-neutral-700' : 'hover:bg-neutral-700'
              }`;

              if (suggestion.type === 'category') {
                return (
                  <Fragment key={optionId}>
                    {index === 0 && (
                      <div className="px-4 pt-2 pb-1 text-xs uppercase tracking-wide text-gray-500">
                        Categories
                      </div>
                    )}
                    <div
                      id={optionId}
                      role="option"
                      aria-selected={isHighlighted}
                      className={baseClasses}
                      onMouseDown={(e) => e.preventDefault()} // keep input focus so onBlur-close doesn't race the click
                      onClick={() => activate(suggestion)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <span className="text-cream text-sm">
                        {highlightMatch(suggestion.item.name, query.trim())}
                      </span>
                    </div>
                  </Fragment>
                );
              }

              if (suggestion.type === 'product') {
                const isFirstProduct = index === categories.length;
                return (
                  <Fragment key={optionId}>
                    {isFirstProduct && (
                      <div className="px-4 pt-2 pb-1 text-xs uppercase tracking-wide text-gray-500">
                        Products
                      </div>
                    )}
                    <div
                      id={optionId}
                      role="option"
                      aria-selected={isHighlighted}
                      className={`${baseClasses} flex items-center gap-3`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => activate(suggestion)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <img
                        src={suggestion.item.image}
                        alt=""
                        className="w-10 h-10 object-cover rounded flex-shrink-0 bg-neutral-700"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-cream text-sm truncate">
                          {highlightMatch(suggestion.item.name, query.trim())}
                        </p>
                        <p className="text-gray-400 text-xs">{formatPrice(suggestion.item.price)}</p>
                      </div>
                    </div>
                  </Fragment>
                );
              }

              // 'view-all'
              return (
                <div
                  key={optionId}
                  id={optionId}
                  role="option"
                  aria-selected={isHighlighted}
                  className={`${baseClasses} border-t border-neutral-700 text-sm font-medium text-beige`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activate(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  View all results for &ldquo;{query.trim()}&rdquo;
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
