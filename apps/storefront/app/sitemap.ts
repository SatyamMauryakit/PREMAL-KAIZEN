import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/metadata';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface ApiProduct {
  id: string;
  updatedAt: string;
}

/**
 * Fetches every active/published product for the sitemap. `limit=1000` is a
 * pragmatic ceiling for this catalog's current size, not real pagination - once
 * the catalog regularly exceeds that, this should page through /api/products
 * (which already supports page/limit) and/or split into multiple sitemap files
 * (Next supports a sitemap index via generateSitemaps()), neither of which this
 * pass implements.
 */
async function fetchAllProductsForSitemap(): Promise<ApiProduct[]> {
  try {
    const res = await fetch(`${API_BASE}/api/products?limit=1000`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/shipping`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/returns`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const products = await fetchAllProductsForSitemap();
  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.id}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticPages, ...productPages];
}
