// Pricing utilities for cart and checkout calculations

export interface PricingSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

// Format price as Indian Rupees
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format a PAISE amount (the unit the API returns for all order/totals fields) as
 * Indian Rupees. Use this for any value that came straight from the order API
 * (order.total, order.subtotal, order.shipping, order.tax, item.price). The cart and
 * product-card state, by contrast, stores RUPEES (converted at add-to-cart) and must
 * keep using `formatPrice`. Mixing the two is the root cause of the ₹1,700 → ₹170,000
 * display bug, so the unit is in the name on purpose.
 */
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((paise || 0) / 100);
}

// Calculate line total
export function calculateLineTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

// Calculate subtotal from items
export function calculateSubtotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

