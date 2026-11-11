import type { Metadata } from 'next';
import { buildStaticMetadata } from '@/lib/metadata';
import ContactContent from './ContactContent';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Contact Us',
  description: 'Get in touch with PREMAL KAIZEN for order status, shipping, returns, product questions, or payment issues.',
  path: '/contact',
});

export default function ContactPage() {
  return <ContactContent />;
}
