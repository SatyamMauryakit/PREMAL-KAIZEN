'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login?redirect=/account');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div className="container mx-auto px-4 py-12 text-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  const navItems = [
    { label: 'Profile', href: '/account/profile' },
    { label: 'Addresses', href: '/account/addresses' },
    { label: 'Security', href: '/account/security' },
    { label: 'Wishlist', href: '/account/wishlist' },
    { label: 'Orders', href: '/account/orders' },
  ];

  return (
    <div className="bg-gradient-to-b from-cream to-white min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">My Account</h1>
          <p className="text-gray-600">Welcome, {user.firstName || user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="md:col-span-1">
            <nav className="bg-white rounded-lg shadow-md p-4 sticky top-4">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-cream hover:text-black transition-colors font-medium"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
