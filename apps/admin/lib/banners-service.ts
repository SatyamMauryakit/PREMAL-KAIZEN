const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export type BannerPlacement = 'hero' | 'strip' | 'sidebar';
export type BannerFontStyle = 'display' | 'sans';

export interface Banner {
  id: string;
  placement: BannerPlacement;
  imageUrl: string;
  mobileImageUrl: string | null;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  textColor: string | null;
  fontStyle: string | null;
  order: number;
  isActive: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BannerInput {
  placement: BannerPlacement;
  imageUrl: string;
  mobileImageUrl?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  ctaText?: string;
  ctaUrl?: string;
  textColor?: string;
  fontStyle?: BannerFontStyle | '';
  order?: number;
  isActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

async function handleResponse<T>(response: Response, fallbackError: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(Array.isArray(body?.message) ? body.message[0] : body?.message || fallbackError);
  }
  return response.json();
}

export const adminBannersService = {
  async list(token: string): Promise<Banner[]> {
    const response = await fetch(`${API_BASE}/api/admin/banners`, { headers: { Authorization: `Bearer ${token}` } });
    return handleResponse(response, 'Failed to load banners');
  },

  async create(token: string, input: BannerInput): Promise<Banner> {
    const response = await fetch(`${API_BASE}/api/admin/banners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    return handleResponse(response, 'Failed to create banner');
  },

  async update(token: string, id: string, input: Partial<BannerInput>): Promise<Banner> {
    const response = await fetch(`${API_BASE}/api/admin/banners/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    return handleResponse(response, 'Failed to update banner');
  },

  async remove(token: string, id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/admin/banners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response, 'Failed to delete banner');
  },

  async reorder(token: string, ids: string[]): Promise<Banner[]> {
    const response = await fetch(`${API_BASE}/api/admin/banners/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
    return handleResponse(response, 'Failed to reorder banners');
  },
};
