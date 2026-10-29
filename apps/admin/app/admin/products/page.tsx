'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';

const products = [
  { id: '1', name: 'Essential Heavy Hoodie', sku: 'EHH-001', price: '₹12,800', stock: 45, status: 'Active' },
  { id: '2', name: 'Tactical Cargo Pants', sku: 'TCP-001', price: '₹15,200', stock: 32, status: 'Active' },
  { id: '3', name: 'Premal Logo Tee', sku: 'PLT-001', price: '₹6,500', stock: 128, status: 'Active' },
  { id: '4', name: 'Quilted Bomber Jacket', sku: 'QBJ-001', price: '₹24,500', stock: 12, status: 'Low Stock' },
  { id: '5', name: 'Wool Knit Beanie', sku: 'WKB-001', price: '₹3,800', stock: 0, status: 'Out of Stock' },
];

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Products"
        subtitle="Manage your product catalog, pricing, and inventory."
      />

      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-light">
          {/* Actions */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search products..."
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
              />
              <select className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black">
                <option>All Categories</option>
                <option>Hoodies</option>
                <option>T-Shirts</option>
                <option>Pants</option>
              </select>
            </div>
            <Link
              href="/admin/products/create"
              className="px-4 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark transition-colors text-sm"
            >
              + Add Product
            </Link>
          </div>

          {/* Products Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-light bg-gray-light">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-light hover:bg-gray-light">
                    <td className="px-6 py-4 text-sm font-medium text-black">{product.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-dark">{product.sku}</td>
                    <td className="px-6 py-4 text-sm font-medium text-black">{product.price}</td>
                    <td className="px-6 py-4 text-sm text-black font-medium">{product.stock}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          product.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : product.status === 'Low Stock'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button className="text-black hover:text-gray-dark font-medium">Edit</button>
                      <span className="text-gray-light">|</span>
                      <button className="text-black hover:text-gray-dark font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-6 border-t border-gray-light flex justify-between items-center">
            <p className="text-sm text-gray-medium">Showing 5 of 147 products</p>
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors">
                ← Previous
              </button>
              <button className="px-4 py-2 border border-black text-black rounded text-sm hover:bg-black hover:text-cream transition-colors">
                1
              </button>
              <button className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors">
                2
              </button>
              <button className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors">
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming Soon:</strong> Full product management with image uploads, bulk editing, and variant management will be available in Phase 6.
          </p>
        </div>
      </div>
    </div>
  );
}
