const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  originalPrice: number | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  colors: string[];
  sizes: string[];
  categoryId: string | null;
  category?: { id: string; name: string; slug: string };
  images: Array<{ id?: string; url: string; alt?: string; order?: number }>;
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

export interface UploadedImage {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export const adminUploadsService = {
  async uploadImage(file: File, token: string): Promise<UploadedImage> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/api/uploads/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to upload image');
    }

    return response.json();
  },
};

export const adminProductsService = {
  async getProducts(
    token: string,
    page?: number,
    limit?: number,
    search?: string,
    category?: string,
    status?: 'active' | 'inactive' | 'out_of_stock' | 'all'
  ): Promise<ProductsListResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    params.append('status', status || 'all');

    // Admin-only endpoint: shows products of every status by default, unlike the
    // public /api/products (which always hides disabled products) - otherwise
    // disabling a product from this panel made it look deleted here too.
    const response = await fetch(`${API_BASE}/api/products/admin?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  },

  async getProduct(id: string, token: string): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE}/api/products/${id}/full`, {
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

  /**
   * Soft-deletes the product (hidden from the storefront and the normal admin
   * list, but recoverable) - never a hard delete. See getDeletedProducts/
   * restoreProduct/permanentlyDeleteProduct below for the rest of the lifecycle.
   */
  async deleteProduct(id: string, token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to delete product');
    return response.json();
  },

  /** "Deleted Products" admin view - the only place a soft-deleted product is ever listed. */
  async getDeletedProducts(
    token: string,
    page?: number,
    limit?: number,
    search?: string
  ): Promise<ProductsListResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);

    const response = await fetch(`${API_BASE}/api/products/admin/deleted?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch deleted products');
    return response.json();
  },

  /** Undoes a soft delete. Comes back as a disabled draft - does not auto re-activate it. */
  async restoreProduct(id: string, token: string): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE}/api/products/${id}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to restore product');
    }
    return response.json();
  },

  /**
   * Permanently removes the row. Only succeeds for an already-deleted product
   * with no historical orders referencing it - surfaces the backend's specific
   * refusal message (e.g. order-history dependency) rather than a generic one.
   */
  async permanentlyDeleteProduct(id: string, token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/products/${id}/permanent`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to permanently delete product');
    }
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
