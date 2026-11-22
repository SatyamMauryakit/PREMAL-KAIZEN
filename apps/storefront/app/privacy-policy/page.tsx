import type { Metadata } from 'next';
import Link from 'next/link';
import { buildStaticMetadata } from '@/lib/metadata';
import { getStoreContactInfo } from '@/lib/store-info';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Privacy Policy',
  description: 'What information PREMAL KAIZEN collects, how it is used and protected, and your privacy rights.',
  path: '/privacy-policy',
});

export default async function PrivacyPolicyPage() {
  const contact = await getStoreContactInfo().catch(() => ({ storeName: 'PREMAL KAIZEN', storeEmail: '', storePhone: '' }));

  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-12 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Privacy Policy</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-black mb-6">Privacy Policy</h1>
        <p className="text-gray-dark text-lg leading-relaxed mb-8">
          This explains what information {contact.storeName} collects when you use our website, how it's used,
          and the choices you have.
        </p>

        <div className="bg-white rounded-lg border border-gray-light p-8 mb-8 space-y-6">
          <div>
            <h2 className="font-bold text-black mb-2">Information we collect</h2>
            <p className="text-gray-dark leading-relaxed">
              <strong>Account information:</strong> your name, email address, and phone number when you create an
              account. <strong>Shipping information:</strong> the delivery addresses you save or enter at
              checkout. <strong>Order information:</strong> the products you purchase, order history, and
              communications with our support team.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Payment processing</h2>
            <p className="text-gray-dark leading-relaxed">
              Online payments are processed by Razorpay, our PCI-DSS-compliant payment gateway. We never see or
              store your full card, UPI, or net banking credentials — those are handled entirely by Razorpay.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Cookies</h2>
            <p className="text-gray-dark leading-relaxed">
              We use essential cookies/local storage to keep you signed in and remember your cart. We do not use
              these to sell your data to third parties.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Data security</h2>
            <p className="text-gray-dark leading-relaxed">
              Your information is transmitted over encrypted (HTTPS) connections and stored on access-controlled
              infrastructure. Passwords are never stored in plain text.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">How we share information</h2>
            <p className="text-gray-dark leading-relaxed">
              We share order and shipping details only with the service providers needed to fulfil your order —
              our payment gateway (Razorpay) and courier/shipping partners. We do not sell your personal
              information to third parties.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Your rights</h2>
            <p className="text-gray-dark leading-relaxed">
              You can review and update your account details any time from{' '}
              <Link href="/account/profile" className="text-black underline hover:no-underline">My Account</Link>.
              To request a copy of your data, its correction, or its deletion, contact us using the details below.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Contact for privacy requests</h2>
            <p className="text-gray-dark leading-relaxed">
              {contact.storeEmail ? (
                <>Email us at <a href={`mailto:${contact.storeEmail}`} className="text-black underline hover:no-underline">{contact.storeEmail}</a>.</>
              ) : (
                <span className="font-medium">[CONFIRM WITH OWNER: a support email for privacy requests is not yet configured in Store Settings.]</span>
              )}
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Legal and registration details</h2>
            <p className="text-gray-dark leading-relaxed font-medium">
              [CONFIRM WITH OWNER: registered business/legal entity name, GSTIN, business address, and a
              Grievance Officer name and contact are not yet configured and must be supplied before this policy
              is considered complete for a live Indian e-commerce site.]
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
