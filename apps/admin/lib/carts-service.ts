const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface CartListRow {
  userId: string;
  customerEmail: string | null;
  customerName: string | null;
  itemCount: number;
  distinctProducts: number;
  subtotal: number; // paise
  lastUpdated: string | null;
}

export interface CartListResponse {
  data: CartListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CartLineItem {
  id: string;
  productId: string;
  name: string;
  image: string | null;
  price: number; // paise
  quantity: number;
  selectedSize: string | null;
  selectedColor: string | null;
  lineTotal: number; // paise
}

export interface CartDetails {
  items: CartLineItem[];
  itemCount: number;
  subtotal: number; // paise
  lastUpdated: string | null;
}

export const adminCartsService = {
  /** List of customers with a non-empty persisted cart (Section 3: admin cart visibility). */
  async getCarts(token: string, page?: number, limit?: number, search?: string): Promise<CartListResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);

    const response = await fetch(`${API_BASE}/api/admin/carts?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch carts');
    return response.json();
  },

  /** Read-only detail view of one customer's current cart. */
  async getCustomerCart(token: string, customerId: string): Promise<CartDetails> {
    const response = await fetch(`${API_BASE}/api/admin/customers/${customerId}/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch customer cart');
    return response.json();
  },
};
