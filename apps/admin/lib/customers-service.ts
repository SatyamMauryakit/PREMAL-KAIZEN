const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface Customer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  isActive: boolean;
  emailVerified?: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  totalSpent: number;
  completedOrders?: number;
}

export interface CustomerDetails extends Customer {
  addresses: Address[];
}

export interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  street1: string;
  street2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  createdAt: string;
  itemCount: number;
}

export interface CustomerResponse {
  data: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerStatistics {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  verifiedEmails: number;
  totalOrderValue: number;
  avgOrderValue: number;
}

export const adminCustomersService = {
  async getCustomers(
    token: string,
    page?: number,
    limit?: number,
    search?: string,
    status?: string
  ): Promise<CustomerResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const response = await fetch(`${API_BASE}/api/admin/customers?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch customers');
    return response.json();
  },

  async getCustomer(token: string, customerId: string): Promise<CustomerDetails> {
    const response = await fetch(`${API_BASE}/api/admin/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch customer');
    return response.json();
  },

  async getOrderHistory(
    token: string,
    customerId: string,
    page?: number,
    limit?: number,
    status?: string
  ): Promise<OrderResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (status) params.append('status', status);

    const response = await fetch(
      `${API_BASE}/api/admin/customers/${customerId}/orders?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) throw new Error('Failed to fetch order history');
    return response.json();
  },

  async getStatistics(token: string): Promise<CustomerStatistics> {
    const response = await fetch(`${API_BASE}/api/admin/customers/statistics`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch statistics');
    return response.json();
  },

  async setAccountStatus(
    token: string,
    customerId: string,
    isActive: boolean,
    reason?: string
  ): Promise<any> {
    const response = await fetch(`${API_BASE}/api/admin/customers/${customerId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive, reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update account status');
    }
    return response.json();
  },

  async exportCustomerData(token: string, customerId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/api/admin/customers/${customerId}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to export customer data');
    return response.json();
  },
};
