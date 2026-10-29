import Link from 'next/link';
import { ProductCard } from './ProductCard';

// Featured products from UI reference - with improved product visualizations
const FEATURED_PRODUCTS = [
  {
    id: '1',
    name: 'Oversized Hoodie',
    price: 'HK$599',
    href: '/products/oversized-hoodie',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350"%3E%3Cdefs%3E%3ClinearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%"%3E%3Cstop offset="0%" style="stop-color:%23f5f1ed;stop-opacity:1" /%3E%3Cstop offset="100%" style="stop-color:%23ede5da;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23bg1)" width="300" height="350"/%3E%3Cg opacity="0.9"%3E%3Cpath fill="%23222" d="M100 60 Q100 50 110 50 L190 50 Q200 50 200 60 L200 180 Q200 190 190 200 L110 200 Q100 190 100 180 Z"/%3E%3Cpath fill="%23333" d="M80 150 L120 220 M220 150 L180 220"/%3E%3Cpath fill="%23444" d="M100 70 L90 85 M200 70 L210 85"/%3E%3C/g%3E%3Ctext x="150" y="290" text-anchor="middle" font-family="Arial" font-size="14" fill="%23666"%3EOversized Hoodie%3C/text%3E%3C/svg%3E',
  },
  {
    id: '2',
    name: 'Mountain Tee',
    price: 'HK$329',
    href: '/products/mountain-tee',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350"%3E%3Cdefs%3E%3ClinearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%"%3E%3Cstop offset="0%" style="stop-color:%23f5f1ed;stop-opacity:1" /%3E%3Cstop offset="100%" style="stop-color:%23ede5da;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23bg2)" width="300" height="350"/%3E%3Cg opacity="0.95"%3E%3Cpath fill="%23d4a574" d="M110 80 L190 80 L200 120 L100 120 Z"/%3E%3Cpath fill="%23c9a070" d="M100 120 L200 120 L210 280 L90 280 Z"/%3E%3Cpath fill="%23e6c19c" d="M130 150 L170 150 L165 200 L135 200 Z"/%3E%3C/g%3E%3Ctext x="150" y="310" text-anchor="middle" font-family="Arial" font-size="14" fill="%23999"%3EMountain Tee%3C/text%3E%3C/svg%3E',
  },
  {
    id: '3',
    name: 'Utility T-shirt',
    price: 'HK$299',
    href: '/products/utility-tshirt',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350"%3E%3Cdefs%3E%3ClinearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%"%3E%3Cstop offset="0%" style="stop-color:%23f5f1ed;stop-opacity:1" /%3E%3Cstop offset="100%" style="stop-color:%23ede5da;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23bg3)" width="300" height="350"/%3E%3Cg opacity="0.95"%3E%3Cpath fill="%23111" d="M110 85 L190 85 L200 130 L100 130 Z"/%3E%3Cpath fill="%23222" d="M100 130 L200 130 L215 270 L85 270 Z"/%3E%3Cpath fill="%23333" d="M140 160 L160 160 L155 210 L145 210 Z"/%3E%3Ccircle cx="120" cy="175" r="3" fill="%23555"/%3E%3Ccircle cx="180" cy="175" r="3" fill="%23555"/%3E%3C/g%3E%3Ctext x="150" y="310" text-anchor="middle" font-family="Arial" font-size="14" fill="%23888"%3EUtility T-shirt%3C/text%3E%3C/svg%3E',
  },
  {
    id: '4',
    name: 'Relaxed Hoodie',
    price: 'HK$599',
    href: '/products/relaxed-hoodie',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350"%3E%3Cdefs%3E%3ClinearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%"%3E%3Cstop offset="0%" style="stop-color:%23f5f1ed;stop-opacity:1" /%3E%3Cstop offset="100%" style="stop-color:%23ede5da;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23bg4)" width="300" height="350"/%3E%3Cg opacity="0.9"%3E%3Cpath fill="%23b89968" d="M105 65 Q105 55 115 55 L185 55 Q195 55 195 65 L195 175 Q195 185 185 190 L115 190 Q105 185 105 175 Z"/%3E%3Cpath fill="%23c9a885" d="M85 145 L125 230 M215 145 L175 230"/%3E%3Cpath fill="%23d4b399" d="M105 75 L95 90 M195 75 L205 90"/%3E%3Crect x="135" y="130" width="30" height="20" fill="%23999" opacity="0.3"/%3E%3C/g%3E%3Ctext x="150" y="300" text-anchor="middle" font-family="Arial" font-size="14" fill="%23777"%3ERelaxed Hoodie%3C/text%3E%3C/svg%3E',
  },
];

export const ProductsSection: React.FC = () => {
  return (
    <section className="bg-cream py-20 md:py-32 px-4 sm:px-6 md:px-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
            Shop the Collection
          </h2>
          <p className="text-base md:text-lg text-gray-700">
            Curated essentials. Hoodies, tees, and more.
          </p>
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {FEATURED_PRODUCTS.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>

        {/* View all CTA */}
        <div className="flex justify-center">
          <Link
            href="/shop"
            className="px-8 py-3 border border-black text-black font-semibold hover:bg-black hover:text-cream transition-colors rounded"
          >
            View All Products
          </Link>
        </div>
      </div>
    </section>
  );
};
