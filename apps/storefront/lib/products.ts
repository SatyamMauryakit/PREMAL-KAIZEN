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

export interface ProductQuery {
  /** One or more category slugs (OR semantics - matches any of them). */
  categories?: string[];
  /** One or more exact product ids - e.g. batch-fetching a recently-viewed list in one request. */
  ids?: string[];
  search?: string;
  /** Maps to the API's sort values; 'featured' has no server equivalent (see fetchProducts). */
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
  sizes?: string[];
  colors?: string[];
  /** Rupees, matching the storefront's display unit (API converts to paise internally). */
  priceMin?: number;
  priceMax?: number;
  page?: number;
  limit?: number;
}

export interface ProductPage {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductFacets {
  sizes: string[];
  colors: Array<{ id: string; label: string; hex: string }>;
  categories: Array<{ id: string; label: string }>;
  priceRange: { min: number; max: number };
}

function buildQueryString(query: ProductQuery): string {
  const params = new URLSearchParams();
  for (const c of query.categories || []) params.append('category', c);
  for (const id of query.ids || []) params.append('ids', id);
  if (query.search) params.set('search', query.search);
  if (query.sort) params.set('sort', query.sort);
  if (query.priceMin !== undefined) params.set('minPrice', String(query.priceMin));
  if (query.priceMax !== undefined) params.set('maxPrice', String(query.priceMax));
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 20));
  for (const s of query.sizes || []) params.append('sizes', s);
  for (const c of query.colors || []) params.append('colors', c);
  return params.toString();
}

/**
 * Fetch one page of the live, published product catalog from the API, with
 * filters applied server-side - never loads the whole catalog just to filter
 * or paginate it client-side.
 */
export async function fetchProducts(query: ProductQuery = {}): Promise<ProductPage> {
  const response = await fetch(`${API_BASE}/api/products?${buildQueryString(query)}`);
  if (!response.ok) {
    throw new Error('Failed to load products');
  }
  const data = await response.json();
  return {
    products: (data.data || []).map(toProduct),
    total: data.total ?? 0,
    page: data.page ?? query.page ?? 1,
    pageSize: data.pageSize ?? query.limit ?? 20,
  };
}

/**
 * Batch-fetches a specific set of products by id in one request (e.g. a
 * recently-viewed list) rather than one request per id. The API already excludes
 * inactive/deleted products from the result (see ProductsService.findAll), so an
 * id that no longer resolves to a real, published product is simply absent from
 * the response - callers never need to special-case a "deleted product" error.
 * Results are reordered to match `ids`' order (the API's `id IN (...)` query does
 * not guarantee result order), so recency order is preserved end to end.
 */
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { products } = await fetchProducts({ ids, limit: ids.length });
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => p !== undefined);
}

/**
 * Filter-sidebar options (sizes/colors/price range from /api/products/facets,
 * categories from /api/categories) - computed across the whole live catalog
 * independent of the current page, so the sidebar doesn't lose options as you
 * paginate or filter.
 */
export async function fetchProductFacets(): Promise<ProductFacets> {
  const [facetsRes, categoriesRes] = await Promise.all([
    fetch(`${API_BASE}/api/products/facets`),
    fetch(`${API_BASE}/api/categories`),
  ]);
  if (!facetsRes.ok) {
    throw new Error('Failed to load filter options');
  }
  const facets = await facetsRes.json();
  const categoriesData = categoriesRes.ok ? await categoriesRes.json() : { data: [] };
  const categoryList: Array<{ id: string; slug: string; name: string }> = categoriesData.data || [];

  return {
    sizes: facets.sizes || [],
    colors: (facets.colors || []).map((label: string) => ({
      id: label,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      hex: COLOR_HEX[label.toLowerCase()] || '#999999',
    })),
    categories: categoryList.map((c) => ({ id: c.slug, label: c.name })),
    priceRange: facets.priceRange || { min: 0, max: 0 },
  };
}

export interface CategorySuggestion {
  id: string;
  name: string;
  slug: string;
}

/** Category name/slug matches for search autocomplete - reuses /api/categories' existing `search` filter. */
export async function fetchCategorySuggestions(query: string, limit = 3): Promise<CategorySuggestion[]> {
  const response = await fetch(`${API_BASE}/api/categories?search=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const data = await response.json();
  const list: Array<{ id: string; name: string; slug: string }> = data.data || [];
  return list.slice(0, limit).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
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

/**
 * "Featured" has no server-side equivalent (it mixes the derived, moving-window
 * `isNew` flag with a newest-first tiebreak), so the API is asked for `sort=newest`
 * and this re-orders just the one already-fetched page - a stable in-page reorder,
 * never a cross-page one, so it can't put an item from page 2 onto page 1.
 */
export function applyFeaturedOrder(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    if (a.isNew && !b.isNew) return -1;
    if (!a.isNew && b.isNew) return 1;
    return 0; // preserve the server's newest-first order otherwise (stable sort)
  });
}

// Format price in Indian Rupees
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(price);
}
