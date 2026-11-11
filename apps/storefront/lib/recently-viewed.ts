'use client';

import { useEffect, useState } from 'react';
import { Product, fetchProductsByIds } from './products';

const STORAGE_KEY = 'premal-recently-viewed';
const MAX_ENTRIES = 10; // within the requested 8-12 range

interface RecentlyViewedEntry {
  id: string;
  viewedAt: number;
}

function readEntries(): RecentlyViewedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentlyViewedEntry => e && typeof e.id === 'string' && typeof e.viewedAt === 'number'
    );
  } catch {
    // Private browsing, corrupted value, localStorage unavailable, etc. - recently-viewed
    // is a nice-to-have, never something that should break the page.
    return [];
  }
}

function writeEntries(entries: RecentlyViewedEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded / storage disabled - silently skip, same reasoning as readEntries.
  }
}

/**
 * Records a product view, moving it to the front if already present (no
 * duplicates) and capping the list at MAX_ENTRIES. Only ids and a timestamp are
 * stored - never product name/price/image - so this stays a few bytes per entry
 * and full product details always come fresh from the API when displayed.
 */
export function recordProductView(productId: string): void {
  const deduped = readEntries().filter((e) => e.id !== productId);
  deduped.unshift({ id: productId, viewedAt: Date.now() });
  writeEntries(deduped.slice(0, MAX_ENTRIES));
}

function getRecentlyViewedIds(excludeId?: string): string[] {
  return readEntries()
    .map((e) => e.id)
    .filter((id) => id !== excludeId);
}

interface UseRecentlyViewedResult {
  products: Product[];
  isLoading: boolean;
}

/**
 * Reads recently-viewed ids and fetches their current product details, in one
 * batched request. localStorage is only ever read inside this effect (never
 * during render), so server and client render the same initial (loading) state -
 * no hydration mismatch, same pattern as CartProvider/WishlistProvider.
 */
export function useRecentlyViewed(excludeId?: string, limit = MAX_ENTRIES): UseRecentlyViewedResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ids = getRecentlyViewedIds(excludeId).slice(0, limit);

    if (ids.length === 0) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    fetchProductsByIds(ids)
      .then((fetched) => {
        if (!cancelled) setProducts(fetched);
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
  }, [excludeId, limit]);

  return { products, isLoading };
}
