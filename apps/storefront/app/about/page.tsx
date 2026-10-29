'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-cream pt-20">
      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 mb-12">
        <div className="flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">About Us</span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl md:text-6xl font-bold text-black leading-tight mb-6">
              Wear Your Vibe.<br />
              Own Your Story.
            </h1>
            <p className="text-xl text-gray-dark leading-relaxed mb-8">
              PREMAL KAIZEN is premium minimalist streetwear designed for the modern explorer. Every piece reflects a philosophy of continuous improvement, personal authenticity, and confidence through style.
            </p>
            <Link
              href="/shop"
              className="inline-block px-8 py-3 bg-black text-cream rounded hover:bg-gray-dark transition-colors font-medium"
            >
              Explore the Collection
            </Link>
          </div>
          <div className="bg-gray-light rounded-lg aspect-square flex items-center justify-center">
            <div className="w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full text-black opacity-20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 20h16v-2l-8-6-4 6-4-6V8L4 14z" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="bg-black text-cream py-20 px-4 sm:px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mb-8">Our Story</h2>
          <div className="space-y-6 text-lg leading-relaxed">
            <p>
              PREMAL KAIZEN represents the intersection of personal identity and continuous improvement. The word "Kaizen," derived from Japanese philosophy, means the practice of constant, incremental growth. We believe that fashion is not just about the clothes you wear—it's about the person you're becoming.
            </p>
            <p>
              Every garment in our collection is designed with intention. We focus on minimalist silhouettes that transcend trends, allowing your individuality to shine through. Whether you're building a streetwear wardrobe or expressing your unique vibe, our pieces are meant to be layered, mixed, and made your own.
            </p>
            <p>
              We are committed to creating clothing that lasts—not just in durability, but in relevance. Our designs celebrate the modern explorer: someone who values quality, authenticity, and the freedom to express themselves through what they wear.
            </p>
          </div>
        </div>
      </section>

      {/* Our Philosophy Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-20">
        <h2 className="text-4xl font-bold text-black mb-16">Our Philosophy</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
          {/* Individuality */}
          <div className="border-l-4 border-black pl-8">
            <h3 className="text-2xl font-bold text-black mb-4">Individuality</h3>
            <p className="text-gray-dark leading-relaxed">
              We design pieces that complement your personal style, not dictate it. Your vibe is unique, and our clothing is a canvas for your self-expression.
            </p>
          </div>

          {/* Continuous Improvement */}
          <div className="border-l-4 border-black pl-8">
            <h3 className="text-2xl font-bold text-black mb-4">Continuous Improvement</h3>
            <p className="text-gray-dark leading-relaxed">
              Just as Kaizen guides growth, we're always refining our craft. Better silhouettes, better fabrics, better experiences—it's a journey, not a destination.
            </p>
          </div>

          {/* Minimalist Design */}
          <div className="border-l-4 border-black pl-8">
            <h3 className="text-2xl font-bold text-black mb-4">Minimalist Design</h3>
            <p className="text-gray-dark leading-relaxed">
              Less is more. Our designs strip away the unnecessary to focus on what matters: quality, fit, and timeless style that works across seasons and moods.
            </p>
          </div>

          {/* Confidence & Expression */}
          <div className="border-l-4 border-black pl-8">
            <h3 className="text-2xl font-bold text-black mb-4">Confidence & Expression</h3>
            <p className="text-gray-dark leading-relaxed">
              Clothing has power. When you wear something that feels right, you carry yourself differently. We create pieces designed to make you feel confident in your own skin.
            </p>
          </div>
        </div>
      </section>

      {/* Designed for Your Everyday */}
      <section className="bg-gray-light py-20 px-4 sm:px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-black mb-8">Designed for Your Everyday</h2>
          <p className="text-xl text-gray-dark leading-relaxed mb-8">
            PREMAL KAIZEN pieces are built for real life. Whether you're navigating the city, hanging with friends, or creating something new, our garments are designed to keep pace with your day. We focus on versatile silhouettes that work across different settings, allowing you to build a wardrobe that's genuinely reflective of how you live.
          </p>
          <p className="text-lg text-gray-dark leading-relaxed">
            From oversized hoodies to tailored essentials, every piece is meant to be styled your way. Mix, layer, and make it your own.
          </p>
        </div>
      </section>

      {/* Brand Statement */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-20">
        <div className="text-center">
          <div className="mb-8 flex justify-center">
            <Logo className="w-16 h-16 text-black" />
          </div>
          <h2 className="text-5xl font-bold text-black mb-6">Wear Your Vibe.<br />Own Your Story.</h2>
          <p className="text-xl text-gray-dark max-w-2xl mx-auto leading-relaxed">
            This isn't just a tagline. It's an invitation. In a world of trends and noise, we believe in clothes that let you be authentically, unapologetically you.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-black text-cream py-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to explore?</h2>
          <p className="text-lg mb-8 leading-relaxed">
            Discover our collection of premium streetwear crafted for those who value quality, authenticity, and the freedom to express themselves.
          </p>
          <Link
            href="/shop"
            className="inline-block px-8 py-3 bg-cream text-black rounded hover:bg-gray-light transition-colors font-medium"
          >
            Shop Now
          </Link>
        </div>
      </section>

      {/* Footer Links */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-16 border-t border-gray-light">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h3 className="font-bold text-black mb-4">Questions?</h3>
            <p className="text-gray-dark mb-4">
              We're here to help with any questions about our products or your order.
            </p>
            <Link
              href="/contact"
              className="inline-block text-black font-medium underline hover:no-underline"
            >
              Get in Touch →
            </Link>
          </div>
          <div>
            <h3 className="font-bold text-black mb-4">Track Your Order</h3>
            <p className="text-gray-dark mb-4">
              Monitor the status of your shipment and get delivery updates.
            </p>
            <Link
              href="/orders"
              className="inline-block text-black font-medium underline hover:no-underline"
            >
              Track Order →
            </Link>
          </div>
          <div>
            <h3 className="font-bold text-black mb-4">Learn More</h3>
            <p className="text-gray-dark mb-4">
              Explore our shipping policies, returns, and other important information.
            </p>
            <Link
              href="/shipping"
              className="inline-block text-black font-medium underline hover:no-underline"
            >
              Shipping Info →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
