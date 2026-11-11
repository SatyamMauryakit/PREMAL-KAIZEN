import Link from 'next/link';
import { useWishlist } from '@/lib/wishlist-context';

interface ProductCardProps {
  id: string;
  name: string;
  price: number; // in paise
  /** In paise, same unit as `price`. Shown struck-through with a discount % badge when greater than `price`. */
  originalPrice?: number;
  image?: string;
  href: string;
  category?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  originalPrice,
  image,
  href,
  category = '',
}) => {
  const wishlist = useWishlist();
  const isWishlisted = wishlist.isInWishlist(id);

  // `price` here is raw paise (see the prop comment above). Wishlist/cart state is
  // stored in rupees everywhere else in the app (lib/products.ts, lib/pricing.ts) -
  // convert once here and reuse for both display and the wishlist toggle below,
  // rather than passing the raw paise value into wishlist state.
  const priceInRupees = Math.round(price / 100);
  const formattedPrice = `₹${priceInRupees.toLocaleString('en-IN')}`;
  const hasDiscount = originalPrice !== undefined && originalPrice > price;
  const formattedOriginalPrice = hasDiscount
    ? `₹${Math.round(originalPrice! / 100).toLocaleString('en-IN')}`
    : null;
  const discountPercent = hasDiscount ? Math.round((1 - price / originalPrice!) * 100) : null;

  return (
    <Link href={href} className="group h-full">
      <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow">
        {/* Image container */}
        <div className="relative bg-cream aspect-square overflow-hidden">
          {image ? (
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-medium">
              <span className="text-sm">Image</span>
            </div>
          )}

          {/* Wishlist button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              wishlist.toggleItem({ productId: id, name, price: priceInRupees, image: image || '', category });
            }}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white hover:bg-cream rounded-full shadow-md transition-all hover:scale-110"
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <svg
              className={`w-5 h-5 ${isWishlisted ? 'fill-current text-black' : 'text-gray-400'}`}
              fill={isWishlisted ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={isWishlisted ? 0 : 1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>

        {/* Product info */}
        <div className="flex-1 p-4 flex flex-col">
          <h3 className="text-sm font-medium text-black mb-3 line-clamp-2">
            {name}
          </h3>

          <div className="mt-auto flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-black bg-beige px-3 py-1.5 rounded inline-block">
              {formattedPrice}
            </p>
            {hasDiscount && (
              <>
                <span className="text-xs text-gray-medium line-through">{formattedOriginalPrice}</span>
                <span className="text-xs font-semibold text-green-700">{discountPercent}% off</span>
              </>
            )}
          </div>

          {/* Purely visual - the whole card is already the link above, so this
              doesn't need its own click handler (and nesting a real <button>
              inside the anchor would be invalid HTML). */}
          <span className="mt-3 block w-full text-center px-4 py-2 bg-black text-cream text-sm font-medium rounded group-hover:bg-gray-dark transition-colors">
            View Product
          </span>
        </div>
      </div>
    </Link>
  );
};
