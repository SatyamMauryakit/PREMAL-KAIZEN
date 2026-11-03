// Order Service Client
// Interfaces for order data and API communication

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  image: string;
}

export interface OrderAddress {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  street1: string;
  street2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  items: OrderItem[];
  shippingAddress: OrderAddress;
  shippingMethod: string;
  paymentMethod: 'card' | 'upi' | 'netbanking' | 'cod';
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
  notes?: string;
}

export interface OrderTimeline {
  status: OrderStatus;
  timestamp: string;
  description: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// The real API returns its own shape (status, userId, address, items with nested
// product) - this maps it onto the Order type the storefront pages expect
// (orderStatus, customerId, shippingAddress) instead of silently returning undefined
// fields for every real order.
function normalizeOrder(raw: any): Order {
  return {
    ...raw,
    customerId: raw.userId,
    orderStatus: raw.status,
    shippingAddress: raw.address || raw.shippingAddress,
    items: (raw.items || []).map((item: any) => ({
      ...item,
      name: item.name || item.product?.name || 'Product',
      image: item.image || item.product?.images?.[0]?.url || '',
    })),
  };
}

export const orderService = {
  // Get customer's order history
  async getOrders(token: string, page = 1, limit = 10) {
    try {
      const response = await fetch(`${API_BASE}/api/orders?page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return { orders: (data.data || []).map(normalizeOrder), total: data.total ?? 0, page: data.page ?? page, limit: data.pageSize ?? limit };
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to fetch orders');
    }
  },

  // Get single order details
  async getOrder(orderId: string, token: string) {
    const response = await fetch(`${API_BASE}/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Order not found');
    const data = await response.json();
    return normalizeOrder(data);
  },

  // Guest order tracking - verified server-side by requiring the exact email on
  // the order, no login required.
  async trackGuestOrder(orderNumber: string, email: string): Promise<Order> {
    const response = await fetch(
      `${API_BASE}/api/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || 'Order not found. Please check your order number and email.');
    }
    const data = await response.json();
    return normalizeOrder(data);
  },

  // Order tracking timeline, built from the order's real recorded status and
  // timestamps only - no invented intermediate tracking events or delivery dates,
  // since this store has no real courier/tracking integration.
  async getOrderTimeline(orderId: string, token: string): Promise<OrderTimeline[]> {
    const order = await this.getOrder(orderId, token);
    if (!order) return [];
    return generateTimeline(order);
  },

  // For callers (like guest tracking) that already have the order object in hand.
  timelineForOrder(order: Order): OrderTimeline[] {
    return generateTimeline(order);
  },
};


const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: 'Order placed',
  confirmed: 'Order confirmed',
  processing: 'Order processing',
  packed: 'Order packed',
  shipped: 'Order shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
  returned: 'Order returned',
};

// Built only from the order's real recorded timestamps (createdAt, updatedAt) -
// this store has no real courier/tracking integration, so intermediate steps
// with invented timestamps are never fabricated here.
function generateTimeline(order: Order): OrderTimeline[] {
  const timeline: OrderTimeline[] = [
    { status: 'pending', timestamp: order.createdAt, description: STATUS_DESCRIPTIONS.pending },
  ];

  if (order.orderStatus !== 'pending') {
    timeline.push({
      status: order.orderStatus,
      timestamp: order.updatedAt,
      description: STATUS_DESCRIPTIONS[order.orderStatus] || order.orderStatus,
    });
  }

  return timeline;
}
