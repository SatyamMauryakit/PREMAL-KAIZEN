const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  category: string;
  orderNumber?: string;
  message: string;
}

export const contactService = {
  async submitForm(data: ContactFormData) {
    try {
      const response = await fetch(`${API_BASE}/api/contact/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit form');
      }

      return await response.json();
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error('An error occurred while submitting your message');
    }
  },
};
