import type { Metadata } from 'next';
import Link from 'next/link';
import { buildStaticMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Return & Exchange Policy',
  description: 'When a PREMAL KAIZEN order is eligible for return or exchange, and how to request one.',
  path: '/return-exchange-policy',
});

export default function ReturnExchangePolicyPage() {
  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-12 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Return &amp; Exchange Policy</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-black mb-6">Return &amp; Exchange Policy</h1>
        <p className="text-gray-dark text-lg leading-relaxed mb-8">
          For how to actually submit a request, see{' '}
          <Link href="/returns" className="text-black underline hover:no-underline">Returns &amp; Exchanges</Link>.
          This page sets out the conditions a return or exchange needs to meet.
        </p>

        <div className="bg-white rounded-lg border border-gray-light p-8 mb-8 space-y-6">
          <div>
            <h2 className="font-bold text-black mb-2">Return and exchange eligibility</h2>
            <p className="text-gray-dark leading-relaxed">
              Every return or exchange request is reviewed individually by our support team against your order
              details.{' '}
              <span className="font-medium">
                [CONFIRM WITH OWNER: our FAQ currently states a 7-day self-service exchange window for size
                issues, while this policy is written as case-by-case with no fixed window — these need to be
                reconciled to one real answer before this page goes live with a specific number.]
              </span>
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Damaged or defective products</h2>
            <p className="text-gray-dark leading-relaxed">
              If an item arrives damaged or with a manufacturing defect, contact us with your order number and
              photos of the issue as soon as you notice it — these requests are prioritized.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Wrong product received</h2>
            <p className="text-gray-dark leading-relaxed">
              If what arrived doesn't match what you ordered, let us know with your order number and a photo of
              what you received, and we'll arrange a correction.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Size exchanges</h2>
            <p className="text-gray-dark leading-relaxed">
              Size exchanges are handled on a case-by-case basis, subject to the condition requirements below and
              stock availability in the requested size.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Required product condition</h2>
            <p className="text-gray-dark leading-relaxed">
              To be eligible, items must be unused, unworn, and unwashed, with all original tags and packaging
              intact.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Non-returnable items</h2>
            <p className="text-gray-dark leading-relaxed">
              Items marked as sale or discounted, and items returned used, washed, damaged, or missing their
              original tags or packaging, are not eligible for return or exchange.{' '}
              <span className="font-medium">[CONFIRM WITH OWNER: confirm this is the complete list of non-returnable categories.]</span>
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">How to request a return or exchange</h2>
            <p className="text-gray-dark leading-relaxed">
              Reach out from the <Link href="/contact" className="text-black underline hover:no-underline">Contact page</Link>{' '}
              with your order number and the reason for the request — full steps are on the{' '}
              <Link href="/returns" className="text-black underline hover:no-underline">Returns &amp; Exchanges</Link> page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
