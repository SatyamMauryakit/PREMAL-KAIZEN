'use client';

import { Header } from '@/components/Header';
import { useState, useEffect } from 'react';
import { adminProductsService, adminCategoriesService, CategoryResponse } from '@/lib/products-service';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateProductPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    price: '',
    originalPrice: '',
    categoryId: '',
    colors: '',
    sizes: '',
    isActive: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');
      const result = await adminCategoriesService.getCategories(token);
      setCategories(result.data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      if (!formData.name || !formData.sku || !formData.price) {
        throw new Error('Name, SKU, and price are required');
      }

      const productData = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description,
        price: Math.round(parseFloat(formData.price) * 100),
        originalPrice: formData.originalPrice ? Math.round(parseFloat(formData.originalPrice) * 100) : null,
        categoryId: formData.categoryId || null,
        colors: formData.colors.split(',').map(c => c.trim()).filter(Boolean),
        sizes: formData.sizes.split(',').map(s => s.trim()).filter(Boolean),
        isActive: formData.isActive,
      };

      await adminProductsService.createProduct(productData, token);
      router.push('/admin/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Create Product" subtitle="Add a new product to your catalog." />

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
              <label className="block text-sm font-medium text-black mb-2">Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Essential Heavy Hoodie"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                required
              />
            </div>

            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">SKU *</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="e.g., EHH-001"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Product description..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              />
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Price (₹) *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-2">Original Price (₹)</label>
                <input
                  type="number"
                  name="originalPrice"
                  value={formData.originalPrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Category</label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Colors */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Colors (comma-separated)</label>
              <input
                type="text"
                name="colors"
                value={formData.colors}
                onChange={handleChange}
                placeholder="e.g., black, beige, gray"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              />
            </div>

            {/* Sizes */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Sizes (comma-separated)</label>
              <input
                type="text"
                name="sizes"
                value={formData.sizes}
                onChange={handleChange}
                placeholder="e.g., XS, S, M, L, XL, XXL"
                className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
              />
            </div>

            {/* Active */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="mr-2"
              />
              <label className="text-sm text-black">Active</label>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-gray-light">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Product'}
              </button>
              <Link
                href="/admin/products"
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
