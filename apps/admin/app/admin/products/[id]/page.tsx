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
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface ImageEntry extends UploadedImage {
  id: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
    loadData();
  }, []);

  const getToken = () => {
    const token = localStorage.getItem('adminSessionToken');
    if (!token) throw new Error('Not authenticated. Please log in again.');
    return token;
  };

  const loadData = async () => {
    try {
      const token = getToken();

      const [product, categoriesResult] = await Promise.all([
        adminProductsService.getProduct(productId, token),
        adminCategoriesService.getCategories(token),
      ]);

      setFormData({
        name: product.name,
        sku: product.sku,
        description: product.description,
        price: (product.price / 100).toString(),
        originalPrice: product.originalPrice ? (product.originalPrice / 100).toString() : '',
        categoryId: product.categoryId || '',
        colors: product.colors.join(', '),
        sizes: product.sizes.join(', '),
        isActive: product.isActive,
      });

      setImages(
        (product.images || []).map((img) => ({
          id: img.id,
          url: img.url,
          filename: img.url.split('/').pop() || img.id,
          size: 0,
          mimeType: '',
          alt: img.alt,
        } as ImageEntry))
      );

      setCategories(categoriesResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setIsLoading(false);
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
    setIsSaving(true);

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

      await adminProductsService.updateProduct(productId, productData, token);
      router.push('/admin/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${formData.name}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    setError(null);
    try {
      const token = getToken();
      await adminProductsService.deleteProduct(productId, token);
      router.push('/admin/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-light">
        <Header title="Edit Product" subtitle="Update product details." />
        <div className="p-6 text-center text-gray-medium">Loading product...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <Header title="Edit Product" subtitle="Update product details." />

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
                {isUploading ? 'Uploading...' : 'JPEG, PNG, WEBP, or GIF. Max 5MB each. First image is the primary image.'}
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
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-light">
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="px-6 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <Link
                  href="/admin/products"
                  className="px-6 py-2 border border-black text-black font-medium rounded hover:bg-black hover:text-cream transition-colors"
                >
                  Cancel
                </Link>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-red-600 font-medium rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
