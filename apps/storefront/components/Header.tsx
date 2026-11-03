'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useAuth } from '@/lib/auth-context';

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const cart = useCart();
  const wishlist = useWishlist();
  const { user, logout } = useAuth();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    setSearchOpen(false);
    if (query) {
      router.push(`/shop?q=${encodeURIComponent(query)}`);
    }
  };

  // Update cart and wishlist counts (client-side only to avoid hydration mismatch)
  useEffect(() => {
    setCartCount(cart.getItemCount());
    setWishlistCount(wishlist.getItemCount());
    setIsHydrated(true);
  }, [cart, wishlist]);

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-black text-cream py-3 px-4 sm:px-6 md:px-8 border-b border-neutral-800 min-h-16">
        <div className="flex items-center justify-between gap-4 md:gap-8 h-full">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity">
            <img
              src="/logo/logo-wordmark-white.png"
              alt="PREMAL KAIZEN"
              className="h-6 md:h-7 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 flex-1 justify-center">
            {[
              { label: 'HOME', href: '/' },
              { label: 'PRODUCTS', href: '/shop' },
              { label: 'TRACK ORDER', href: '/orders' },
              { label: 'ABOUT', href: '/about' },
              { label: 'CONTACT', href: '/contact' },
            ].map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`text-xs font-semibold tracking-wide transition-colors pb-1 whitespace-nowrap ${
                    isActive
                      ? 'text-cream border-b-2 border-cream'
                      : 'text-gray-light hover:text-cream'
                  }`}
                  style={{ color: isActive ? '#F5F1ED' : '#999999' }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Icons */}
          <div className="flex items-center gap-4 md:gap-6 lg:gap-8 ml-auto flex-shrink-0" style={{ color: '#F5F1ED' }}>
            {/* Search Icon */}
            <div className="relative">
              <button
                className="w-6 h-6 flex items-center justify-center text-cream hover:opacity-70 transition-opacity flex-shrink-0 p-0"
                aria-label="Search"
                type="button"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>

              {searchOpen && (
                <form
                  onSubmit={handleSearchSubmit}
                  className="absolute right-0 mt-2 w-64 bg-neutral-800 rounded-lg shadow-lg p-2 z-50 flex gap-2"
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    autoFocus
                    className="flex-1 px-3 py-2 rounded bg-neutral-900 text-cream text-sm placeholder-gray-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-cream text-black text-sm font-medium rounded hover:bg-opacity-90 transition-colors"
                  >
                    Go
                  </button>
                </form>
              )}
            </div>

            {/* Account Icon / User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-6 h-6 flex items-center justify-center text-cream hover:opacity-70 transition-opacity p-0"
                type="button"
                aria-label="Account"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-neutral-800 rounded-lg shadow-lg py-2 z-50">
                  {user ? (
                    <>
                      <div className="px-4 py-2 border-b border-neutral-700">
                        <p className="text-cream text-sm font-medium">{user.firstName || user.email}</p>
                      </div>
                      <Link
                        href="/account/profile"
                        className="block px-4 py-2 text-cream hover:bg-neutral-700 transition-colors text-sm"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        My Account
                      </Link>
                      <Link
                        href="/account/addresses"
                        className="block px-4 py-2 text-cream hover:bg-neutral-700 transition-colors text-sm"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Addresses
                      </Link>
                      <Link
                        href="/account/security"
                        className="block px-4 py-2 text-cream hover:bg-neutral-700 transition-colors text-sm"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Security
                      </Link>
                      <button
                        onClick={async () => {
                          await logout();
                          setUserMenuOpen(false);
                          router.push('/');
                        }}
                        className="w-full text-left px-4 py-2 text-cream hover:bg-neutral-700 transition-colors text-sm border-t border-neutral-700"
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/login"
                        className="block px-4 py-2 text-cream hover:bg-neutral-700 transition-colors text-sm"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Login
                      </Link>
                      <Link
                        href="/auth/register"
                        className="block px-4 py-2 text-cream hover:bg-neutral-700 transition-colors text-sm border-t border-neutral-700"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Register
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Wishlist Icon */}
            <Link
              href="/wishlist"
              className="relative w-6 h-6 flex items-center justify-center text-cream hover:opacity-70 transition-opacity"
              aria-label={`Wishlist with ${wishlistCount} items`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {isHydrated && wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-beige text-neutral-900 text-xs font-bold rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart Icon with Badge */}
            <Link
              href="/cart"
              className="relative w-6 h-6 flex items-center justify-center text-cream hover:opacity-70 transition-opacity"
              aria-label={`Shopping cart with ${cartCount} items`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m10 0l2-9m0 0h3.6"
                />
              </svg>
              {isHydrated && cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-beige text-neutral-900 text-xs font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-6 h-6 flex flex-col items-center justify-center gap-1 text-cream"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              <span
                className={`w-5 h-0.5 bg-cream transition-transform origin-center ${
                  mobileMenuOpen ? 'rotate-45 translate-y-2' : ''
                }`}
              />
              <span
                className={`w-5 h-0.5 bg-cream transition-opacity ${
                  mobileMenuOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`w-5 h-0.5 bg-cream transition-transform origin-center ${
                  mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <nav className="fixed top-16 left-0 right-0 bg-neutral-900 border-b border-gray-medium z-30 md:hidden">
          <div className="flex flex-col p-4 gap-2">
            {[
              { label: 'HOME', href: '/' },
              { label: 'PRODUCTS', href: '/shop' },
              { label: 'TRACK ORDER', href: '/orders' },
              { label: 'ABOUT', href: '/about' },
              { label: 'CONTACT', href: '/contact' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-4 py-2 text-cream hover:bg-neutral-800 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
};
