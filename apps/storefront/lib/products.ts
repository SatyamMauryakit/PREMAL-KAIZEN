// Product data for Phase 3
// TODO: Replace with API call to /api/products in Phase 8

export interface Product {
  id: string;
  name: string;
  category: 'hoodies' | 't-shirts' | 'pants' | 'outerwear' | 'accessories';
  price: number;
  originalPrice?: number;
  colors: string[];
  sizes: string[];
  rating: number;
  reviewCount: number;
  image: string;
  description: string;
  isNew?: boolean;
  createdAt: Date;
}

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Essential Heavy Hoodie',
    category: 'hoodies',
    price: 12800,
    colors: ['black', 'beige', 'gray'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    rating: 4.8,
    reviewCount: 124,
    image: 'https://via.placeholder.com/400x500?text=Essential+Heavy+Hoodie',
    description: 'Heavyweight cotton hoodie with embroidered mountain logo.',
    isNew: false,
    createdAt: new Date('2024-08-01'),
  },
  {
    id: '2',
    name: 'Tactical Cargo Pants',
    category: 'pants',
    price: 15200,
    colors: ['beige', 'black', 'olive'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    rating: 4.6,
    reviewCount: 80,
    image: 'https://via.placeholder.com/400x500?text=Tactical+Cargo+Pants',
    description: 'Utility-focused cargo pants with multiple pockets and adjustable cuffs.',
    isNew: false,
    createdAt: new Date('2024-07-15'),
  },
  {
    id: '3',
    name: 'Oversized Hoodie',
    category: 'hoodies',
    price: 11900,
    originalPrice: 14900,
    colors: ['black', 'cream'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    rating: 4.9,
    reviewCount: 156,
    image: 'https://via.placeholder.com/400x500?text=Oversized+Hoodie',
    description: 'Relaxed fit hoodie with premium heavyweight fabric.',
    isNew: true,
    createdAt: new Date('2024-10-20'),
  },
  {
    id: '4',
    name: 'Premal Logo Tee',
    category: 't-shirts',
    price: 6500,
    colors: ['black', 'beige', 'white', 'gray'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    rating: 4.7,
    reviewCount: 210,
    image: 'https://via.placeholder.com/400x500?text=Premal+Logo+Tee',
    description: 'Classic tee with minimalist mountain logo embroidery.',
    isNew: false,
    createdAt: new Date('2024-06-10'),
  },
  {
    id: '5',
    name: 'Quilted Bomber Jacket',
    category: 'outerwear',
    price: 24500,
    colors: ['black', 'beige'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    rating: 4.9,
    reviewCount: 67,
    image: 'https://via.placeholder.com/400x500?text=Quilted+Bomber+Jacket',
    description: 'Lightweight quilted bomber with hidden pocket storage.',
    isNew: true,
    createdAt: new Date('2024-10-15'),
  },
  {
    id: '6',
    name: 'Mountain Tee',
    category: 't-shirts',
    price: 5900,
    colors: ['black', 'beige', 'gray'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    rating: 4.5,
    reviewCount: 92,
    image: 'https://via.placeholder.com/400x500?text=Mountain+Tee',
    description: 'Graphic tee with mountain range print.',
    isNew: false,
    createdAt: new Date('2024-05-20'),
  },
  {
    id: '7',
    name: 'Utility T-shirt',
    category: 't-shirts',
    price: 7300,
    colors: ['black', 'olive', 'gray'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    rating: 4.6,
    reviewCount: 145,
    image: 'https://via.placeholder.com/400x500?text=Utility+T-shirt',
    description: 'Multi-pocket utility tee with reinforced seams.',
    isNew: false,
    createdAt: new Date('2024-07-01'),
  },
  {
    id: '8',
    name: 'Relaxed Hoodie',
    category: 'hoodies',
    price: 13500,
    colors: ['beige', 'cream', 'black'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    rating: 4.8,
    reviewCount: 118,
    image: 'https://via.placeholder.com/400x500?text=Relaxed+Hoodie',
    description: 'Oversized relaxed hoodie with dropped shoulders.',
    isNew: true,
    createdAt: new Date('2024-10-10'),
  },
  {
    id: '9',
    name: 'Wool Knit Beanie',
    category: 'accessories',
    price: 3800,
    colors: ['black', 'beige', 'gray', 'cream'],
    sizes: ['One Size'],
    rating: 4.7,
    reviewCount: 87,
    image: 'https://via.placeholder.com/400x500?text=Wool+Knit+Beanie',
    description: 'Premium wool knit beanie with ribbed texture.',
    isNew: false,
    createdAt: new Date('2024-08-15'),
  },
  {
    id: '10',
    name: 'Crossbody Bag',
    category: 'accessories',
    price: 9900,
    colors: ['black', 'beige'],
    sizes: ['One Size'],
    rating: 4.4,
    reviewCount: 63,
    image: 'https://via.placeholder.com/400x500?text=Crossbody+Bag',
    description: 'Compact crossbody bag with adjustable strap.',
    isNew: false,
    createdAt: new Date('2024-06-30'),
  },
  {
    id: '11',
    name: 'Puffer Jacket',
    category: 'outerwear',
    price: 22000,
    colors: ['black', 'beige'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    rating: 4.8,
    reviewCount: 104,
    image: 'https://via.placeholder.com/400x500?text=Puffer+Jacket',
    description: 'Insulated puffer jacket with premium down fill.',
    isNew: false,
    createdAt: new Date('2024-09-01'),
  },
  {
    id: '12',
    name: 'Cargo Shorts',
    category: 'pants',
    price: 8900,
    colors: ['beige', 'black', 'khaki'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    rating: 4.5,
    reviewCount: 71,
    image: 'https://via.placeholder.com/400x500?text=Cargo+Shorts',
    description: 'Lightweight cargo shorts with ventilation panels.',
    isNew: false,
    createdAt: new Date('2024-07-20'),
  },
];

export const CATEGORIES = [
  { id: 'hoodies', label: 'Hoodies' },
  { id: 't-shirts', label: 'T-Shirts' },
  { id: 'pants', label: 'Pants' },
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'accessories', label: 'Accessories' },
];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];

export const COLORS = [
  { id: 'black', label: 'Black', hex: '#000000' },
  { id: 'beige', label: 'Beige', hex: '#D4C5B9' },
  { id: 'cream', label: 'Cream', hex: '#F5F1ED' },
  { id: 'gray', label: 'Gray', hex: '#666666' },
  { id: 'olive', label: 'Olive', hex: '#556B2F' },
  { id: 'khaki', label: 'Khaki', hex: '#C3B091' },
  { id: 'white', label: 'White', hex: '#FFFFFF' },
];

export const PRICE_RANGE = {
  min: 3800,
  max: 24500,
};

// Filter product list based on criteria
export function filterProducts(
  products: Product[],
  filters: {
    categories?: string[];
    sizes?: string[];
    colors?: string[];
    priceMin?: number;
    priceMax?: number;
    searchQuery?: string;
  }
): Product[] {
  return products.filter((product) => {
    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(product.category)) {
        return false;
      }
    }

    // Size filter
    if (filters.sizes && filters.sizes.length > 0) {
      const hasSize = filters.sizes.some((size) => product.sizes.includes(size));
      if (!hasSize) {
        return false;
      }
    }

    // Color filter
    if (filters.colors && filters.colors.length > 0) {
      const hasColor = filters.colors.some((color) => product.colors.includes(color));
      if (!hasColor) {
        return false;
      }
    }

    // Price filter
    if (filters.priceMin !== undefined && product.price < filters.priceMin) {
      return false;
    }
    if (filters.priceMax !== undefined && product.price > filters.priceMax) {
      return false;
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesName = product.name.toLowerCase().includes(query);
      const matchesDescription = product.description.toLowerCase().includes(query);
      if (!matchesName && !matchesDescription) {
        return false;
      }
    }

    return true;
  });
}

// Sort products
export function sortProducts(
  products: Product[],
  sortBy: 'featured' | 'price-low' | 'price-high' | 'newest' | 'rating'
): Product[] {
  const sorted = [...products];

  switch (sortBy) {
    case 'price-low':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-high':
      return sorted.sort((a, b) => b.price - a.price);
    case 'newest':
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'featured':
    default:
      // Featured: new items first, then by rating
      return sorted.sort((a, b) => {
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        return b.rating - a.rating;
      });
  }
}

// Format price in Indian Rupees
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(price);
}
