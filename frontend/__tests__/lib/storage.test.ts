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
    document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
  });

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

  it('clears all auth data', async () => {
    const { storage } = await import('@/lib/storage');
    storage.setToken('test-token');
    storage.setUser(mockUser);
    storage.clear();
    expect(storage.getToken()).toBeNull();
    expect(storage.getUser()).toBeNull();
  });

  it('returns null for getUser when user is not set', async () => {
    const { storage } = await import('@/lib/storage');
    expect(storage.getUser()).toBeNull();
  });
});
