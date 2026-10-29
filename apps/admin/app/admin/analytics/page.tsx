'use client';

import { Header } from '@/components/Header';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Analytics" subtitle="Analyze sales, traffic, and customer behavior." />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Total Revenue</h3>
            <p className="text-3xl font-bold text-black">₹2,45,000</p>
            <p className="text-xs text-green-600 mt-2">+12% from last month</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Average Order Value</h3>
            <p className="text-3xl font-bold text-black">₹10,470</p>
            <p className="text-xs text-gray-medium mt-2">Based on 234 orders</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Conversion Rate</h3>
            <p className="text-3xl font-bold text-black">3.2%</p>
            <p className="text-xs text-gray-medium mt-2">From 7,312 visitors</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Customer Retention</h3>
            <p className="text-3xl font-bold text-black">42%</p>
            <p className="text-xs text-gray-medium mt-2">Repeat customers</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-light p-6 mb-6">
          <h2 className="text-lg font-bold text-black mb-4">Sales Chart (Placeholder)</h2>
          <div className="h-64 bg-gray-light rounded flex items-center justify-center">
            <p className="text-gray-medium">Chart implementation coming in Phase 6</p>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming Soon:</strong> Interactive charts, detailed reports, and custom date ranges will be available in Phase 6.
          </p>
        </div>
      </div>
    </div>
  );
}
