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

// Calculate tax (placeholder - returns 0 for now, will be calculated on backend)
export function calculateTax(subtotal: number): number {
  // TODO: Tax will be calculated on backend based on customer location
  // For now, reference image shows 10% tax example: subtotal 28000 + tax 2800 = 30800
  // Keeping as 0 for client-side calculation until backend integration
  return 0;
}

// Calculate shipping (placeholder)
export function calculateShipping(subtotal: number): number {
  // Reference shows "FREE" shipping
  // TODO: Implement shipping calculation based on cart value and address
  return 0;
}

// Get full pricing summary
export function getPricingSummary(
  subtotal: number,
  options: {
    includeShipping?: boolean;
    includeTax?: boolean;
  } = {}
): PricingSummary {
  const shipping = options.includeShipping ? calculateShipping(subtotal) : 0;
  const tax = options.includeTax ? calculateTax(subtotal) : 0;
  const total = subtotal + shipping + tax;

  return {
    subtotal,
    shipping,
    tax,
    total,
  };
}

// Format pricing summary
export interface FormattedPricingSummary {
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
}

export function formatPricingSummary(summary: PricingSummary): FormattedPricingSummary {
  return {
    subtotal: formatPrice(summary.subtotal),
    shipping: summary.shipping === 0 ? 'FREE' : formatPrice(summary.shipping),
    tax: formatPrice(summary.tax),
    total: formatPrice(summary.total),
  };
}
