'use client';

import Link from 'next/link';
import { Logo } from './Logo';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black text-cream py-16 md:py-24 px-4 sm:px-6 md:px-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          {/* Brand Column */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 text-cream flex-shrink-0">
                <Logo className="w-full h-full" />
              </div>
              <span className="text-sm font-bold tracking-widest uppercase">PREMAL KAIZEN</span>
            </Link>
            <p className="text-sm text-gray-light leading-relaxed mb-4">
              Wear your vibe. Own your story.
            </p>
            <p className="text-xs text-gray-500">Premium streetwear for the modern explorer.</p>
          </div>

          {/* Shop Links */}
          <div>
            <h4 className="text-xs font-bold mb-4 tracking-widest uppercase text-cream">Shop</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'All Products', href: '/shop' },
                { label: 'New Arrivals', href: '/shop?filter=new' },
                { label: 'Best Sellers', href: '/shop?filter=popular' },
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

          {/* Customer Support */}
          <div>
            <h4 className="text-xs font-bold mb-4 tracking-widest uppercase text-cream">
              Support
            </h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'Contact Us', href: '/contact' },
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
              <li>
                <a
                  href="mailto:support@premalikaizen.com"
                  className="text-gray-light hover:text-cream transition-colors"
                >
                  Email Support
                </a>
              </li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="text-xs font-bold mb-4 tracking-widest uppercase text-cream">About</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'About Us', href: '/about' },
                { label: 'Our Story', href: '/about' },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-light hover:text-cream transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://www.instagram.com/premalkaizen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-light hover:text-cream transition-colors"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 my-8 md:my-12" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-500">
          <p>© {currentYear} PREMAL KAIZEN — All rights reserved.</p>
          <div className="flex gap-6 md:gap-8">
            <Link href="/contact" className="hover:text-cream transition-colors">Contact</Link>
            <Link href="/orders" className="hover:text-cream transition-colors">Track Order</Link>
            <a href="mailto:support@premalikaizen.com" className="hover:text-cream transition-colors">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
