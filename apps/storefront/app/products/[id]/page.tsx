import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchProductForMetadata, buildProductMetadata, buildProductJsonLd, fetchRatingSummaryForMetadata } from '@/lib/metadata';
import ProductDetailClient from './ProductDetailClient';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProductForMetadata(id);
  if (!product) {
    // Matches the page body's own notFound() below - a deleted/invalid product id
    // gets generic, non-indexable metadata rather than another product's data.
    return { title: 'Product Not Found | PREMAL KAIZEN', robots: { index: false, follow: false } };
  }
  return buildProductMetadata(product);
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await fetchProductForMetadata(id);

  // A missing/deleted/unpublished product id triggers Next's real not-found
  // handling (app/not-found.tsx, genuine HTTP 404) instead of a 200 response with
  // "Product not found" text in the body - the client component previously did the
  // latter, which is invisible to crawlers as an actual 404.
  if (!product) {
    notFound();
  }

  // Independent of the not-found check above - a failed/absent rating summary
  // fetch just means no aggregateRating is added, never blocks the page itself.
  const ratingSummary = await fetchRatingSummaryForMetadata(id);
  const jsonLd = buildProductJsonLd(product, ratingSummary ?? undefined);

  return (
    <>
      {/* Schema.org Product structured data - server-rendered, so it's present in
          the initial HTML without requiring JS execution. */}
      <script
        type="application/ld+json"
        // Standard Next.js pattern for JSON-LD - content is server-built from our
        // own API response (never raw user input), so this is safe.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient productId={id} />
    </>
  );
}
