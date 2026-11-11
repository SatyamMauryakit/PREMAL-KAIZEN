import type { Metadata } from 'next';
import { buildStaticMetadata } from '@/lib/metadata';
import ShippingContent from './ShippingContent';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Shipping Information',
  description: 'Delivery options, shipping charges, and estimated timelines for PREMAL KAIZEN orders shipped across India.',
  path: '/shipping',
});

export default function ShippingPage() {
  return <ShippingContent />;
}
