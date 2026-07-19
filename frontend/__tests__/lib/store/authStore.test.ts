import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient and storage
const mockApiClient = {
  setToken: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

const mockStorage = {
  getToken: vi.fn(),
  setToken: vi.fn(),
  removeToken: vi.fn(),
  getUser: vi.fn(),
  setUser: vi.fn(),
  removeUser: vi.fn(),
  clear: vi.fn(),
};

vi.mock('@/lib/apiClient', () => ({
  apiClient: mockApiClient,
}));

vi.mock('@/lib/storage', () => ({
  storage: mockStorage,
}));

describe('authStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the store between tests
    const { useAuthStore } = await import('@/lib/store/authStore');
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  describe('initial state', () => {
    it('has correct initial state', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('login', () => {
    it('updates state on successful login', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      mockApiClient.post.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
        accessToken: 'token-123',
      });

      await useAuthStore.getState().login({ email: 'test@test.com', password: 'pass' });

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ id: 'user-1', email: 'test@test.com' });
      expect(state.accessToken).toBe('token-123');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockApiClient.setToken).toHaveBeenCalledWith('token-123');
      expect(mockStorage.setToken).toHaveBeenCalledWith('token-123');
      expect(mockStorage.setUser).toHaveBeenCalledWith({ id: 'user-1', email: 'test@test.com' });
    });

    it('throws twoFactorRequired error when 2FA is required', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      mockApiClient.post.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: 'temp-123',
        message: '2FA required',
      });

      await expect(
        useAuthStore.getState().login({ email: 'test@test.com', password: 'pass' }),
      ).rejects.toMatchObject({
        twoFactorRequired: true,
        tempToken: 'temp-123',
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('throws unverified error when email not verified', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      mockApiClient.post.mockResolvedValue({
        message: 'Please verify your email',
        accessToken: null,
      });

      await expect(
        useAuthStore.getState().login({ email: 'test@test.com', password: 'pass' }),
      ).rejects.toMatchObject({
        unverified: true,
        email: 'test@test.com',
      });
    });

    it('throws on API error', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      mockApiClient.post.mockRejectedValue(new Error('API Error'));

      await expect(
        useAuthStore.getState().login({ email: 'test@test.com', password: 'pass' }),
      ).rejects.toThrow('API Error');
    });
  });

  describe('logout', () => {
    it('clears state, apiClient, and storage', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      // Set logged in state first
      useAuthStore.setState({
        user: { id: 'user-1' } as any,
        accessToken: 'token-123',
        isAuthenticated: true,
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(mockApiClient.setToken).toHaveBeenCalledWith(null);
      expect(mockStorage.clear).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('updates state on successful registration', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      mockApiClient.post.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
        accessToken: 'token-123',
      });

      await useAuthStore.getState().register({
        email: 'test@test.com',
        password: 'pass',
        firstname: 'Test',
        lastname: 'User',
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('token-123');
      expect(mockStorage.setUser).toHaveBeenCalled();
    });
  });

  describe('initializeAuth', () => {
    it('restores auth state from storage when token and user exist', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      mockStorage.getToken.mockReturnValue('stored-token');
      mockStorage.getUser.mockReturnValue({ id: 'user-1', email: 'test@test.com' });

      useAuthStore.getState().initializeAuth();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('stored-token');
      expect(state.user).toEqual({ id: 'user-1', email: 'test@test.com' });
      expect(state.isAuthenticated).toBe(true);
      expect(mockApiClient.setToken).toHaveBeenCalledWith('stored-token');
    });

    it('does nothing when no stored token', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      mockStorage.getToken.mockReturnValue(null);

      useAuthStore.getState().initializeAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes token and updates state', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      useAuthStore.setState({
        accessToken: 'old-token',
        user: { id: 'user-1' } as any,
        isAuthenticated: true,
      });
      mockApiClient.post.mockResolvedValue({
        accessToken: 'new-token',
        user: { id: 'user-1' },
      });

      await useAuthStore.getState().refreshAccessToken();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('new-token');
      expect(mockStorage.setToken).toHaveBeenCalledWith('new-token');
    });

    it('logs out when no current token', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      useAuthStore.setState({ accessToken: null });

      await expect(
        useAuthStore.getState().refreshAccessToken(),
      ).rejects.toThrow('No token available');

      // Should have logged out
      expect(mockStorage.clear).toHaveBeenCalled();
    });
  });

  describe('setUser / setToken / setLoading', () => {
    it('setUser updates user and isAuthenticated', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      useAuthStore.getState().setUser({ id: 'user-1' } as any);
      expect(useAuthStore.getState().user).toEqual({ id: 'user-1' });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('setUser with null clears auth', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      useAuthStore.getState().setUser(null);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('setToken updates token and apiClient', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      useAuthStore.getState().setToken('new-token');
      expect(useAuthStore.getState().accessToken).toBe('new-token');
      expect(mockApiClient.setToken).toHaveBeenCalledWith('new-token');
    });

    it('setLoading updates loading state', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });

  describe('store state access', () => {
    it('has correct state after setting values', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      useAuthStore.setState({
        user: { id: 'user-1', email: 'test@test.com' } as any,
        accessToken: 'token',
        isAuthenticated: true,
        isLoading: false,
      });

      const state = useAuthStore.getState();
      expect(state.user).toMatchObject({ id: 'user-1', email: 'test@test.com' });
      expect(state.accessToken).toBe('token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('has all action functions on the store', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      const state = useAuthStore.getState();
      expect(state.login).toBeInstanceOf(Function);
      expect(state.register).toBeInstanceOf(Function);
      expect(state.logout).toBeInstanceOf(Function);
      expect(state.refreshAccessToken).toBeInstanceOf(Function);
      expect(state.updateProfile).toBeInstanceOf(Function);
      expect(state.initializeAuth).toBeInstanceOf(Function);
      expect(state.clearAuth).toBeInstanceOf(Function);
    });
  });

  describe('clearAuth', () => {
    it('clears all auth state', async () => {
      const { useAuthStore } = await import('@/lib/store/authStore');
      useAuthStore.setState({
        user: { id: 'user-1' } as any,
        accessToken: 'token',
        isAuthenticated: true,
      });

      useAuthStore.getState().clearAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockApiClient.setToken).toHaveBeenCalledWith(null);
      expect(mockStorage.clear).toHaveBeenCalled();
    });
  });
});
