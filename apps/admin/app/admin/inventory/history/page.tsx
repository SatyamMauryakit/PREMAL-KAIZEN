'use client';

import { Header } from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { adminInventoryService, AuditLogEntry } from '@/lib/inventory-service';

const CHANGE_TYPES = [
  { value: 'adjustment', label: 'Manual Adjustment' },
  { value: 'reservation', label: 'Order Reservation' },
  { value: 'release', label: 'Order Release' },
  { value: 'order_placed', label: 'Order Placed' },
  { value: 'order_cancelled', label: 'Order Cancelled' },
];

export default function InventoryHistoryPage() {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changeType, setChangeType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadAuditLog();
  }, [page, changeType]);

  const loadAuditLog = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const result = await adminInventoryService.getAuditLog(
        token,
        page,
        20,
        undefined,
        changeType || undefined
      );
      setAuditLog(result.data);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
      setAuditLog([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getChangeTypeLabel = (type: string) => {
    const found = CHANGE_TYPES.find(ct => ct.value === type);
    return found ? found.label : type;
  };

  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'adjustment':
        return 'bg-blue-100 text-blue-700';
      case 'reservation':
        return 'bg-yellow-100 text-yellow-700';
      case 'release':
        return 'bg-green-100 text-green-700';
      case 'order_placed':
        return 'bg-purple-100 text-purple-700';
      case 'order_cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getQuantityChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-light">
      <Header
        title="Inventory Audit Log"
        subtitle="Track all inventory changes and movements"
      />

      <div className="p-6">
        <Link href="/admin/inventory" className="text-black hover:text-gray-dark font-medium mb-6 inline-block">
          ← Back to Inventory
        </Link>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-light">
          {/* Filters */}
          <div className="p-6 border-b border-gray-light">
            <select
              value={changeType}
              onChange={(e) => {
                setChangeType(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
            >
              <option value="">All Changes</option>
              {CHANGE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Audit Log Table */}
          {isLoading ? (
            <div className="p-6 text-center text-gray-medium">Loading audit log...</div>
          ) : auditLog.length === 0 ? (
            <div className="p-6 text-center text-gray-medium">No audit log entries found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-light bg-gray-light">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Product / SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Change Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Previous</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">New</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Change</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-dark">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => {
                    const change = entry.newOnHand - entry.previousOnHand;
                    return (
                      <tr key={entry.id} className="border-b border-gray-light hover:bg-gray-light">
                        <td className="px-6 py-4 text-sm">
                          {entry.inventory && (
                            <>
                              <p className="font-medium text-black">{entry.inventory.product.name}</p>
                              <p className="text-xs text-gray-medium">{entry.inventory.product.sku}</p>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getChangeTypeBadge(entry.changeType)}`}>
                            {getChangeTypeLabel(entry.changeType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-black">{entry.previousOnHand}</td>
                        <td className="px-6 py-4 text-sm font-medium text-black">{entry.newOnHand}</td>
                        <td className={`px-6 py-4 text-sm font-semibold ${getQuantityChangeColor(change)}`}>
                          {change > 0 ? '+' : ''}{change}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-dark max-w-xs truncate">
                          {entry.reason || (
                            <span className="text-gray-medium">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-medium">
                          {new Date(entry.createdAt).toLocaleDateString()}
                          <br />
                          <span className="text-xs">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && auditLog.length > 0 && (
            <div className="p-6 border-t border-gray-light flex justify-between items-center">
              <p className="text-sm text-gray-medium">
                Showing {auditLog.length} of {total} entries
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-light rounded text-sm hover:border-black transition-colors disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button className="px-4 py-2 border border-black text-black rounded text-sm">
                  {page}
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={auditLog.length < 20}
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
  );
}
