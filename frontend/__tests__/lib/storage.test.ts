import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUser = {
  id: 'user-1',
  firstname: 'John',
  lastname: 'Doe',
  email: 'john@example.com',
  role: 'user' as const,
  isActive: true,
  isSuspended: false,
  isDeleted: false,
  hasCompletedOnboarding: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
};

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie =
      'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
  });

  describe('token operations', () => {
    it('returns null for token when not set', async () => {
      const { storage } = await import('@/lib/storage');
      expect(storage.getToken()).toBeNull();
    });

    it('stores and retrieves a token', async () => {
      const { storage } = await import('@/lib/storage');
      storage.setToken('test-token-123');
      expect(storage.getToken()).toBe('test-token-123');
    });

    it('removes a stored token', async () => {
      const { storage } = await import('@/lib/storage');
      storage.setToken('test-token-123');
      storage.removeToken();
      expect(storage.getToken()).toBeNull();
    });

    it('sets cookie with max-age when setting token', async () => {
      const { storage } = await import('@/lib/storage');
      storage.setToken('cookie-token');
      expect(document.cookie).toContain('authToken=cookie-token');
    });

    it('clears cookie when removing token', async () => {
      const { storage } = await import('@/lib/storage');
      storage.setToken('test-token');
      storage.removeToken();
      expect(document.cookie).not.toContain('authToken=');
    });
  });

  describe('user operations', () => {
    it('stores and retrieves a user', async () => {
      const { storage } = await import('@/lib/storage');
      storage.setUser(mockUser);
      expect(storage.getUser()).toEqual(mockUser);
    });

    it('removes a stored user', async () => {
      const { storage } = await import('@/lib/storage');
      storage.setUser(mockUser);
      storage.removeUser();
      expect(storage.getUser()).toBeNull();
    });

    it('returns null for getUser when user is not set', async () => {
      const { storage } = await import('@/lib/storage');
      expect(storage.getUser()).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears all auth data', async () => {
      const { storage } = await import('@/lib/storage');
      storage.setToken('test-token');
      storage.setUser(mockUser);
      storage.clear();
      expect(storage.getToken()).toBeNull();
      expect(storage.getUser()).toBeNull();
      expect(document.cookie).not.toContain('authToken=');
    });
  });

  // SSR safety — runs LAST so vi.stubGlobal('window', undefined)
  // doesn't pollute the client-side tests above. Each test
  // explicitly restores window with vi.unstubAllGlobals().
  describe('SSR safety (window undefined)', () => {
    it('getToken returns null when window is undefined', async () => {
      vi.stubGlobal('window', undefined);
      const { storage } = await import('@/lib/storage');
      expect(storage.getToken()).toBeNull();
      vi.unstubAllGlobals();
    });

    it('setToken is a no-op when window is undefined', async () => {
      vi.stubGlobal('window', undefined);
      const { storage } = await import('@/lib/storage');
      expect(() => storage.setToken('test')).not.toThrow();
      vi.unstubAllGlobals();
    });

    it('removeToken is a no-op when window is undefined', async () => {
      vi.stubGlobal('window', undefined);
      const { storage } = await import('@/lib/storage');
      expect(() => storage.removeToken()).not.toThrow();
      vi.unstubAllGlobals();
    });

    it('getUser returns null when window is undefined', async () => {
      vi.stubGlobal('window', undefined);
      const { storage } = await import('@/lib/storage');
      expect(storage.getUser()).toBeNull();
      vi.unstubAllGlobals();
    });

    it('setUser is a no-op when window is undefined', async () => {
      vi.stubGlobal('window', undefined);
      const { storage } = await import('@/lib/storage');
      expect(() => storage.setUser(mockUser)).not.toThrow();
      vi.unstubAllGlobals();
    });

    it('removeUser is a no-op when window is undefined', async () => {
      vi.stubGlobal('window', undefined);
      const { storage } = await import('@/lib/storage');
      expect(() => storage.removeUser()).not.toThrow();
      vi.unstubAllGlobals();
    });

    it('clear is a no-op when window is undefined', async () => {
      vi.stubGlobal('window', undefined);
      const { storage } = await import('@/lib/storage');
      expect(() => storage.clear()).not.toThrow();
      vi.unstubAllGlobals();
    });
  });
});
