import type { Metadata } from 'next';
import Link from 'next/link';
import { buildStaticMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Cancellation Policy',
  description: 'How and when you can cancel a PREMAL KAIZEN order, and what happens to your payment when you do.',
  path: '/cancellation-policy',
});

export default function CancellationPolicyPage() {
  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-12 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Cancellation Policy</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-black mb-6">Cancellation Policy</h1>
        <p className="text-gray-dark text-lg leading-relaxed mb-8">
          You can cancel most orders yourself, right up until they ship. Here's exactly how it works.
        </p>

        <div className="bg-white rounded-lg border border-gray-light p-8 mb-8 space-y-6">
          <div>
            <h2 className="font-bold text-black mb-2">When you can cancel</h2>
            <p className="text-gray-dark leading-relaxed">
              An order can be cancelled yourself, from your account, any time it is in one of these stages:
              <strong> Pending, Confirmed, Processing,</strong> or <strong>Packed</strong>.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">When cancellation is no longer available</h2>
            <p className="text-gray-dark leading-relaxed">
              Once an order has been <strong>Shipped</strong>, is <strong>Out for Delivery</strong>, has been{' '}
              <strong>Delivered</strong>, or has already been cancelled, it can no longer be cancelled through
              your account. This is enforced on our side, not just hidden in the app, so it applies no matter how
              the request is made.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">How to cancel</h2>
            <ol className="list-decimal list-inside text-gray-dark leading-relaxed space-y-1">
              <li>Go to <Link href="/account/orders" className="text-black underline hover:no-underline">My Orders</Link> and open the order.</li>
              <li>If it's still eligible, you'll see a <strong>Cancel Order</strong> button.</li>
              <li>Select a reason for cancelling and, optionally, add a comment.</li>
              <li>Confirm — the order is cancelled immediately, and you'll see its updated status right away.</li>
            </ol>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">If your order has already shipped</h2>
            <p className="text-gray-dark leading-relaxed">
              Self-service cancellation won't be available, but reach out from the{' '}
              <Link href="/contact" className="text-black underline hover:no-underline">Contact page</Link>{' '}
              with your order number — our team can advise on what's possible once it's in transit.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">What happens to your payment</h2>
            <p className="text-gray-dark leading-relaxed">
              <strong>Cash on Delivery orders</strong> are simply cancelled — there's no charge to reverse.{' '}
              <strong>Online (prepaid) orders</strong> that were already paid for are automatically refunded to
              your original payment method through Razorpay as soon as the cancellation is confirmed. See our{' '}
              <Link href="/refund-policy" className="text-black underline hover:no-underline">Refund Policy</Link>{' '}
              for how long that takes and how to track it.
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-medium">
          Questions about a specific order? <Link href="/contact" className="text-black underline hover:no-underline">Contact us</Link> with your order number and we'll help directly.
        </p>
      </div>
    </div>
  );
}
