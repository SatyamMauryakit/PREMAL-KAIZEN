const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface Banner {
  id: string;
  placement: 'hero' | 'strip' | 'sidebar';
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
}

export const bannersService = {
  async getActive(): Promise<Banner[]> {
    try {
      const response = await fetch(`${API_BASE}/api/banners`, { cache: 'no-store' });
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  },
};
