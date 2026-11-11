'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoreContactInfo } from '@/lib/store-info';
import { InstagramIcon } from './icons/InstagramIcon';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [contactInfo, setContactInfo] = useState({ storeEmail: '', storePhone: '' });

  useEffect(() => {
    getStoreContactInfo()
      .then((info) => setContactInfo({ storeEmail: info.storeEmail, storePhone: info.storePhone }))
      .catch(() => {});
  }, []);

  const { storeEmail, storePhone } = contactInfo;

  return (
    <footer className="bg-black text-cream py-16 md:py-24 px-4 sm:px-6 md:px-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Announcement strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-gray-300 border-b border-gray-800 pb-8 mb-8 text-center">
          <span>Premium Quality | Mix Fabrics</span>
          <span className="text-gray-700" aria-hidden="true">•</span>
          <span>Pan-India Delivery</span>
          <span className="text-gray-700" aria-hidden="true">•</span>
          <span>Fast &amp; Secure Prepaid Delivery</span>
        </div>

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          {/* Brand Column */}
          <div>
            <Link href="/" className="inline-flex items-center mb-4 hover:opacity-80 transition-opacity">
              <img
                src="/logo/logo-wordmark-white.png"
                alt="PREMAL KAIZEN"
                className="h-6 w-auto"
              />
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
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-light hover:text-cream transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Support */}
          <div>
            <h4 className="text-xs font-bold mb-4 tracking-widest uppercase text-cream">Support</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'Contact Us', href: '/contact' },
                { label: 'Track Order', href: '/orders' },
                { label: 'FAQ', href: '/faq' },
                { label: 'Shipping', href: '/shipping' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-light hover:text-cream transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
              {storeEmail && (
                <li>
                  <a href={`mailto:${storeEmail}`} className="text-gray-light hover:text-cream transition-colors">
                    Email Support
                  </a>
                </li>
              )}
              {storePhone && storePhone !== '+91-XXX-XXX-XXXX' && (
                <li>
                  <a href={`tel:${storePhone}`} className="text-gray-light hover:text-cream transition-colors">
                    {storePhone}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="text-xs font-bold mb-4 tracking-widest uppercase text-cream">About</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'About Us', href: '/about' },
                { label: 'Our Story', href: '/about#story' },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-gray-light hover:text-cream transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                {/* Instagram URL — update via INSTAGRAM_URL env var or set in admin */}
                <a
                  href="https://www.instagram.com/premal.kaizen"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow PREMAL KAIZEN on Instagram (opens in a new tab)"
                  className="inline-flex items-center gap-2 text-gray-light hover:text-cream transition-colors"
                >
                  <InstagramIcon className="w-4 h-4" />
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
            <Link href="/faq" className="hover:text-cream transition-colors">FAQ</Link>
            <Link href="/orders" className="hover:text-cream transition-colors">Track Order</Link>
            {storeEmail && (
              <a href={`mailto:${storeEmail}`} className="hover:text-cream transition-colors">Support</a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
