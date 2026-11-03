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

// Calculate line total
export function calculateLineTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

// Calculate subtotal from items
export function calculateSubtotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

