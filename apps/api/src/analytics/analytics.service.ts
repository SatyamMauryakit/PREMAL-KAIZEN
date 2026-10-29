import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

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
  dateRange: DateRange;
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

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get dashboard metrics for a date range
   */
  async getDashboardMetrics(startDate: Date, endDate: Date): Promise<DashboardMetrics> {
    // Validate date range
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Get all orders in date range
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
      },
    });

    // Filter for completed/valid orders (exclude cancelled)
    const validOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.paymentStatus === 'completed'
    );

    // Calculate metrics
    const orderCount = validOrders.length;
    const grossSales = validOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const discountsApplied = validOrders.reduce((sum, o) => sum + o.discount, 0);
    const refundTotals = orders
      .filter((o) => o.paymentStatus === 'refunded')
      .reduce((sum, o) => sum + o.total, 0);
    const netRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
    const averageOrderValue = orderCount > 0 ? Math.round(netRevenue / orderCount) : 0;
    const unitsSold = validOrders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );

    // Get new customers in date range
    const newCustomers = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get low and out of stock counts (items where onHand <= reorderThreshold and onHand > 0)
    const inventories = await this.prisma.inventory.findMany({
      where: { onHand: { gt: 0 } },
      select: { onHand: true, reorderThreshold: true },
    });
    const lowStockCount = inventories.filter(
      (inv) => inv.onHand <= inv.reorderThreshold
    ).length;

    const outOfStockCount = await this.prisma.inventory.count({
      where: { onHand: { lte: 0 } },
    });

    // Calculate comparison with previous period
    const previousPeriodLength = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const previousStartDate = new Date(
      startDate.getTime() - previousPeriodLength * 24 * 60 * 60 * 1000
    );
    const previousOrders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
      include: { items: true },
    });

    const previousValidOrders = previousOrders.filter(
      (o) => o.status !== 'cancelled' && o.paymentStatus === 'completed'
    );
    const previousOrderCount = previousValidOrders.length;
    const previousGrossSales = previousValidOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const previousNetRevenue = previousValidOrders.reduce((sum, o) => sum + o.total, 0);

    return {
      orderCount,
      grossSales,
      discountsApplied,
      refundTotals,
      netRevenue,
      averageOrderValue,
      unitsSold,
      newCustomers,
      lowStockCount,
      outOfStockCount,
      dateRange: { startDate, endDate },
      comparison: {
        orderCountChange: orderCount - previousOrderCount,
        grossSalesChange: grossSales - previousGrossSales,
        netRevenueChange: netRevenue - previousNetRevenue,
      },
    };
  }

  /**
   * Get daily sales trend
   */
  async getSalesTrend(startDate: Date, endDate: Date, interval: 'day' | 'week' | 'month' = 'day'): Promise<SalesData[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        paymentStatus: 'completed',
      },
      include: { items: true },
    });

    // Group by interval
    const grouped = new Map<string, { orders: number; sales: number; units: number }>();

    for (const order of orders) {
      if (order.status === 'cancelled') continue;

      const date = this.getDateBucket(order.createdAt, interval);
      const existing = grouped.get(date) || { orders: 0, sales: 0, units: 0 };

      existing.orders += 1;
      existing.sales += order.total;
      existing.units += order.items.reduce((sum, item) => sum + item.quantity, 0);

      grouped.set(date, existing);
    }

    // Convert to array and fill gaps
    const data = Array.from(grouped.entries()).map(([date, metrics]) => ({
      date,
      ...metrics,
    }));

    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Get product performance
   */
  async getProductPerformance(
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<ProductPerformance[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'cancelled' },
        paymentStatus: 'completed',
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    // Aggregate by product
    const productMap = new Map<
      string,
      {
        productName: string;
        unitsSold: number;
        salesValue: number;
        orderCount: number;
        totalPrice: number;
        priceCount: number;
      }
    >();

    for (const order of orders) {
      for (const item of order.items) {
        const productId = item.productId;
        const existing = productMap.get(productId) || {
          productName: item.product?.name || 'Unknown',
          unitsSold: 0,
          salesValue: 0,
          orderCount: 0,
          totalPrice: 0,
          priceCount: 0,
        };

        existing.unitsSold += item.quantity;
        existing.salesValue += item.price * item.quantity;
        existing.orderCount += 1;
        existing.totalPrice += item.price;
        existing.priceCount += 1;

        productMap.set(productId, existing);
      }
    }

    // Convert to array and sort by sales value
    const performance = Array.from(productMap.entries())
      .map(([productId, metrics]) => ({
        productId,
        productName: metrics.productName,
        unitsSold: metrics.unitsSold,
        salesValue: metrics.salesValue,
        orderCount: metrics.orderCount,
        averagePrice: Math.round(metrics.totalPrice / metrics.priceCount),
      }))
      .sort((a, b) => b.salesValue - a.salesValue)
      .slice(0, limit);

    return performance;
  }

  /**
   * Get order status distribution
   */
  async getOrderStatusDistribution(startDate: Date, endDate: Date) {
    const distribution = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
    });

    return distribution.map((d) => ({
      status: d.status,
      count: d._count,
    }));
  }

  /**
   * Get promotion performance
   */
  async getPromotionPerformance(startDate: Date, endDate: Date) {
    const promotions = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        promotionId: { not: null },
        paymentStatus: 'completed',
      },
      select: {
        promotionId: true,
        discount: true,
      },
    });

    const promotionMap = new Map<string, { count: number; totalDiscount: number }>();

    for (const order of promotions) {
      if (!order.promotionId) continue;
      const existing = promotionMap.get(order.promotionId) || { count: 0, totalDiscount: 0 };
      existing.count += 1;
      existing.totalDiscount += order.discount;
      promotionMap.set(order.promotionId, existing);
    }

    return Array.from(promotionMap.entries()).map(([promotionId, metrics]) => ({
      promotionId,
      ...metrics,
    }));
  }

  /**
   * Helper: Get date bucket for grouping
   */
  private getDateBucket(date: Date, interval: 'day' | 'week' | 'month'): string {
    const d = new Date(date);

    if (interval === 'day') {
      return d.toISOString().split('T')[0];
    } else if (interval === 'week') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split('T')[0];
    } else if (interval === 'month') {
      return d.toISOString().substring(0, 7);
    }

    return d.toISOString().split('T')[0];
  }
}
