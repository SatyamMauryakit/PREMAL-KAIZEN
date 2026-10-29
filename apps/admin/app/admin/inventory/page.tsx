'use client';

import { Header } from '@/components/Header';

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Inventory" subtitle="Monitor stock levels and manage warehouse operations." />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Total SKUs</h3>
            <p className="text-3xl font-bold text-black">147</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">In Stock</h3>
            <p className="text-3xl font-bold text-green-600">1,245</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Low Stock</h3>
            <p className="text-3xl font-bold text-yellow-600">23</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Out of Stock</h3>
            <p className="text-3xl font-bold text-red-600">5</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-light p-6">
          <h2 className="text-lg font-bold text-black mb-4">Low Stock Alert</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-gray-light">
              <div>
                <p className="text-sm font-medium text-black">Quilted Bomber Jacket</p>
                <p className="text-xs text-gray-medium">SKU: QBJ-001</p>
              </div>
              <p className="text-lg font-bold text-yellow-600">12 units</p>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-light">
              <div>
                <p className="text-sm font-medium text-black">Wool Knit Beanie</p>
                <p className="text-xs text-gray-medium">SKU: WKB-001</p>
              </div>
              <p className="text-lg font-bold text-red-600">0 units</p>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming Soon:</strong> Inventory tracking, stock movements, and warehouse management will be available in Phase 6.
          </p>
        </div>
      </div>
    </div>
  );
}
