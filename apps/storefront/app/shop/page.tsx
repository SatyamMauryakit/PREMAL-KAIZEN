import type { Metadata } from 'next';
import { buildStaticMetadata } from '@/lib/metadata';
import ShopPageClient from './ShopPageClient';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Shop All Products',
  description: 'Browse the full PREMAL KAIZEN streetwear collection - filter by category, size, colour, and price.',
  path: '/shop',
});

export default function ShopPage() {
  return <ShopPageClient />;
}
