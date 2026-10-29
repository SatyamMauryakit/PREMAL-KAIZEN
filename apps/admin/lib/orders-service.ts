const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface OrderItem {
  id: string;
  productId: string;
  product?: { name: string; sku: string };
  quantity: number;
  price: number;
  selectedSize?: string;
  selectedColor?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  user?: { email: string; firstName?: string; lastName?: string };
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'card' | 'upi' | 'netbanking' | 'cod';
  shippingMethod: 'standard' | 'express' | 'overnight';
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: string;
  notes?: string;
  internalNotes?: string;
  addressId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrdersListResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export const adminOrdersService = {
  async getOrders(
    token: string,
    page?: number,
    limit?: number,
    status?: string,
    paymentStatus?: string,
    search?: string
  ): Promise<OrdersListResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (status) params.append('status', status);
    if (paymentStatus) params.append('paymentStatus', paymentStatus);
    if (search) params.append('search', search);

    const response = await fetch(`${API_BASE}/api/orders?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch orders');
    return response.json();
  },

  async getOrder(id: string, token: string): Promise<Order> {
    const response = await fetch(`${API_BASE}/api/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Order not found');
    return response.json();
  },

  async updateStatus(id: string, status: string, token: string): Promise<Order> {
    const response = await fetch(`${API_BASE}/api/orders/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update order status');
    }
    return response.json();
  },

  async updatePaymentStatus(id: string, paymentStatus: string, token: string): Promise<Order> {
    const response = await fetch(`${API_BASE}/api/orders/${id}/payment-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ paymentStatus }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update payment status');
    }
    return response.json();
  },

  async updateShipping(
    id: string,
    data: { carrier?: string; trackingNumber?: string; estimatedDelivery?: string },
    token: string
  ): Promise<Order> {
    const response = await fetch(`${API_BASE}/api/orders/${id}/shipping`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update shipping');
    }
    return response.json();
  },

  async addNotes(id: string, notes: string, token: string): Promise<Order> {
    const response = await fetch(`${API_BASE}/api/orders/${id}/notes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add notes');
    }
    return response.json();
  },
};
