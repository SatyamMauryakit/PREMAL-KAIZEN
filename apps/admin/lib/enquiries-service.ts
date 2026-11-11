const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  orderNumber: string | null;
  message: string;
  createdAt: string;
}

export const adminEnquiriesService = {
  async getMessages(token: string, limit = 50, offset = 0): Promise<{ messages: ContactMessage[]; total: number }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const response = await fetch(`${API_BASE}/api/contact/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error('Failed to load enquiries');
    }
    return response.json();
  },
};
