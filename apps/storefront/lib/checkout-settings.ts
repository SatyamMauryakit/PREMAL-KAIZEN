// Real, admin-configured checkout settings (shipping methods, GST rate, payment
// gateway availability) - fetched from the public endpoint so the storefront never
// has to hardcode or guess values the business controls.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface ShippingMethodOption {
  id: string;
  name: string;
  description?: string;
  price: number; // in paise
  freeShippingThreshold?: number; // in paise
  estimatedDays?: number;
  enabled: boolean;
}

export interface CheckoutSettings {
  shippingMethods: ShippingMethodOption[];
  taxRate: number; // percentage
  taxMode: 'inclusive' | 'exclusive';
  razorpayEnabled: boolean;
  codEnabled: boolean;
  guestCheckoutEnabled: boolean;
  minimumOrderValue: number;
  maintenanceMode: boolean;
}

let cached: CheckoutSettings | null = null;

export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/api/storefront/settings/checkout`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load checkout settings');
  }

  const data = await response.json();
  cached = data;
  return data;
}

export function calculateTax(taxableAmount: number, settings: CheckoutSettings): number {
  if (!settings.taxRate) return 0;
  return settings.taxMode === 'inclusive'
    ? Math.round((taxableAmount * settings.taxRate) / (100 + settings.taxRate))
    : Math.round((taxableAmount * settings.taxRate) / 100);
}

export function calculateShipping(subtotal: number, method: ShippingMethodOption | undefined): number {
  if (!method) return 0;
  if (method.freeShippingThreshold && subtotal >= method.freeShippingThreshold) return 0;
  return method.price;
}
