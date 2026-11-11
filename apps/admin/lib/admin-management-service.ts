import { AdminRole } from './permissions';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface AdminListItem {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  adminRole: AdminRole | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

async function handleResponse<T>(response: Response, fallbackError: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || fallbackError);
  }
  return response.json();
}

export const adminManagementService = {
  async createAdmin(
    token: string,
    data: { email: string; password: string; firstName?: string; lastName?: string; adminRole: AdminRole },
  ) {
    const response = await fetch(`${API_BASE}/api/auth/admin/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; user: AdminListItem }>(response, 'Failed to create administrator');
  },

  async list(token: string): Promise<AdminListItem[]> {
    const response = await fetch(`${API_BASE}/api/admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response, 'Failed to load administrators');
  },

  async changeRole(token: string, id: string, adminRole: AdminRole): Promise<AdminListItem> {
    const response = await fetch(`${API_BASE}/api/admin/admins/${id}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ adminRole }),
    });
    return handleResponse(response, 'Failed to change role');
  },

  async setStatus(token: string, id: string, isActive: boolean): Promise<AdminListItem> {
    const response = await fetch(`${API_BASE}/api/admin/admins/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive }),
    });
    return handleResponse(response, 'Failed to update status');
  },

  async getActivity(token: string, id: string): Promise<{ data: AdminAuditLogEntry[]; total: number }> {
    const response = await fetch(`${API_BASE}/api/admin/admins/${id}/activity`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response, 'Failed to load activity');
  },
};
