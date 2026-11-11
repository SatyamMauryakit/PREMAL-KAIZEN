const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface Review {
  id: string;
  rating: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  reviewerName: string;
  verifiedPurchase: boolean;
}

export interface ReviewPage {
  data: Review[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RatingSummary {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ReviewEligibility {
  canReview: boolean;
  eligibleOrderItems: Array<{ orderItemId: string; orderNumber: string }>;
  hasPurchased: boolean;
  alreadyReviewed: boolean;
}

async function handleResponse<T>(response: Response, fallbackError: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || fallbackError);
  }
  return response.json();
}

export const reviewsService = {
  async getProductReviews(
    productId: string,
    opts: { page?: number; limit?: number; sort?: 'newest' | 'highest' | 'lowest' } = {},
  ): Promise<ReviewPage> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.sort) params.set('sort', opts.sort);
    const response = await fetch(`${API_BASE}/api/products/${productId}/reviews?${params}`);
    return handleResponse(response, 'Failed to load reviews');
  },

  async getRatingSummary(productId: string): Promise<RatingSummary> {
    const response = await fetch(`${API_BASE}/api/products/${productId}/reviews/summary`);
    return handleResponse(response, 'Failed to load rating summary');
  },

  async getEligibility(productId: string, token: string): Promise<ReviewEligibility> {
    const response = await fetch(`${API_BASE}/api/products/${productId}/reviews/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response, 'Failed to check review eligibility');
  },

  async submitReview(
    token: string,
    data: { productId: string; orderItemId: string; rating: number; title: string; description: string },
  ): Promise<Review> {
    const response = await fetch(`${API_BASE}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return handleResponse(response, 'Failed to submit review');
  },

  async reportReview(token: string, reviewId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/reviews/${reviewId}/report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response, 'Failed to report review');
  },
};
