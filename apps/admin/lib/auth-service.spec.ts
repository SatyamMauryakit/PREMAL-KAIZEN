import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// adminAuthService.getToken() checks `typeof window === 'undefined'` to decide
// whether it's safe to touch localStorage (it's used both server- and client-side
// in this Next.js app). Vitest's default "node" environment has no window at all,
// so a minimal stand-in plus a localStorage mock is set up here rather than pulling
// in a full jsdom environment/dependency just for this.
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
};

beforeEach(() => {
  store.clear();
  (global as any).window = global;
  (global as any).localStorage = localStorageMock;
});

afterEach(() => {
  delete (global as any).window;
  delete (global as any).localStorage;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('adminAuthService', () => {
  it('getToken returns null when nothing is stored', async () => {
    const { adminAuthService } = await import('./auth-service');
    expect(adminAuthService.getToken()).toBeNull();
  });

  it('setToken then getToken round-trips the value under the admin-specific key', async () => {
    const { adminAuthService } = await import('./auth-service');
    adminAuthService.setToken('abc123');
    expect(adminAuthService.getToken()).toBe('abc123');
    expect(store.get('adminSessionToken')).toBe('abc123');
  });

  it('clearToken removes the stored token', async () => {
    const { adminAuthService } = await import('./auth-service');
    adminAuthService.setToken('abc123');
    adminAuthService.clearToken();
    expect(adminAuthService.getToken()).toBeNull();
  });

  describe('login', () => {
    it('rejects and does not store a token when the API reports invalid credentials', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ message: 'Invalid email or password' }),
        }),
      );
      const { adminAuthService } = await import('./auth-service');

      await expect(adminAuthService.login('a@b.com', 'wrong')).rejects.toThrow('Invalid email or password');
      expect(adminAuthService.getToken()).toBeNull();
    });

    it('rejects and does not store a token for a valid customer login that is not an admin', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            user: { role: 'customer', email: 'customer@example.com' },
            sessionToken: 'should-never-be-stored',
          }),
        }),
      );
      const { adminAuthService } = await import('./auth-service');

      await expect(adminAuthService.login('customer@example.com', 'correct')).rejects.toThrow(
        'does not have administrator access',
      );
      expect(adminAuthService.getToken()).toBeNull();
    });

    it('stores the token on a successful admin login', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            user: { role: 'admin', email: 'admin@example.com' },
            sessionToken: 'real-admin-token',
          }),
        }),
      );
      const { adminAuthService } = await import('./auth-service');

      const user = await adminAuthService.login('admin@example.com', 'correct');

      expect(user.role).toBe('admin');
      expect(adminAuthService.getToken()).toBe('real-admin-token');
    });
  });

  describe('getCurrentAdmin', () => {
    it('returns null immediately when no token is stored, without calling the API', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const { adminAuthService } = await import('./auth-service');

      const result = await adminAuthService.getCurrentAdmin();

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('clears the token and returns null when the API rejects it (expired/invalid session)', async () => {
      const { adminAuthService } = await import('./auth-service');
      adminAuthService.setToken('stale-token');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

      const result = await adminAuthService.getCurrentAdmin();

      expect(result).toBeNull();
      expect(adminAuthService.getToken()).toBeNull();
    });

    it('clears the token and returns null if the session is valid but the role is not admin', async () => {
      const { adminAuthService } = await import('./auth-service');
      adminAuthService.setToken('customer-token');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { role: 'customer' } }) }),
      );

      const result = await adminAuthService.getCurrentAdmin();

      expect(result).toBeNull();
      expect(adminAuthService.getToken()).toBeNull();
    });

    it('returns the admin user when the session is valid and the role is admin', async () => {
      const { adminAuthService } = await import('./auth-service');
      adminAuthService.setToken('valid-admin-token');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ user: { role: 'admin', email: 'admin@example.com' } }),
        }),
      );

      const result = await adminAuthService.getCurrentAdmin();

      expect(result?.role).toBe('admin');
      expect(adminAuthService.getToken()).toBe('valid-admin-token'); // not cleared
    });
  });
});
