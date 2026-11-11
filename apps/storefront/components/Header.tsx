'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useAuth } from '@/lib/auth-context';
import { SearchAutocomplete } from './SearchAutocomplete';

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const cart = useCart();
  const wishlist = useWishlist();
  const { user, logout } = useAuth();

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
                // Viewport-anchored (fixed left-4 right-4) below md, not button-anchored -
                // an `absolute right-0` panel this wide would overflow past the left edge
                // of a narrow screen, since the search icon isn't at the true screen edge
                // there (the hamburger menu sits to its right). Reverts to the normal
                // button-anchored popover at md+ where there's room for it.
                <div className="fixed left-4 right-4 top-16 md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-80 bg-neutral-800 rounded-lg shadow-lg p-2 z-50">
                  <SearchAutocomplete autoFocus onNavigate={() => setSearchOpen(false)} />
                </div>
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
                <div className="absolute right-0 mt-3 w-60 bg-neutral-900 rounded-xl shadow-2xl ring-1 ring-white/10 py-2 z-50 origin-top-right animate-menuIn">
                  {user ? (
                    <>
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-700/80">
                        <div className="w-9 h-9 rounded-full bg-beige text-neutral-900 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {(user.firstName || user.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-cream text-sm font-semibold truncate">{user.firstName || user.email}</p>
                          {user.firstName && <p className="text-neutral-400 text-xs truncate">{user.email}</p>}
                        </div>
                      </div>

                      <div className="py-1.5">
                        <Link
                          href="/account/profile"
                          className="group flex items-center gap-3 px-4 py-2.5 text-cream hover:bg-neutral-800 hover:text-beige transition-colors text-sm"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <svg className="w-4 h-4 text-neutral-400 group-hover:text-beige transition-colors flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          My Account
                        </Link>
                        <Link
                          href="/account/addresses"
                          className="group flex items-center gap-3 px-4 py-2.5 text-cream hover:bg-neutral-800 hover:text-beige transition-colors text-sm"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <svg className="w-4 h-4 text-neutral-400 group-hover:text-beige transition-colors flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Addresses
                        </Link>
                        <Link
                          href="/account/security"
                          className="group flex items-center gap-3 px-4 py-2.5 text-cream hover:bg-neutral-800 hover:text-beige transition-colors text-sm"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <svg className="w-4 h-4 text-neutral-400 group-hover:text-beige transition-colors flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Security
                        </Link>
                      </div>

                      <div className="pt-1.5 border-t border-neutral-700/80">
                        <button
                          onClick={async () => {
                            await logout();
                            setUserMenuOpen(false);
                            router.push('/');
                          }}
                          className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-sm"
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/login"
                        className="block px-4 py-2.5 text-cream hover:bg-neutral-800 hover:text-beige transition-colors text-sm"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Login
                      </Link>
                      <Link
                        href="/auth/register"
                        className="block px-4 py-2.5 text-cream hover:bg-neutral-800 hover:text-beige transition-colors text-sm border-t border-neutral-700/80"
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
