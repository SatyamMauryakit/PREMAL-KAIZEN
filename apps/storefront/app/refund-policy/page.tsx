import type { Metadata } from 'next';
import Link from 'next/link';
import { buildStaticMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Refund Policy',
  description: 'How and when refunds are issued for PREMAL KAIZEN orders, and how to track one.',
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-12 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Refund Policy</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-black mb-6">Refund Policy</h1>
        <p className="text-gray-dark text-lg leading-relaxed mb-8">
          This explains when a refund is issued, how it's processed, and the difference between a refund being
          <em> initiated</em> by us and the money actually landing back in your account.
        </p>

        <div className="bg-white rounded-lg border border-gray-light p-8 mb-8 space-y-6">
          <div>
            <h2 className="font-bold text-black mb-2">When a refund applies</h2>
            <p className="text-gray-dark leading-relaxed">
              A refund applies when a <strong>prepaid (online) order that was already paid for</strong> is
              cancelled, or when an approved return/exchange results in money owed back to you. Orders that were
              never completed, or paid for by <strong>Cash on Delivery</strong>, have nothing to refund — a COD
              cancellation simply cancels the order.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">How refund initiation works</h2>
            <p className="text-gray-dark leading-relaxed">
              For an eligible prepaid order, cancelling it automatically triggers a refund request to Razorpay,
              our payment processor, for the full paid amount. This happens immediately — but{' '}
              <strong>initiating</strong> a refund and the bank actually <strong>crediting</strong> it to you are
              two different things, covered next.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Refund processing time</h2>
            <p className="text-gray-dark leading-relaxed">
              Once initiated, refunds are typically credited to your original payment method within{' '}
              <strong>5–7 business days</strong>, depending on your bank or card issuer. We don't control that
              final step — only when the refund is sent, not when your bank posts it.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Tracking your refund status</h2>
            <p className="text-gray-dark leading-relaxed">
              Your order's refund status is shown in <Link href="/account/orders" className="text-black underline hover:no-underline">My Orders</Link> as
              one of: <strong>Refund Pending</strong> (initiated, being processed), <strong>Refunded</strong>{' '}
              (Razorpay has confirmed it), or <strong>Refund Failed</strong> (something went wrong — see below).
              We only ever show <strong>Refunded</strong> once Razorpay itself has confirmed the refund — never
              just because a cancellation request succeeded.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Cash on Delivery refunds</h2>
            <p className="text-gray-dark leading-relaxed">
              Since nothing is charged upfront on a COD order, there's no payment gateway refund to issue. If a
              COD order is cancelled or returned after you've already paid the courier on delivery, contact{' '}
              <Link href="/contact" className="text-black underline hover:no-underline">support</Link> with your
              order number so we can arrange that separately.{' '}
              <span className="font-medium">[CONFIRM WITH OWNER: the exact process/timeline for a post-delivery COD refund.]</span>
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">If a refund fails</h2>
            <p className="text-gray-dark leading-relaxed">
              If Razorpay reports a refund failure, your order will show <strong>Refund Failed</strong> and your
              order itself stays cancelled — a failed refund never undoes a cancellation.{' '}
              <Link href="/contact" className="text-black underline hover:no-underline">Contact us</Link> with
              your order number and we'll investigate and re-process it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
