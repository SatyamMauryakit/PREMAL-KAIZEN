import Link from 'next/link';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-cream py-16 md:py-24 px-4 sm:px-6 md:px-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          {/* Brand Column */}
          <div>
            <div className="mb-4">
              <svg className="w-8 h-8 text-cream" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 20h16v-2l-8-6-4 6-4-6V8L4 14z" />
              </svg>
            </div>
            <h3 className="text-base font-bold mb-3 tracking-wider">PREMAL KAIZEN</h3>
            <p className="text-sm text-gray-light leading-relaxed mb-4">
              Elevated streetwear crafted for the modern explorer. Wear your vibe. Own your story.
            </p>
            <p className="text-xs text-gray-500">Designed in Hong Kong</p>
          </div>

          {/* Shop Links */}
          <div>
            <h4 className="text-xs font-bold mb-4 tracking-widest uppercase text-cream">Shop</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'New Arrivals', href: '/shop?filter=new' },
                { label: 'Best Sellers', href: '/shop?filter=popular' },
                { label: 'All Products', href: '/shop' },
                { label: 'Collections', href: '/collections' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-light hover:text-cream transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h4 className="text-xs font-bold mb-4 tracking-widest uppercase text-cream">
              Support
            </h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'Contact Us', href: '/contact' },
                { label: 'Shipping Info', href: '/shipping' },
                { label: 'Returns & Exchange', href: '/returns' },
                { label: 'Track Order', href: '/orders' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-light hover:text-cream transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-bold mb-4 tracking-widest uppercase text-cream">Company</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'About Us', href: '/about' },
                { label: 'Journal', href: '/journal' },
                { label: 'Careers', href: '/careers' },
                { label: 'Press', href: '/press' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-light hover:text-cream transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 my-8 md:my-12" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-500">
          <p>© 2024 PREMAL KAIZEN — All rights reserved.</p>
          <div className="flex gap-6 md:gap-8">
            <Link href="/shipping" className="hover:text-cream transition-colors">Shipping Policy</Link>
            <Link href="/returns" className="hover:text-cream transition-colors">Returns</Link>
            <Link href="/privacy" className="hover:text-cream transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-cream transition-colors">Terms</Link>
          </div>
        </div>

        {/* Contact info at bottom */}
        <div className="mt-8 pt-8 border-t border-gray-800 text-center">
          <p className="text-xs text-gray-500 mb-2">Questions? We're here to help</p>
          <p className="text-sm text-gray-light font-medium">support@premalikaizen.com</p>
        </div>
      </div>
    </footer>
  );
};
