export interface DashboardMetrics {
  orderCount: number;
  grossSales: number;
  discountsApplied: number;
  refundTotals: number;
  netRevenue: number;
  averageOrderValue: number;
  unitsSold: number;
  newCustomers: number;
  lowStockCount: number;
  outOfStockCount: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  comparison?: {
    orderCountChange: number;
    grossSalesChange: number;
    netRevenueChange: number;
  };
}

export interface SalesData {
  date: string;
  orders: number;
  sales: number;
  units: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  unitsSold: number;
  salesValue: number;
  orderCount: number;
  averagePrice: number;
}

export interface OrderStatusDistribution {
  status: string;
  count: number;
}

export interface PromotionPerformance {
  promotionId: string;
  count: number;
  totalDiscount: number;
}

class AnalyticsService {
  private apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async getDashboardMetrics(token: string, startDate: Date, endDate: Date): Promise<DashboardMetrics> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });

    const response = await fetch(`${this.apiBase}/api/admin/analytics/dashboard?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch dashboard metrics');
    return response.json();
  }

  async getSalesTrend(
    token: string,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<SalesData[]> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      interval,
    });

    const response = await fetch(`${this.apiBase}/api/admin/analytics/sales-trend?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch sales trend');
    return response.json();
  }

  async getProductPerformance(
    token: string,
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<ProductPerformance[]> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      limit: limit.toString(),
    });

    const response = await fetch(`${this.apiBase}/api/admin/analytics/product-performance?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch product performance');
    return response.json();
  }

  async getOrderStatusDistribution(
    token: string,
    startDate: Date,
    endDate: Date
  ): Promise<OrderStatusDistribution[]> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });

    const response = await fetch(`${this.apiBase}/api/admin/analytics/order-status-distribution?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch order status distribution');
    return response.json();
  }

  async getPromotionPerformance(
    token: string,
    startDate: Date,
    endDate: Date
  ): Promise<PromotionPerformance[]> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });

    const response = await fetch(`${this.apiBase}/api/admin/analytics/promotion-performance?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch promotion performance');
    return response.json();
  }
}

export const adminAnalyticsService = new AnalyticsService();
