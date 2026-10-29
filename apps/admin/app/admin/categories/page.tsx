'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminCategoriesService, CategoryResponse } from '@/lib/products-service';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<(CategoryResponse & { _count?: { products: number } })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, [search]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const result = await adminCategoriesService.getCategories(token, search);
      setCategories(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    setDeleting(id);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      await adminCategoriesService.deleteCategory(id, token);
      setCategories(categories.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Categories" subtitle="Manage product categories." />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-light">
          {/* Header */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center">
            <div className="flex gap-3 flex-1">
              <input
                type="text"
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black flex-1"
              />
            </div>
            <Link
              href="/admin/categories/create"
              className="px-4 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark transition-colors text-sm ml-4"
            >
              + Add Category
            </Link>
          </div>

          {/* Categories Table */}
          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">
              No categories found. <Link href="/admin/categories/create" className="text-black font-medium">Create one</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-light bg-gray-light">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Products</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className="border-b border-gray-light hover:bg-gray-light">
                      <td className="px-6 py-4 text-sm font-medium text-black">{cat.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark font-mono text-xs">{cat.slug}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">{cat._count?.products || 0}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <Link
                          href={`/admin/categories/${cat.id}`}
                          className="text-black hover:text-gray-dark font-medium"
                        >
                          Edit
                        </Link>
                        <span className="text-gray-light">|</span>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          disabled={deleting === cat.id || (cat._count?.products || 0) > 0}
                          className="text-black hover:text-gray-dark font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          title={(cat._count?.products || 0) > 0 ? 'Cannot delete category with products' : ''}
                        >
                          {deleting === cat.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
