'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminProductsService, ProductResponse } from '@/lib/products-service';

export default function DeletedProductsPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, [page, search]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const result = await adminProductsService.getDeletedProducts(token, page, 20, search);
      setProducts(result.data);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deleted products');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (!confirm('Restore this product? It will reappear in the main Products list as a disabled draft - you will still need to re-enable it to make it live again.')) return;

    setBusy(id);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      await adminProductsService.restoreProduct(id, token);
      setProducts(products.filter(p => p.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore product');
    } finally {
      setBusy(null);
    }
  };

  const handlePermanentlyDelete = async (id: string) => {
    if (!confirm('Permanently delete this product? This cannot be undone. It will only succeed if no past orders reference it.')) return;

    setBusy(id);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      await adminProductsService.permanentlyDeleteProduct(id, token);
      setProducts(products.filter(p => p.id !== id));
      setTotal(t => Math.max(0, t - 1));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to permanently delete product');
    } finally {
      setBusy(null);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <RequirePermission permission="products:view">
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Deleted Products"
        subtitle="Products removed from the catalog. Restore them or permanently delete them here."
      />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-light">
          <div className="p-6 border-b border-gray-light flex justify-between items-center">
            <input
              type="text"
              placeholder="Search deleted products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
            />
            <Link
              href="/admin/products"
              className="px-4 py-2 border border-gray-light text-gray-dark font-medium rounded hover:border-black hover:text-black transition-colors text-sm"
            >
              ← Back to Products
            </Link>
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading deleted products...</div>
          ) : products.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">
              No deleted products. <Link href="/admin/products" className="text-black font-medium">Back to Products</Link>
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Deleted On</th>
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
                            className="w-12 h-12 object-cover rounded border border-gray-light opacity-60"
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
                      <td className="px-6 py-4 text-sm text-gray-dark">{formatDate(product.deletedAt)}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleRestore(product.id)}
                          disabled={busy === product.id}
                          className="text-black hover:text-gray-dark font-medium disabled:opacity-50"
                        >
                          {busy === product.id ? 'Working...' : 'Restore'}
                        </button>
                        <span className="text-gray-light">|</span>
                        <button
                          onClick={() => handlePermanentlyDelete(product.id)}
                          disabled={busy === product.id}
                          className="text-red-700 hover:text-red-900 font-medium disabled:opacity-50"
                        >
                          Delete Permanently
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && total > 0 && (
            <div className="p-6 border-t border-gray-light flex justify-between items-center">
              <p className="text-sm text-gray-medium">Showing {products.length} of {total} deleted products</p>
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
