const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  emailVerified: string | null;
}

const TOKEN_KEY = 'adminSessionToken';

export const adminAuthService = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  /**
   * Log in and verify the account has admin privileges.
   * Throws if credentials are invalid or the account is not an admin.
   */
  async login(email: string, password: string): Promise<AdminUser> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    if (data.user?.role !== 'admin') {
      throw new Error('This account does not have administrator access.');
    }

    this.setToken(data.sessionToken);
    return data.user;
  },

  /**
   * Validate the stored token against the API and confirm admin role.
   * Returns null (and clears the token) if invalid, expired, or not an admin.
   */
  async getCurrentAdmin(): Promise<AdminUser | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        this.clearToken();
        return null;
      }

      const data = await response.json();
      if (data.user?.role !== 'admin') {
        this.clearToken();
        return null;
      }

      return data.user;
    } catch {
      return null;
    }
  },

  async logout() {
    const token = this.getToken();
    this.clearToken();

    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best-effort server-side invalidation; local token is already cleared.
      }
    }
  },
};
