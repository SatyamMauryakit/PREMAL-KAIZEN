const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface AdminReview {
  id: string;
  rating: number;
  title: string;
  description: string;
  status: string;
  reportCount: number;
  moderatedBy: string | null;
  moderatedAt: string | null;
  moderationNote: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  orderItem: { id: string; order: { id: string; orderNumber: string } };
}

export interface AdminReviewPage {
  data: AdminReview[];
  total: number;
  page: number;
  pageSize: number;
}

async function handleResponse<T>(response: Response, fallbackError: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || fallbackError);
  }
  return response.json();
}

export const adminReviewsService = {
  async list(
    token: string,
    filters: { status?: string; productId?: string; page?: number; limit?: number } = {},
  ): Promise<AdminReviewPage> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.productId) params.set('productId', filters.productId);
    params.set('page', String(filters.page ?? 1));
    params.set('limit', String(filters.limit ?? 20));

    const response = await fetch(`${API_BASE}/api/admin/reviews?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response, 'Failed to load reviews');
  },

  async moderate(
    token: string,
    reviewId: string,
    status: 'approved' | 'rejected',
    moderationNote?: string,
  ): Promise<AdminReview> {
    const response = await fetch(`${API_BASE}/api/admin/reviews/${reviewId}/moderate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, moderationNote }),
    });
    return handleResponse(response, 'Failed to moderate review');
  },

  async remove(token: string, reviewId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/admin/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response, 'Failed to remove review');
  },
};
