import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockRouter = { push: vi.fn() };
const mockSearchParams = { get: vi.fn() };
const mockAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/store/authStore', () => ({
  useAuthState: () => mockAuthState,
}));

describe('useAuthRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state to defaults
    mockAuthState.user = null;
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
    mockSearchParams.get.mockReturnValue(null);
    // Default pathname for redirect tests
    vi.stubGlobal('location', { pathname: '/dashboard' });
  });

  describe('canAccess', () => {
    it('returns canAccess=true when requireAuth is false (default)', async () => {
      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      const { result } = renderHook(() => useAuthRedirect());

      expect(result.current.canAccess).toBe(true);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('returns canAccess=true when authenticated and no role required', async () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', role: 'user' };

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      const { result } = renderHook(() => useAuthRedirect({ requireAuth: true }));

      expect(result.current.canAccess).toBe(true);
    });

    it('returns canAccess=false when not authenticated and requireAuth is true', async () => {
      mockAuthState.isAuthenticated = false;

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      const { result } = renderHook(() => useAuthRedirect({ requireAuth: true }));

      expect(result.current.canAccess).toBe(false);
    });

    it('returns canAccess=true when authenticated with matching role', async () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', role: 'admin' };

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      const { result } = renderHook(() =>
        useAuthRedirect({ requireAuth: true, requiredRole: 'admin' }),
      );

      expect(result.current.canAccess).toBe(true);
    });

    it('returns canAccess=false when role does not match', async () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', role: 'user' };

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      const { result } = renderHook(() =>
        useAuthRedirect({ requireAuth: true, requiredRole: 'admin' }),
      );

      expect(result.current.canAccess).toBe(false);
    });

    it('returns canAccess=true when page does not require auth and not authenticated', async () => {
      mockAuthState.isAuthenticated = false;

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      const { result } = renderHook(() => useAuthRedirect());

      expect(result.current.canAccess).toBe(true);
    });
  });

  describe('redirect behavior', () => {
    it('redirects unauthenticated users to login with current path', async () => {
      mockAuthState.isAuthenticated = false;
      vi.stubGlobal('location', { pathname: '/profile' });

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      renderHook(() => useAuthRedirect({ requireAuth: true }));

      expect(mockRouter.push).toHaveBeenCalledWith(
        '/auth/login?redirect=' + encodeURIComponent('/profile'),
      );
    });

    it('redirects unauthenticated users to custom redirectTo URL', async () => {
      mockAuthState.isAuthenticated = false;
      vi.stubGlobal('location', { pathname: '/dashboard' });

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      renderHook(() =>
        useAuthRedirect({ requireAuth: true, redirectTo: '/custom-login' }),
      );

      expect(mockRouter.push).toHaveBeenCalledWith(
        '/custom-login?redirect=' + encodeURIComponent('/dashboard'),
      );
    });

    it('redirects authenticated users away when redirectIfAuthenticated is set', async () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', role: 'user' };

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      renderHook(() => useAuthRedirect({ redirectIfAuthenticated: '/dashboard' }));

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });

    it('uses searchParams redirect over redirectIfAuthenticated when present', async () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', role: 'user' };
      mockSearchParams.get.mockReturnValue('/custom-redirect');

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      renderHook(() =>
        useAuthRedirect({ redirectIfAuthenticated: '/dashboard' }),
      );

      expect(mockRouter.push).toHaveBeenCalledWith('/custom-redirect');
      expect(mockSearchParams.get).toHaveBeenCalledWith('redirect');
    });

    it('redirects users without required role to dashboard', async () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', role: 'user' };

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      renderHook(() =>
        useAuthRedirect({ requireAuth: true, requiredRole: 'admin' }),
      );

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });

    it('does not redirect when isLoading is true', async () => {
      mockAuthState.isLoading = true;
      mockAuthState.isAuthenticated = false;

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      renderHook(() => useAuthRedirect({ requireAuth: true }));

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('does not redirect when authenticated and no special conditions', async () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', role: 'user' };

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      renderHook(() => useAuthRedirect({ requireAuth: true }));

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('does not redirect when redirectIfAuthenticated is set but user is not authenticated', async () => {
      mockAuthState.isAuthenticated = false;

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      renderHook(() => useAuthRedirect({ redirectIfAuthenticated: '/dashboard' }));

      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe('return values', () => {
    it('returns isLoading, isAuthenticated, user, and canAccess', async () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', role: 'admin' };
      mockAuthState.isLoading = false;

      const { useAuthRedirect } = await import('@/lib/hooks/useAuthRedirect');
      const { result } = renderHook(() =>
        useAuthRedirect({ requireAuth: true, requiredRole: 'admin' }),
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual({ id: 'user-1', role: 'admin' });
      expect(result.current.canAccess).toBe(true);
    });
  });
});
