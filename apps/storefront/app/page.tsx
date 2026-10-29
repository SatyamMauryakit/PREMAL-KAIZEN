'use client';

import { HeroSection } from '@/components/HeroSection';
import { ProductsSection } from '@/components/ProductsSection';

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Featured Products Section */}
      <ProductsSection />
    </>
  );
}
