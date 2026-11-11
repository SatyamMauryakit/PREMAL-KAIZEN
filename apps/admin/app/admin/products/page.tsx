'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminProductsService, ProductResponse } from '@/lib/products-service';

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'out_of_stock' | 'all'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, [page, search, status]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const result = await adminProductsService.getProducts(token, page, 20, search, undefined, status);
      setProducts(result.data);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? It will be hidden from the store and this list, but can be restored later from Deleted Products.')) return;

    setDeleting(id);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      await adminProductsService.deleteProduct(id, token);
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeleting(null);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  return (
    <RequirePermission permission="products:view">
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Products"
        subtitle="Manage your product catalog, pricing, and inventory."
      />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-light">
          {/* Actions */}
          <div className="p-6 border-b border-gray-light flex justify-between items-center">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as 'active' | 'inactive' | 'out_of_stock' | 'all');
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Disabled only</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
            <div className="flex gap-3">
              <Link
                href="/admin/products/deleted"
                className="px-4 py-2 border border-gray-light text-gray-dark font-medium rounded hover:border-black hover:text-black transition-colors text-sm"
              >
                Deleted Products
              </Link>
              <Link
                href="/admin/products/create"
                className="px-4 py-2 bg-black text-cream font-medium rounded hover:bg-gray-dark transition-colors text-sm"
              >
                + Add Product
              </Link>
            </div>
          </div>

          {/* Products Table */}
          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">
              No products found. <Link href="/admin/products/create" className="text-black font-medium">Create one</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-light bg-gray-light">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Image</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-gray-light hover:bg-gray-light">
                      <td className="px-6 py-4">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0].url}
                            alt={product.images[0].alt || product.name}
                            className="w-12 h-12 object-cover rounded border border-gray-light"
                          />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center rounded border border-dashed border-gray-light text-gray-medium text-[10px]">
                            No image
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-black">{product.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-dark">{product.sku}</td>
                      <td className="px-6 py-4 text-sm font-medium text-black">{formatPrice(product.price)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            product.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <Link href={`/admin/products/${product.id}`} className="text-black hover:text-gray-dark font-medium">
                          Edit
                        </Link>
                        <span className="text-gray-light">|</span>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deleting === product.id}
                          className="text-black hover:text-gray-dark font-medium disabled:opacity-50"
                        >
                          {deleting === product.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && total > 0 && (
            <div className="p-6 border-t border-gray-light flex justify-between items-center">
              <p className="text-sm text-gray-medium">Showing {products.length} of {total} products</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button className="px-4 py-2 border border-black text-black rounded text-sm hover:bg-black hover:text-cream transition-colors">
                  {page}
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={products.length < 20}
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
