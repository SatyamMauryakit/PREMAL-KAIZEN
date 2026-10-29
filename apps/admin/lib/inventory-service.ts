const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface InventoryItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    price: number;
    category?: { name: string };
    images?: Array<{ url: string }>;
  };
  size?: string;
  color?: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderThreshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  createdAt: string;
  updatedAt: string;
}

export interface InventoryResponse {
  data: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LowStockResponse {
  lowStock: InventoryItem[];
  outOfStock: InventoryItem[];
  totalLow: number;
  totalOut: number;
}

export interface AuditLogEntry {
  id: string;
  inventoryId: string;
  changeType: string;
  previousOnHand: number;
  newOnHand: number;
  previousReserved: number;
  newReserved: number;
  reason?: string;
  reference?: string;
  createdAt: string;
  inventory?: {
    product: {
      name: string;
      sku: string;
    };
  };
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export const adminInventoryService = {
  async getInventory(
    token: string,
    page?: number,
    limit?: number,
    search?: string,
    status?: string,
    categoryId?: string
  ): Promise<InventoryResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (categoryId) params.append('categoryId', categoryId);

    const response = await fetch(`${API_BASE}/api/inventory?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch inventory');
    return response.json();
  },

  async getLowStockItems(token: string, threshold?: number): Promise<LowStockResponse> {
    const params = new URLSearchParams();
    if (threshold) params.append('threshold', threshold.toString());

    const response = await fetch(`${API_BASE}/api/inventory/low-stock?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch low stock items');
    return response.json();
  },

  async getInventoryByProduct(token: string, productId: string): Promise<InventoryItem[]> {
    const response = await fetch(`${API_BASE}/api/inventory/product/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch product inventory');
    return response.json();
  },

  async getVariantInventory(
    token: string,
    productId: string,
    size?: string,
    color?: string
  ): Promise<InventoryItem> {
    const params = new URLSearchParams();
    if (size) params.append('size', size);
    if (color) params.append('color', color);

    const response = await fetch(`${API_BASE}/api/inventory/variant/${productId}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Inventory not found');
    return response.json();
  },

  async adjustInventory(
    token: string,
    productId: string,
    data: {
      size?: string;
      color?: string;
      type: string;
      quantity: number;
      reason: string;
      reference?: string;
      notes?: string;
    }
  ): Promise<InventoryItem> {
    const response = await fetch(`${API_BASE}/api/inventory/adjust/${productId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to adjust inventory');
    }

    const result = await response.json();
    return result; // May contain adjustment details
  },

  async updateReorderThreshold(
    token: string,
    productId: string,
    size: string | null,
    color: string | null,
    threshold: number
  ): Promise<InventoryItem> {
    const params = new URLSearchParams();
    if (size) params.append('size', size);
    if (color) params.append('color', color);

    const response = await fetch(
      `${API_BASE}/api/inventory/reorder-threshold/${productId}?${params}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ threshold }),
      }
    );

    if (!response.ok) throw new Error('Failed to update reorder threshold');
    return response.json();
  },

  async getAuditLog(
    token: string,
    page?: number,
    limit?: number,
    inventoryId?: string,
    changeType?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AuditLogResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (inventoryId) params.append('inventoryId', inventoryId);
    if (changeType) params.append('changeType', changeType);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${API_BASE}/api/inventory/audit-log?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch audit log');
    return response.json();
  },

  async initializeProductInventory(token: string, productId: string) {
    const response = await fetch(`${API_BASE}/api/inventory/initialize/${productId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to initialize inventory');
    return response.json();
  },
};
