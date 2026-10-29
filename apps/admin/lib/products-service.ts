const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  originalPrice: number | null;
  isActive: boolean;
  colors: string[];
  sizes: string[];
  categoryId: string | null;
  category?: { id: string; name: string; slug: string };
  images: Array<{ id: string; url: string; alt?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsListResponse {
  data: ProductResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface CategoriesListResponse {
  data: CategoryResponse[];
  total: number;
}

export const adminProductsService = {
  async getProducts(
    token: string,
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

    const response = await fetch(`${API_BASE}/api/products?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  },

  async getProduct(id: string, token: string): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE}/api/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Product not found');
    return response.json();
  },

  async createProduct(data: Partial<ProductResponse>, token: string): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create product');
    }
    return response.json();
  },

  async updateProduct(
    id: string,
    data: Partial<ProductResponse>,
    token: string
  ): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update product');
    }
    return response.json();
  },

  async deleteProduct(id: string, token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to delete product');
    return response.json();
  },
};

export const adminCategoriesService = {
  async getCategories(token: string, search?: string): Promise<CategoriesListResponse> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);

    const response = await fetch(`${API_BASE}/api/categories?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  },

  async getCategory(id: string, token: string): Promise<CategoryResponse> {
    const response = await fetch(`${API_BASE}/api/categories/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Category not found');
    return response.json();
  },

  async createCategory(data: Partial<CategoryResponse>, token: string): Promise<CategoryResponse> {
    const response = await fetch(`${API_BASE}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create category');
    }
    return response.json();
  },

  async updateCategory(
    id: string,
    data: Partial<CategoryResponse>,
    token: string
  ): Promise<CategoryResponse> {
    const response = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update category');
    }
    return response.json();
  },

  async deleteCategory(id: string, token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete category');
    }
    return response.json();
  },
};
