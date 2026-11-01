'use client';

import { Header } from '@/components/Header';
import { useState, useEffect, useRef } from 'react';
import {
  adminProductsService,
  adminCategoriesService,
  adminUploadsService,
  CategoryResponse,
  UploadedImage,
} from '@/lib/products-service';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ImageEntry extends UploadedImage {
  id: string;
}

export default function CreateProductPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const getToken = () => {
    const token = localStorage.getItem('adminSessionToken');
    if (!token) throw new Error('Not authenticated. Please log in again.');
    return token;
  };

  const loadCategories = async () => {
    try {
      const result = await adminCategoriesService.getCategories(getToken());
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);
    setIsUploading(true);

    try {
      const token = getToken();
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          throw new Error(`"${file.name}" is not an image file`);
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`"${file.name}" exceeds the 5MB size limit`);
        }
        const uploaded = await adminUploadsService.uploadImage(file, token);
        setImages(prev => [...prev, { ...uploaded, id: crypto.randomUUID() }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const token = getToken();

      if (!formData.name || !formData.sku || !formData.price) {
        throw new Error('Name, SKU, and price are required');
      }

      const price = parseFloat(formData.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error('Price must be a valid non-negative number');
      }

      const productData = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description,
        price: Math.round(price * 100),
        originalPrice: formData.originalPrice ? Math.round(parseFloat(formData.originalPrice) * 100) : null,
        categoryId: formData.categoryId || null,
        colors: formData.colors.split(',').map(c => c.trim()).filter(Boolean),
        sizes: formData.sizes.split(',').map(s => s.trim()).filter(Boolean),
        isActive: formData.isActive,
        images: images.map((img, index) => ({ url: img.url, alt: formData.name, order: index })),
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
            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Product Images</label>

              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {images.map((img, index) => (
                    <div key={img.id} className="relative group">
                      <img
                        src={img.url}
                        alt={`Product preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded border border-gray-light"
                      />
                      {index === 0 && (
                        <span className="absolute top-1 left-1 bg-black text-cream text-[10px] px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 bg-black/70 text-cream w-5 h-5 rounded-full text-xs leading-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleImageSelect}
                disabled={isUploading}
                className="w-full px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black disabled:opacity-50"
              />
              <p className="text-xs text-gray-medium mt-1">
                {isUploading ? 'Uploading...' : 'JPEG, PNG, WEBP, or GIF. Max 5MB each. First image becomes the primary image.'}
              </p>
            </div>

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
                  min="0"
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
                  min="0"
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
              <label className="text-sm text-black">Active (visible on storefront)</label>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-gray-light">
              <button
                type="submit"
                disabled={isLoading || isUploading}
                className="px-6 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
