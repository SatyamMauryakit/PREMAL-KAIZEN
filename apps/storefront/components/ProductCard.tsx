import Link from 'next/link';
import { useState } from 'react';

interface ProductCardProps {
  id: string;
  name: string;
  price: string;
  image?: string;
  href: string;
  rating?: number;
  reviewCount?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id: _id,
  name,
  price,
  image,
  href,
  rating = 4.5,
  reviewCount = 0,
}) => {
  const [isWishlisted, setIsWishlisted] = useState(false);

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < Math.floor(rating)) {
        stars.push(<span key={i} className="text-xs">★</span>);
      } else if (i < rating && i - rating < 0.5) {
        stars.push(<span key={i} className="text-xs">★</span>);
      } else {
        stars.push(<span key={i} className="text-xs text-gray-300">★</span>);
      }
    }
    return stars;
  };

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
              setIsWishlisted(!isWishlisted);
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

          <p className="text-sm font-semibold text-black mt-auto bg-beige px-3 py-1.5 rounded inline-block">
            {price}
          </p>
        </div>
      </div>
    </Link>
  );
};
