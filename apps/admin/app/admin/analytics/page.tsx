'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import { useState, useEffect } from 'react';
import { adminAnalyticsService, DashboardMetrics, SalesData, ProductPerformance, OrderStatusDistribution } from '@/lib/analytics-service';

export default function AnalyticsDashboard() {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesTrend, setSalesTrend] = useState<SalesData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([]);
  const [orderDistribution, setOrderDistribution] = useState<OrderStatusDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadAnalytics();
    }
  }, [startDate, endDate, interval]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const start = new Date(startDate);
      const end = new Date(endDate);

      const [metricsData, trendsData, productsData, distributionData] = await Promise.all([
        adminAnalyticsService.getDashboardMetrics(token, start, end),
        adminAnalyticsService.getSalesTrend(token, start, end, interval),
        adminAnalyticsService.getProductPerformance(token, start, end, 10),
        adminAnalyticsService.getOrderStatusDistribution(token, start, end),
      ]);

      setMetrics(metricsData);
      setSalesTrend(trendsData);
      setTopProducts(productsData);
      setOrderDistribution(distributionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  const formatChange = (change: number) => {
    if (change === 0) return 'No change';
    const sign = change > 0 ? '+' : '';
    const isPositive = change > 0;
    return (
      <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
        {sign}{change.toLocaleString()}
      </span>
    );
  };

  const getMaxSalesValue = () => {
    if (salesTrend.length === 0) return 100;
    return Math.max(...salesTrend.map(d => d.sales), 1);
  };

  const getMaxOrderValue = () => {
    if (orderDistribution.length === 0) return 10;
    return Math.max(...orderDistribution.map(d => d.count), 1);
  };

  return (
    <RequirePermission permission="analytics:view">
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Analytics Dashboard"
        subtitle={`${startDate} to ${endDate}`}
      />

      <div className="p-6 max-w-7xl">
        {/* Date Range Selector */}
        <div className="bg-white rounded-lg border border-gray-light p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-medium mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-light rounded text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-medium mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-light rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-medium mb-2">Interval</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value as 'day' | 'week' | 'month')}
                className="px-3 py-2 border border-gray-light rounded text-sm"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="text-center text-gray-medium py-12">Loading analytics...</div>
        )}

        {!isLoading && metrics && (
          <>
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {/* Order Count */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">Order Count</p>
                <p className="text-2xl font-bold text-black">{metrics.orderCount}</p>
                {metrics.comparison && (
                  <p className="text-xs mt-2">
                    vs last period: {formatChange(metrics.comparison.orderCountChange)}
                  </p>
                )}
              </div>

              {/* Gross Sales */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">Gross Sales</p>
                <p className="text-2xl font-bold text-black">{formatPrice(metrics.grossSales)}</p>
                {metrics.comparison && (
                  <p className="text-xs mt-2">
                    vs last period: {formatChange(Math.floor(metrics.comparison.grossSalesChange / 100))}
                  </p>
                )}
              </div>

              {/* Net Revenue */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">Net Revenue</p>
                <p className="text-2xl font-bold text-black">{formatPrice(metrics.netRevenue)}</p>
                {metrics.comparison && (
                  <p className="text-xs mt-2">
                    vs last period: {formatChange(Math.floor(metrics.comparison.netRevenueChange / 100))}
                  </p>
                )}
              </div>

              {/* Discounts Applied */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">Discounts Applied</p>
                <p className="text-2xl font-bold text-black">{formatPrice(metrics.discountsApplied)}</p>
                <p className="text-xs text-gray-dark mt-2">{metrics.grossSales > 0 ? Math.round((metrics.discountsApplied / metrics.grossSales) * 100) : 0}% of sales</p>
              </div>

              {/* Avg Order Value */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">Avg Order Value</p>
                <p className="text-2xl font-bold text-black">{formatPrice(metrics.averageOrderValue)}</p>
                <p className="text-xs text-gray-dark mt-2">{metrics.unitsSold} units sold</p>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Refund Totals */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">Refund Totals</p>
                <p className="text-xl font-bold text-red-600">{formatPrice(metrics.refundTotals)}</p>
              </div>

              {/* New Customers */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">New Customers</p>
                <p className="text-xl font-bold text-blue-600">{metrics.newCustomers}</p>
              </div>

              {/* Low Stock */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">Low Stock Items</p>
                <p className="text-xl font-bold text-yellow-600">{metrics.lowStockCount}</p>
              </div>

              {/* Out of Stock */}
              <div className="bg-white rounded-lg border border-gray-light p-4">
                <p className="text-xs text-gray-medium mb-1">Out of Stock</p>
                <p className="text-xl font-bold text-red-600">{metrics.outOfStockCount}</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Sales Trend Chart */}
              <div className="bg-white rounded-lg border border-gray-light p-6">
                <h3 className="text-lg font-semibold text-black mb-4">Sales Trend</h3>
                {salesTrend.length === 0 ? (
                  <p className="text-sm text-gray-medium">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {salesTrend.slice(0, 10).map((data) => {
                      const percentage = (data.sales / getMaxSalesValue()) * 100;
                      return (
                        <div key={data.date}>
                          <div className="flex justify-between mb-1">
                            <p className="text-xs text-gray-dark">{data.date}</p>
                            <p className="text-xs font-medium text-black">{formatPrice(data.sales)}</p>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-black h-2 rounded-full"
                              style={{ width: `${Math.max(percentage, 5)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-medium mt-1">{data.orders} orders • {data.units} units</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order Status Distribution */}
              <div className="bg-white rounded-lg border border-gray-light p-6">
                <h3 className="text-lg font-semibold text-black mb-4">Order Status Distribution</h3>
                {orderDistribution.length === 0 ? (
                  <p className="text-sm text-gray-medium">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {orderDistribution.map((status) => {
                      const percentage = (status.count / getMaxOrderValue()) * 100;
                      const statusColors: Record<string, string> = {
                        'pending': 'bg-yellow-400',
                        'confirmed': 'bg-blue-400',
                        'shipped': 'bg-purple-400',
                        'delivered': 'bg-green-400',
                        'cancelled': 'bg-red-400',
                      };
                      const color = statusColors[status.status] || 'bg-gray-400';

                      return (
                        <div key={status.status}>
                          <div className="flex justify-between mb-1">
                            <p className="text-xs font-medium text-gray-dark capitalize">{status.status}</p>
                            <p className="text-xs font-medium text-black">{status.count}</p>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className={`${color} h-2 rounded-full`}
                              style={{ width: `${Math.max(percentage, 5)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="text-lg font-semibold text-black mb-4">Top Products by Revenue</h3>
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-medium">No data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-light">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-medium">Product</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-medium">Units</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-medium">Revenue</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-medium">Avg Price</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-medium">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((product, idx) => (
                        <tr key={idx} className="border-b border-gray-light hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <p className="font-medium text-black">{product.productName}</p>
                            <p className="text-xs text-gray-medium">{product.productId}</p>
                          </td>
                          <td className="text-right py-3 px-4 text-black">{product.unitsSold}</td>
                          <td className="text-right py-3 px-4 font-medium text-black">{formatPrice(product.salesValue)}</td>
                          <td className="text-right py-3 px-4 text-black">{formatPrice(product.averagePrice)}</td>
                          <td className="text-right py-3 px-4 text-black">{product.orderCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </RequirePermission>
  );
}
