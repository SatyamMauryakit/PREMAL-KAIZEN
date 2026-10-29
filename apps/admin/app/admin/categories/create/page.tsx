'use client';

import { Header } from '@/components/Header';
import { useState } from 'react';
import { adminCategoriesService } from '@/lib/products-service';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateCategoryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Auto-generate slug from name
      ...(name === 'name' && { slug: value.toLowerCase().replace(/\s+/g, '-') }),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      if (!formData.name || !formData.slug) {
        throw new Error('Name and slug are required');
      }

      await adminCategoriesService.createCategory(formData, token);
      router.push('/admin/categories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Create Category" subtitle="Add a new product category." />

      <div className="p-6 max-w-2xl">
        <div className="bg-white rounded-lg border border-gray-light p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Category Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Hoodies"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                required
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Slug *</label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="e.g., hoodies"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-medium mt-1">Used in URLs. Auto-generated from name.</p>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-gray-light">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Category'}
              </button>
              <Link
                href="/admin/categories"
                className="px-6 py-2 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
