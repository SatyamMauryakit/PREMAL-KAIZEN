// Real, admin-configured store contact info - never a hardcoded guess.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface StoreContactInfo {
  storeName: string;
  storeEmail: string;
  storePhone: string;
}

let cached: StoreContactInfo | null = null;

export async function getStoreContactInfo(): Promise<StoreContactInfo> {
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/api/storefront/settings/contact`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load store contact info');
  }

  const data = await response.json();
  cached = data;
  return data;
}
