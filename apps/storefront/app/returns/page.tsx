'use client';

import Link from 'next/link';

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Breadcrumb */}
        <div className="mb-12 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Returns &amp; Exchanges</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-black mb-6">Returns &amp; Exchanges</h1>
        <p className="text-gray-dark text-lg leading-relaxed mb-8">
          Not quite right? We handle every return and exchange request individually to make sure it's resolved
          properly.
        </p>

        <div className="bg-white rounded-lg border border-gray-light p-8 mb-8 space-y-6">
          <div>
            <h2 className="font-bold text-black mb-2">How to request a return or exchange</h2>
            <p className="text-gray-dark leading-relaxed">
              Reach out to us from the{' '}
              <Link href="/contact" className="text-black underline hover:no-underline">Contact page</Link>{' '}
              with your order number and the reason for the return or exchange. Our team will confirm the
              eligibility of your request and the next steps.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">What you'll need</h2>
            <ul className="list-disc list-inside text-gray-dark leading-relaxed space-y-1">
              <li>Your order number (find it in <Link href="/account/orders" className="text-black underline hover:no-underline">My Orders</Link>)</li>
              <li>The item(s) you'd like to return or exchange</li>
              <li>A brief reason for the request</li>
            </ul>
          </div>
        </div>

        <p className="text-sm text-gray-medium">
          We don't have an automated self-service return flow yet, so every request is reviewed by our support
          team directly to keep things accurate.
        </p>
      </div>
    </div>
  );
}
