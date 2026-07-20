import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockRouter = { push: vi.fn() };
const mockSearchParams = { get: vi.fn() };
const mockLogin = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/store/authStore', () => ({
  useAuthStore: (selector: any) => selector({ login: mockLogin }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('useLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns login function and loading state', async () => {
    const { useLogin } = await import('@/hooks/use-login');
    const { result } = renderHook(() => useLogin());

    expect(result.current.login).toBeInstanceOf(Function);
    expect(result.current.loading).toBe(false);
  });

  it('calls login and redirects to dashboard on success', async () => {
    mockLogin.mockResolvedValue(undefined);
    mockSearchParams.get.mockReturnValue(null);

    const { useLogin } = await import('@/hooks/use-login');
    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: 'pass', rememberMe: false });
    });

    expect(mockLogin).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pass' });
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    expect(result.current.loading).toBe(false);
  });

  it('redirects to custom URL when redirect param is present', async () => {
    mockLogin.mockResolvedValue(undefined);
    mockSearchParams.get.mockReturnValue('/admin');

    const { useLogin } = await import('@/hooks/use-login');
    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: 'pass', rememberMe: false });
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/admin');
  });

  it('shows error toast when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    mockSearchParams.get.mockReturnValue(null);

    const { toast } = await import('sonner');

    const { useLogin } = await import('@/hooks/use-login');
    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: 'wrong', rememberMe: false });
    });

    expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
    expect(result.current.loading).toBe(false);
  });

  it('shows generic error toast when error has no message', async () => {
    mockLogin.mockRejectedValue('Some error');
    mockSearchParams.get.mockReturnValue(null);

    const { toast } = await import('sonner');

    const { useLogin } = await import('@/hooks/use-login');
    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: 'wrong', rememberMe: false });
    });

    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });
});
