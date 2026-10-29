export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  price: number;
  freeShippingThreshold?: number;
  estimatedDays?: number;
  enabled: boolean;
}

export interface StoreSettings {
  id: string;
  storeName: string;
  storeEmail: string;
  storePhone: string;
  businessAddress: string;
  timezone: string;
  locale: string;
  currency: string;
  shippingMethods: ShippingMethod[];
  defaultTaxRate: number;
  taxCalculationMode: 'inclusive' | 'exclusive';
  guestCheckoutEnabled: boolean;
  minimumOrderValue: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  orderConfirmationEnabled: boolean;
  paymentNotificationsEnabled: boolean;
  shippingNotificationsEnabled: boolean;
  lowStockNotificationsEnabled: boolean;
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  lastModifiedAt: string;
  lastModifiedBy?: string;
}

export interface SettingsAuditLog {
  id: string;
  setting: string;
  previousValue?: string;
  newValue?: string;
  changedBy: string;
  changeReason?: string;
  createdAt: string;
}

class SettingsService {
  private apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async getSettings(token: string): Promise<StoreSettings> {
    const response = await fetch(`${this.apiBase}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  }

  async updateSettings(token: string, updates: Partial<StoreSettings>) {
    const response = await fetch(`${this.apiBase}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update settings');
    }
    return response.json();
  }

  async getShippingMethods(token: string): Promise<ShippingMethod[]> {
    const response = await fetch(`${this.apiBase}/api/admin/settings/shipping/methods`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch shipping methods');
    return response.json();
  }

  async updateShippingMethods(token: string, methods: ShippingMethod[]) {
    const response = await fetch(`${this.apiBase}/api/admin/settings/shipping/methods`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(methods),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update shipping methods');
    }
    return response.json();
  }

  async getTaxConfiguration(token: string) {
    const response = await fetch(`${this.apiBase}/api/admin/settings/tax`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch tax configuration');
    return response.json();
  }

  async updateTaxConfiguration(token: string, rate: number, mode: 'inclusive' | 'exclusive') {
    const response = await fetch(`${this.apiBase}/api/admin/settings/tax`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rate, mode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update tax configuration');
    }
    return response.json();
  }

  async getNotificationPreferences(token: string) {
    const response = await fetch(`${this.apiBase}/api/admin/settings/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch notification preferences');
    return response.json();
  }

  async updateNotificationPreferences(token: string, prefs: any) {
    const response = await fetch(`${this.apiBase}/api/admin/settings/notifications`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(prefs),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update notification preferences');
    }
    return response.json();
  }

  async getMaintenanceMode(token: string) {
    const response = await fetch(`${this.apiBase}/api/admin/settings/maintenance`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch maintenance mode');
    return response.json();
  }

  async setMaintenanceMode(token: string, enabled: boolean, message: string) {
    const response = await fetch(`${this.apiBase}/api/admin/settings/maintenance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled, message }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update maintenance mode');
    }
    return response.json();
  }

  async getAuditLog(token: string, limit: number = 50, offset: number = 0): Promise<SettingsAuditLog[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await fetch(`${this.apiBase}/api/admin/settings/audit-log?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to fetch audit log');
    return response.json();
  }

  async calculateTax(token: string, amount: number) {
    const response = await fetch(`${this.apiBase}/api/admin/settings/tax/calculate/${amount}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to calculate tax');
    return response.json();
  }
}

export const adminSettingsService = new SettingsService();
