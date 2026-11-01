const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value?: number;
  maxDiscount?: number;
  minSubtotal?: number;
  firstOrderOnly: boolean;
  eligibleProductIds: string[];
  eligibleCategoryIds: string[];
  excludedProductIds: string[];
  excludedCategoryIds: string[];
  startDate?: string;
  expiryDate?: string;
  isActive: boolean;
  totalUsageLimit?: number;
  usageCount: number;
  perCustomerLimit?: number;
  code?: string;
  isArchived: boolean;
  status: string;
  remainingUsage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionResponse {
  data: Promotion[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CouponCode {
  id: string;
  code: string;
  promotionId: string;
  usageLimit?: number;
  usageCount: number;
  perCustomerLimit?: number;
  isActive: boolean;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export const adminPromotionsService = {
  async getPromotions(
    token: string,
    page?: number,
    limit?: number,
    search?: string,
    status?: string
  ): Promise<PromotionResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const response = await fetch(`${API_BASE}/api/promotions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch promotions');
    return response.json();
  },

  async getPromotion(token: string, id: string): Promise<Promotion> {
    const response = await fetch(`${API_BASE}/api/promotions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch promotion');
    return response.json();
  },

  async createPromotion(token: string, data: any): Promise<Promotion> {
    const response = await fetch(`${API_BASE}/api/promotions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create promotion');
    }
    return response.json();
  },

  async updatePromotion(token: string, id: string, data: any): Promise<Promotion> {
    const response = await fetch(`${API_BASE}/api/promotions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update promotion');
    }
    return response.json();
  },

  async togglePromotion(token: string, id: string, isActive: boolean): Promise<Promotion> {
    const response = await fetch(`${API_BASE}/api/promotions/${id}/toggle`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to toggle promotion');
    }
    return response.json();
  },

  async createCouponCodes(
    token: string,
    promotionId: string,
    count?: number,
    options?: {
      usageLimit?: number;
      expiryDate?: string;
      description?: string;
    }
  ) {
    const response = await fetch(`${API_BASE}/api/promotions/${promotionId}/coupons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        count: count || 1,
        ...options,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create coupon codes');
    }
    return response.json();
  },

  async getStats(token: string): Promise<{
    totalVouchers: number;
    active: number;
    scheduled: number;
    expired: number;
    disabled: number;
    totalRedemptions: number;
    totalDiscountGranted: number;
  }> {
    const response = await fetch(`${API_BASE}/api/promotions/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch voucher stats');
    return response.json();
  },

  async deletePromotion(token: string, id: string): Promise<{ success: boolean; archived: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/promotions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete promotion');
    }
    return response.json();
  },

  async validateCoupon(
    token: string,
    couponCode: string,
    userId: string,
    cartItems: any[],
    subtotal: number
  ) {
    const response = await fetch(`${API_BASE}/api/promotions/validate-coupon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        couponCode,
        userId,
        cartItems,
        subtotal,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Coupon validation failed');
    }
    return response.json();
  },
};
