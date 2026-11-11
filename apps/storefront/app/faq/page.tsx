import type { Metadata } from 'next';
import { buildStaticMetadata } from '@/lib/metadata';
import FaqContent from './FaqContent';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Frequently Asked Questions',
  description: 'Answers to common questions about orders, payments, shipping, returns, products, and your PREMAL KAIZEN account.',
  path: '/faq',
});

export default function FAQPage() {
  return <FaqContent />;
}
