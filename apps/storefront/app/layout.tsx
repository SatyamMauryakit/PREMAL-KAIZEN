import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CartProvider } from '@/lib/cart-context';
import { WishlistProvider } from '@/lib/wishlist-context';
import { AuthProvider } from '@/lib/auth-context';
import { CheckoutProvider } from '@/lib/checkout-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'PREMAL KAIZEN | Premium Streetwear',
  description: 'Wear Your Vibe. Own Your Story. Premium streetwear crafted for the modern explorer.',
  keywords: ['streetwear', 'fashion', 'premium', 'clothing'],
  openGraph: {
    title: 'PREMAL KAIZEN',
    description: 'Wear Your Vibe. Own Your Story.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-cream">
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <CheckoutProvider>
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
              </CheckoutProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
