'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminInventoryService, InventoryItem, LowStockResponse } from '@/lib/inventory-service';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStockData, setLowStockData] = useState<LowStockResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, [page, search, status]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      // Load main inventory
      const result = await adminInventoryService.getInventory(token, page, 20, search, status || undefined);
      setInventory(result.data);
      setTotal(result.total);

      // Load low stock alerts
      const lowStock = await adminInventoryService.getLowStockItems(token);
      setLowStockData(lowStock);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
      setInventory([]);
      setLowStockData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'bg-green-100 text-green-700';
      case 'low_stock':
        return 'bg-yellow-100 text-yellow-700';
      case 'out_of_stock':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <RequirePermission permission="inventory:manage">
    <div className="min-h-screen bg-gray-light">
      <Header title="Inventory" subtitle="Monitor stock levels and manage warehouse operations." />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Total SKUs</h3>
            <p className="text-3xl font-bold text-black">{isLoading ? '-' : total}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">In Stock</h3>
            <p className="text-3xl font-bold text-green-600">
              {isLoading ? '-' : inventory.filter(i => i.status === 'in_stock').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Low Stock</h3>
            <p className="text-3xl font-bold text-yellow-600">
              {isLoading ? '-' : lowStockData?.totalLow || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-light p-6">
            <h3 className="text-sm text-gray-medium font-medium mb-2">Out of Stock</h3>
            <p className="text-3xl font-bold text-red-600">
              {isLoading ? '-' : lowStockData?.totalOut || 0}
            </p>
          </div>
        </div>

        {/* Low Stock Alerts */}
        {lowStockData && (lowStockData.lowStock.length > 0 || lowStockData.outOfStock.length > 0) && (
          <div className="bg-white rounded-lg border border-gray-light p-6 mb-6">
            <h2 className="text-lg font-bold text-black mb-4">⚠️ Stock Alerts</h2>
            <div className="space-y-3">
              {lowStockData.lowStock.map((item) => (
                <div key={item.id} className="flex justify-between items-center pb-3 border-b border-gray-light">
                  <div>
                    <p className="text-sm font-medium text-black">{item.product.name}</p>
                    <p className="text-xs text-gray-medium">
                      SKU: {item.product.sku}
                      {item.size && ` • Size: ${item.size}`}
                      {item.color && ` • Color: ${item.color}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-yellow-600">{item.onHand} units</p>
                    <p className="text-xs text-gray-medium">Threshold: {item.reorderThreshold}</p>
                  </div>
                </div>
              ))}
              {lowStockData.outOfStock.map((item) => (
                <div key={item.id} className="flex justify-between items-center pb-3 border-b border-gray-light">
                  <div>
                    <p className="text-sm font-medium text-black">{item.product.name}</p>
                    <p className="text-xs text-gray-medium">
                      SKU: {item.product.sku}
                      {item.size && ` • Size: ${item.size}`}
                      {item.color && ` • Color: ${item.color}`}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-red-600">OUT OF STOCK</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory Table */}
        <div className="bg-white rounded-lg border border-gray-light">
          {/* Filters */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center gap-4 flex-col md:flex-row">
            <div className="flex gap-3 flex-1 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search by product name or SKU..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black flex-1"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
              >
                <option value="">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
            <Link
              href="/admin/inventory/history"
              className="px-4 py-2 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors text-sm"
            >
              History
            </Link>
          </div>

          {/* Inventory Table */}
          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading inventory...</div>
          ) : inventory.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">No inventory items found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-light bg-gray-light">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Variant</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">On Hand</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Reserved</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Available</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Sold</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id} className="border-b border-gray-light hover:bg-gray-light">
                      <td className="px-6 py-4 text-sm font-medium text-black">{item.product.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">{item.product.sku}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">
                        {item.size || item.color ? (
                          <>
                            {item.size && <span>{item.size}</span>}
                            {item.size && item.color && <span> / </span>}
                            {item.color && <span>{item.color}</span>}
                          </>
                        ) : (
                          <span className="text-gray-medium">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-black">{item.onHand}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">{item.reserved}</td>
                      <td className="px-6 py-4 text-sm font-medium text-black">{item.available}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">{item.sold}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(item.status)}`}>
                          {formatStatus(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <Link
                          href={{
                            pathname: `/admin/inventory/adjust/${item.productId}`,
                            query: {
                              size: item.size || '',
                              color: item.color || '',
                              name: item.product.name,
                              sku: item.product.sku,
                              onHand: item.onHand,
                            },
                          }}
                          className="text-black hover:text-gray-dark font-medium"
                        >
                          Adjust
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && inventory.length > 0 && (
            <div className="p-6 border-t border-gray-light flex justify-between items-center">
              <p className="text-sm text-gray-medium">
                Showing {inventory.length} of {total} SKUs
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button className="px-4 py-2 border border-black text-black rounded text-sm">
                  {page}
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={inventory.length < 20}
                  className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </RequirePermission>
  );
}
