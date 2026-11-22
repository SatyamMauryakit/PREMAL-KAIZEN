import type { Metadata } from 'next';
import Link from 'next/link';
import { buildStaticMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildStaticMetadata({
  title: 'Shipping & Delivery Policy',
  description: 'How PREMAL KAIZEN processes, ships, and tracks your order, and what to do if delivery doesn\'t go to plan.',
  path: '/shipping-policy',
});

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="mb-12 flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Shipping &amp; Delivery Policy</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-black mb-6">Shipping &amp; Delivery Policy</h1>
        <p className="text-gray-dark text-lg leading-relaxed mb-8">
          For live shipping methods and current rates at checkout, see our{' '}
          <Link href="/shipping" className="text-black underline hover:no-underline">Shipping Information</Link> page.
          This policy covers how orders move from placed to delivered, and what happens if something goes wrong
          along the way.
        </p>

        <div className="bg-white rounded-lg border border-gray-light p-8 mb-8 space-y-6">
          <div>
            <h2 className="font-bold text-black mb-2">Order processing</h2>
            <p className="text-gray-dark leading-relaxed">
              Once placed, an order moves through <strong>Confirmed</strong> and <strong>Processing</strong> as we
              prepare it, then <strong>Packed</strong> once it's ready to hand to our courier partner.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Shipping confirmation</h2>
            <p className="text-gray-dark leading-relaxed">
              When your order is handed to the courier, its status changes to <strong>Shipped</strong> and you'll
              receive tracking details by email. From this point, self-service cancellation is no longer
              available — see our <Link href="/cancellation-policy" className="text-black underline hover:no-underline">Cancellation Policy</Link>.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Estimated delivery timelines</h2>
            <p className="text-gray-dark leading-relaxed">
              We deliver pan-India. Delivery estimates vary by destination and courier serviceability, and are
              shown for your specific order at checkout and on the order tracking page once available — we don't
              quote a single fixed timeline here since it depends on where you are.{' '}
              <span className="font-medium">[CONFIRM WITH OWNER: a standard delivery-window range to publish here, if one should be stated.]</span>
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Tracking your order</h2>
            <p className="text-gray-dark leading-relaxed">
              Track any order from <Link href="/orders" className="text-black underline hover:no-underline">Track Order</Link>{' '}
              (using your order number and email) or from <Link href="/account/orders" className="text-black underline hover:no-underline">My Orders</Link>{' '}
              if you're signed in. Once shipped, the courier name and tracking number are shown on the order.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Delivery delays</h2>
            <p className="text-gray-dark leading-relaxed">
              Occasionally couriers run behind schedule due to weather, regional disruptions, or high demand
              periods. If your order looks delayed against its tracking, <Link href="/contact" className="text-black underline hover:no-underline">contact us</Link> with
              your order number and we'll check with the courier on your behalf.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-black mb-2">Incorrect address or failed delivery</h2>
            <p className="text-gray-dark leading-relaxed">
              Please double-check your delivery address before placing an order — we ship to the address on the
              order. If a delivery attempt fails or an address turns out to be incorrect, the courier will
              generally attempt a re-delivery or return the shipment to us; reach out to{' '}
              <Link href="/contact" className="text-black underline hover:no-underline">support</Link> as soon as you notice so we can help resolve it quickly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
