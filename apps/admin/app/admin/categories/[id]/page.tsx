'use client';

import { Header } from '@/components/Header';
import { useState, useEffect } from 'react';
import { adminCategoriesService } from '@/lib/products-service';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });

  useEffect(() => {
    loadCategory();
  }, []);

  const loadCategory = async () => {
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const category = await adminCategoriesService.getCategory(categoryId, token);
      setFormData({
        name: category.name,
        slug: category.slug,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load category');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      if (!formData.name || !formData.slug) {
        throw new Error('Name and slug are required');
      }

      await adminCategoriesService.updateCategory(categoryId, formData, token);
      router.push('/admin/categories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-light">
        <Header title="Edit Category" subtitle="Update category details." />
        <div className="p-6 text-center text-gray-medium">Loading category...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Edit Category" subtitle="Update category details." />

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
              <p className="text-xs text-gray-medium mt-1">Used in URLs.</p>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-gray-light">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
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
