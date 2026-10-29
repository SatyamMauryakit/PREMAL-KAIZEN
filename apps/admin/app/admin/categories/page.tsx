'use client';

import { Header } from '@/components/Header';

const categories = [
  { id: 1, name: 'Hoodies', products: 23, status: 'Active' },
  { id: 2, name: 'T-Shirts', products: 34, status: 'Active' },
  { id: 3, name: 'Pants', products: 15, status: 'Active' },
  { id: 4, name: 'Outerwear', products: 12, status: 'Active' },
  { id: 5, name: 'Accessories', products: 63, status: 'Active' },
];

export default function CategoriesPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Categories" subtitle="Manage product categories." />

      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-light">
          {/* Header */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center">
            <h2 className="text-lg font-bold text-black">Category List</h2>
            <button className="px-4 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark transition-colors text-sm">
              + Add Category
            </button>
          </div>

          {/* Categories Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-light bg-gray-light">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Products</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-b border-gray-light hover:bg-gray-light">
                    <td className="px-6 py-4 text-sm font-medium text-black">{cat.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-dark">{cat.products}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {cat.status}
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
        </div>

        {/* Coming Soon */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming Soon:</strong> Category management features will be available in Phase 6.
          </p>
        </div>
      </div>
    </div>
  );
}
