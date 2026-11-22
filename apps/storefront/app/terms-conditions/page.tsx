import type { Metadata } from 'next';
import Link from 'next/link';
import { buildStaticMetadata } from '@/lib/metadata';
import { getStoreContactInfo } from '@/lib/store-info';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Terms & Conditions',
  description: 'The terms that apply when you use the PREMAL KAIZEN website and place an order.',
  path: '/terms-conditions',
});

export default async function TermsConditionsPage() {
  const contact = await getStoreContactInfo().catch(() => ({ storeName: 'PREMAL KAIZEN', storeEmail: '', storePhone: '' }));

  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-12 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Terms &amp; Conditions</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-black mb-6">Terms &amp; Conditions</h1>
        <p className="text-gray-dark text-lg leading-relaxed mb-8">
          By using the {contact.storeName} website and placing an order, you agree to the terms below.
        </p>

        <div className="bg-white rounded-lg border border-gray-light p-8 mb-8 space-y-6">
          <div>
            <h2 className="font-bold text-black mb-2">Website usage</h2>
            <p className="text-gray-dark leading-relaxed">
              You agree to use this website only for lawful purposes and not to misuse it — including attempting
              to access other customers' accounts or disrupt the site's normal operation.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Customer accounts</h2>
            <p className="text-gray-dark leading-relaxed">
              You're responsible for keeping your account credentials confidential and for all activity under
              your account. Let us know immediately if you suspect unauthorized access.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Product information &amp; pricing</h2>
            <p className="text-gray-dark leading-relaxed">
              We try to display product details and pricing accurately. Prices are shown in Indian Rupees (INR)
              and may change without notice; the price charged is the one shown at the time you complete checkout.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Orders &amp; payments</h2>
            <p className="text-gray-dark leading-relaxed">
              Placing an order is an offer to purchase, which we accept once the order is confirmed. We accept
              Cash on Delivery and online payments (UPI, cards, net banking) via Razorpay. All online payments are
              verified server-side before an order is marked paid.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Shipping</h2>
            <p className="text-gray-dark leading-relaxed">
              See our <Link href="/shipping-policy" className="text-black underline hover:no-underline">Shipping &amp; Delivery Policy</Link> for
              how orders are processed and shipped.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Cancellation</h2>
            <p className="text-gray-dark leading-relaxed">
              See our <Link href="/cancellation-policy" className="text-black underline hover:no-underline">Cancellation Policy</Link> for
              when and how an order can be cancelled.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Returns &amp; refunds</h2>
            <p className="text-gray-dark leading-relaxed">
              See our <Link href="/return-exchange-policy" className="text-black underline hover:no-underline">Return &amp; Exchange Policy</Link> and{' '}
              <Link href="/refund-policy" className="text-black underline hover:no-underline">Refund Policy</Link> for
              the conditions and process.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Intellectual property</h2>
            <p className="text-gray-dark leading-relaxed">
              All brand names, logos, product designs, and content on this site belong to {contact.storeName}{' '}
              and may not be reproduced without permission.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Limitation of liability</h2>
            <p className="text-gray-dark leading-relaxed">
              We aren't liable for indirect or consequential losses arising from use of this website, to the
              fullest extent permitted by law.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Changes to these terms</h2>
            <p className="text-gray-dark leading-relaxed">
              We may update these terms from time to time; the current version is always the one published on
              this page.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Governing law</h2>
            <p className="text-gray-dark leading-relaxed font-medium">
              [CONFIRM WITH OWNER: the registered business state/jurisdiction for governing law and dispute
              resolution is not yet configured in Store Settings.]
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Contact</h2>
            <p className="text-gray-dark leading-relaxed">
              {contact.storeEmail ? (
                <>Questions about these terms? Email <a href={`mailto:${contact.storeEmail}`} className="text-black underline hover:no-underline">{contact.storeEmail}</a> or visit our <Link href="/contact" className="text-black underline hover:no-underline">Contact page</Link>.</>
              ) : (
                <>Questions about these terms? Visit our <Link href="/contact" className="text-black underline hover:no-underline">Contact page</Link>.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
