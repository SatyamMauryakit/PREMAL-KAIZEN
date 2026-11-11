// SEO metadata helpers shared across the storefront's server components
// (layout.tsx, sitemap.ts, robots.ts, and every page's metadata/generateMetadata).

import type { Metadata } from 'next';

// Canonical production domain (e.g. https://premalkaizen.com) - required for
// metadataBase (resolves relative OG/Twitter image URLs), sitemap.ts and robots.ts
// to emit real absolute URLs instead of localhost ones. Falls back to localhost so
// local dev keeps working unconfigured; MUST be set to the real production domain
// before deploying - see SEO_IMPLEMENTATION_REPORT.md.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const SITE_NAME = 'PREMAL KAIZEN';
const DEFAULT_DESCRIPTION = 'Wear Your Vibe. Own Your Story. Premium streetwear crafted for the modern explorer.';

export interface ProductForMetadata {
  id: string;
  name: string;
  description: string;
  price: number; // paise
  sku: string;
  isActive: boolean;
  images?: Array<{ url: string; alt?: string }>;
  category?: { name: string; slug: string } | null;
  inventory?: Array<{ available: number }>;
}

/**
 * Server-side product fetch for metadata/structured-data/not-found purposes - the
 * same public endpoint the client component already uses (GET /api/products/:id),
 * which already 404s for inactive/draft products. Next.js memoizes identical
 * `fetch()` calls within one request, so calling this again from the page body
 * (for the not-found check / JSON-LD) does not cost a second network round trip.
 */
export async function fetchProductForMetadata(id: string): Promise<ProductForMetadata | null> {
  try {
    const res = await fetch(`${API_BASE}/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Plain-text excerpt, safe for a <meta description> (no markup, length-capped). */
function excerpt(text: string, maxLength = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 1).trimEnd() + '…';
}

export function buildProductMetadata(product: ProductForMetadata): Metadata {
  const url = `${SITE_URL}/products/${product.id}`;
  const title = `${product.name} | ${SITE_NAME}`;
  const description = product.description
    ? excerpt(product.description)
    : `Shop ${product.name} at ${SITE_NAME}. ${DEFAULT_DESCRIPTION}`;
  const image = product.images?.[0];

  return {
    title,
    description,
    alternates: { canonical: url },
    // Reachable here only means the API returned it, which already requires
    // isActive - see fetchProductForMetadata's comment - so always indexable.
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      // 'product' is a real Open Graph vertical many crawlers support, but Next's
      // typed Metadata API only accepts the base OG types (website/article/...) -
      // 'website' is the valid, type-safe choice for a page that isn't an article.
      type: 'website',
      images: image ? [{ url: image.url, alt: image.alt || product.name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image.url] : undefined,
    },
  };
}

/**
 * Schema.org Product structured data (JSON-LD). Only includes fields backed by
 * real data - no brand field is invented per-product (there is no Brand model in
 * the schema; PREMAL KAIZEN is used because this is a single-brand store, not a
 * marketplace - every product sold here genuinely is a PREMAL KAIZEN product).
 * `ratingSummary` is optional and, when provided with at least one approved
 * review, adds a genuine aggregateRating computed from real approved-review data
 * (apps/api ReviewsService.getRatingSummary - approved reviews only). With no
 * approved reviews yet, aggregateRating is omitted entirely, never a fabricated
 * placeholder - this is what "never invent ratings or reviews" means in practice.
 */
export function buildProductJsonLd(
  product: ProductForMetadata,
  ratingSummary?: { average: number; total: number },
) {
  const url = `${SITE_URL}/products/${product.id}`;
  const images = (product.images || []).map((img) => img.url);

  // Product-level availability: in stock unless the product is inactive (already
  // excluded by construction, see above) or every tracked variant is depleted.
  // A product with no inventory rows at all has no tracking configured for it -
  // treated as in stock, never as a fabricated "0 left".
  const hasTracking = (product.inventory?.length ?? 0) > 0;
  const anyVariantInStock = !hasTracking || product.inventory!.some((i) => i.available > 0);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: images.length > 0 ? images : undefined,
    sku: product.sku,
    brand: { '@type': 'Brand', name: SITE_NAME },
    url,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: (product.price / 100).toFixed(2),
      availability: anyVariantInStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(ratingSummary && ratingSummary.total > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: ratingSummary.average,
            reviewCount: ratingSummary.total,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/** Server-side fetch of the real, approved-only rating summary for a product - used by both the product page's JSON-LD and nowhere else invented. */
export async function fetchRatingSummaryForMetadata(
  productId: string,
): Promise<{ average: number; total: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/products/${productId}/reviews/summary`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Shared metadata for a static page - title is suffixed with the site name, description is passed through as-is. */
export function buildStaticMetadata(opts: { title: string; description: string; path: string }): Metadata {
  const url = `${SITE_URL}${opts.path}`;
  const title = `${opts.title} | ${SITE_NAME}`;
  return {
    title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description: opts.description,
    },
  };
}
