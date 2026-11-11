import type { Metadata } from 'next';
import { HeroSection } from '@/components/HeroSection';
import { ProductsSection } from '@/components/ProductsSection';
import { RecentlyViewedProducts } from '@/components/RecentlyViewedProducts';
import { buildStaticMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Premium Streetwear',
  description: 'Wear Your Vibe. Own Your Story. Shop premium streetwear crafted for the modern explorer at PREMAL KAIZEN.',
  path: '/',
});

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Featured Products Section */}
      <ProductsSection />

      {/* Recently Viewed Products (renders nothing until the visitor has viewed something) */}
      <RecentlyViewedProducts />
    </>
  );
}
