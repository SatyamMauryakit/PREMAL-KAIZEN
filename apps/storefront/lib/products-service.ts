const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number | null;
  sku: string;
  colors: string[];
  sizes: string[];
  isActive: boolean;
  categoryId: string | null;
  category?: { id: string; name: string; slug: string };
  images: Array<{ id: string; url: string; alt?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsListResponse {
  data: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export const productsService = {
  async getProducts(
    page?: number,
    limit?: number,
    search?: string,
    category?: string
  ): Promise<ProductsListResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (category) params.append('category', category);

    try {
      const response = await fetch(`${API_BASE}/api/products?${params}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  async getProduct(id: string): Promise<Product> {
    try {
      const response = await fetch(`${API_BASE}/api/products/${id}`);
      if (!response.ok) throw new Error('Product not found');
      return response.json();
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },
};
