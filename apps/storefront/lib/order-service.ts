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
  shippingMethod: 'standard' | 'express' | 'overnight';
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

export const orderService = {
  // Get customer's order history
  async getOrders(token: string, page = 1, limit = 10) {
    try {
      const response = await fetch(`${API_BASE}/api/orders?page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      return await response.json();
    } catch {
      // Fallback: return mock data for development
      return { orders: mockOrders, total: mockOrders.length, page, limit };
    }
  },

  // Get single order details
  async getOrder(orderId: string, token: string) {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Order not found');
      return await response.json();
    } catch {
      // Fallback: return mock order
      return mockOrders.find(o => o.id === orderId) || null;
    }
  },

  // Get order tracking timeline
  async getOrderTimeline(orderId: string, token: string): Promise<OrderTimeline[]> {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Timeline not available');
      return await response.json();
    } catch {
      // Fallback: generate timeline from order status
      const order = mockOrders.find(o => o.id === orderId);
      if (!order) return [];
      return generateTimeline(order);
    }
  },
};

// Mock data for development
const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'PK-2024-001',
    customerId: 'user-1',
    items: [
      { productId: '1', name: 'Oversized Hoodie', price: 599, quantity: 1, selectedSize: 'M', selectedColor: 'black', image: 'data:image/svg+xml,%3Csvg viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23333%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E' }
    ],
    shippingAddress: { firstName: 'John', lastName: 'Doe', phoneNumber: '98765 43210', street1: '123 Main St', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' },
    shippingMethod: 'standard',
    paymentMethod: 'card',
    orderStatus: 'delivered',
    paymentStatus: 'completed',
    subtotal: 599,
    shipping: 0,
    tax: 108,
    total: 707,
    trackingNumber: 'TRK123456',
    carrier: 'Express',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function generateTimeline(order: Order): OrderTimeline[] {
  const timeline: OrderTimeline[] = [];
  const createdDate = new Date(order.createdAt);

  timeline.push({ status: 'pending', timestamp: order.createdAt, description: 'Order placed' });

  if (['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) {
    timeline.push({ status: 'confirmed', timestamp: new Date(createdDate.getTime() + 2 * 60 * 60 * 1000).toISOString(), description: 'Order confirmed' });
  }

  if (['processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) {
    timeline.push({ status: 'processing', timestamp: new Date(createdDate.getTime() + 24 * 60 * 60 * 1000).toISOString(), description: 'Order processing' });
  }

  if (['packed', 'shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) {
    timeline.push({ status: 'packed', timestamp: new Date(createdDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), description: 'Order packed' });
  }

  if (['shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) {
    timeline.push({ status: 'shipped', timestamp: new Date(createdDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), description: 'Order shipped' });
  }

  if (['out_for_delivery', 'delivered'].includes(order.orderStatus)) {
    timeline.push({ status: 'out_for_delivery', timestamp: new Date(createdDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), description: 'Out for delivery' });
  }

  if (order.orderStatus === 'delivered') {
    timeline.push({ status: 'delivered', timestamp: order.updatedAt, description: 'Delivered' });
  }

  return timeline;
}
