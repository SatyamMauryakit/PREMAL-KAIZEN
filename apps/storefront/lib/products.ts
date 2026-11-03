// Product catalog - backed by the real PREMAL KAIZEN API (/api/products).

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  colors: string[];
  sizes: string[];
  image: string;
  description: string;
  isNew?: boolean;
  createdAt: Date;
}

interface ApiProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number | null;
  colors: string[];
  sizes: string[];
  category?: { id: string; name: string; slug: string } | null;
  images?: Array<{ url: string; alt?: string }>;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350"%3E%3Crect fill="%23F5F1ED" width="300" height="350"/%3E%3Ctext x="150" y="180" text-anchor="middle" font-family="Arial" font-size="14" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E';

/** New-arrival window: products created within the last 14 days are flagged "isNew". */
const NEW_ARRIVAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function toProduct(p: ApiProduct): Product {
  const createdAt = new Date(p.createdAt);
  return {
    id: p.id,
    name: p.name,
    category: p.category?.slug || 'uncategorized',
    price: Math.round(p.price / 100),
    originalPrice: p.originalPrice ? Math.round(p.originalPrice / 100) : undefined,
    colors: (p.colors || []).map((c) => c.toLowerCase()),
    sizes: p.sizes || [],
    image: p.images?.[0]?.url || PLACEHOLDER_IMAGE,
    description: p.description,
    isNew: Date.now() - createdAt.getTime() < NEW_ARRIVAL_WINDOW_MS,
    createdAt,
  };
}

/** Fetch the live, published product catalog from the API. */
export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE}/api/products?limit=200`);
  if (!response.ok) {
    throw new Error('Failed to load products');
  }
  const data = await response.json();
  return (data.data || []).map(toProduct);
}

/** Derive the category filter options from whatever products are actually in the catalog. */
export function deriveCategories(products: Product[]): Array<{ id: string; label: string }> {
  const seen = new Map<string, string>();
  for (const p of products) {
    if (!seen.has(p.category)) {
      seen.set(p.category, p.category.charAt(0).toUpperCase() + p.category.slice(1).replace(/-/g, ' '));
    }
  }
  return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
}

/** Derive the price slider bounds from whatever products are actually in the catalog. */
export function derivePriceRange(products: Product[]): { min: number; max: number } {
  if (products.length === 0) return { min: 0, max: 0 };
  const prices = products.map((p) => p.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Derive the size filter options from whatever products are actually in the catalog. */
export function deriveSizes(products: Product[]): string[] {
  const seen = new Set<string>();
  for (const p of products) {
    for (const s of p.sizes) seen.add(s);
  }
  return Array.from(seen);
}

// Swatch color for known color names - falls back to a neutral gray for any
// catalog color name not in this list, rather than refusing to show it.
const COLOR_HEX: Record<string, string> = {
  black: '#000000',
  charcoal: '#36454F',
  beige: '#D4C5B9',
  cream: '#F5F1ED',
  gray: '#666666',
  grey: '#666666',
  sand: '#C2B280',
  olive: '#556B2F',
  khaki: '#C3B091',
  navy: '#000080',
  white: '#FFFFFF',
  brown: '#8B4513',
  red: '#B22222',
  blue: '#1E3A8A',
  green: '#2F6B3C',
};

/** Derive the color filter options (with swatches) from whatever products are actually in the catalog. */
export function deriveColors(products: Product[]): Array<{ id: string; label: string; hex: string }> {
  const seen = new Map<string, string>();
  for (const p of products) {
    for (const c of p.colors) {
      if (!seen.has(c)) {
        seen.set(c, COLOR_HEX[c.toLowerCase()] || '#999999');
      }
    }
  }
  return Array.from(seen.entries()).map(([id, hex]) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    hex,
  }));
}

// Filter product list based on criteria
export function filterProducts(
  products: Product[],
  filters: {
    categories?: string[];
    sizes?: string[];
    colors?: string[];
    priceMin?: number;
    priceMax?: number;
    searchQuery?: string;
  }
): Product[] {
  return products.filter((product) => {
    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(product.category)) {
        return false;
      }
    }

    // Size filter
    if (filters.sizes && filters.sizes.length > 0) {
      const hasSize = filters.sizes.some((size) => product.sizes.includes(size));
      if (!hasSize) {
        return false;
      }
    }

    // Color filter
    if (filters.colors && filters.colors.length > 0) {
      const hasColor = filters.colors.some((color) => product.colors.includes(color));
      if (!hasColor) {
        return false;
      }
    }

    // Price filter
    if (filters.priceMin !== undefined && product.price < filters.priceMin) {
      return false;
    }
    if (filters.priceMax !== undefined && product.price > filters.priceMax) {
      return false;
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesName = product.name.toLowerCase().includes(query);
      const matchesDescription = product.description.toLowerCase().includes(query);
      if (!matchesName && !matchesDescription) {
        return false;
      }
    }

    return true;
  });
}

// Sort products
export function sortProducts(
  products: Product[],
  sortBy: 'featured' | 'price-low' | 'price-high' | 'newest'
): Product[] {
  const sorted = [...products];

  switch (sortBy) {
    case 'price-low':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-high':
      return sorted.sort((a, b) => b.price - a.price);
    case 'newest':
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case 'featured':
    default:
      // Featured: new items first, then newest
      return sorted.sort((a, b) => {
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
}

// Format price in Indian Rupees
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(price);
}
