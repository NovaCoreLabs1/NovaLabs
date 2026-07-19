import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockRouter = { push: vi.fn() };
const mockSearchParams = { get: vi.fn() };
const mockLogin = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/store/authStore', () => ({
  useAuthActions: () => ({ login: mockLogin }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Track the mutation callbacks so we can invoke them in tests
let onSuccessCallback: ((data?: any) => void) | null = null;
let onErrorCallback: ((error: any) => void) | null = null;
let mutationFn: ((data: any) => Promise<any>) | null = null;

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(
    ({ mutationKey, onSuccess, onError, mutationFn: fn }: any) => {
      onSuccessCallback = onSuccess;
      onErrorCallback = onError;
      mutationFn = fn;
      return {
        mutate: async (data: any) => {
          try {
            const result = await fn(data);
            onSuccess(result);
          } catch (err) {
            onError(err);
          }
        },
        mutateAsync: async (data: any) => {
          try {
            const result = await fn(data);
            onSuccess(result);
            return result;
          } catch (err) {
            onError(err);
            throw err;
          }
        },
        isPending: false,
        isError: false,
        isSuccess: false,
        data: null,
        error: null,
      } as any;
    },
  ),
}));

describe('useLoginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
    mockSearchParams.get.mockReturnValue(null);
  });

  it('returns a mutation object with mutate function', async () => {
    const { useLoginUser } = await import(
      '@/lib/react-query/hooks/auth/useLoginUser'
    );
    const { result } = renderHook(() => useLoginUser());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls login on mutation and shows success toast then redirects', async () => {
    mockLogin.mockResolvedValue({ user: { id: 'u1' } });

    const { useLoginUser } = await import(
      '@/lib/react-query/hooks/auth/useLoginUser'
    );
    const { result } = renderHook(() => useLoginUser());

    await result.current.mutateAsync({
      email: 'test@test.com',
      password: 'pass',
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'pass',
    });
    const toastModule = await import('sonner');
    expect(toastModule.toast.success).toHaveBeenCalledWith('Login successful');
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to custom URL when redirect param is present', async () => {
    mockLogin.mockResolvedValue({ user: { id: 'u1' } });
    mockSearchParams.get.mockReturnValue('/admin');

    const { useLoginUser } = await import(
      '@/lib/react-query/hooks/auth/useLoginUser'
    );
    const { result } = renderHook(() => useLoginUser());

    await result.current.mutateAsync({
      email: 'test@test.com',
      password: 'pass',
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/admin');
  });

  it('redirects to verify-2fa when error has twoFactorRequired', async () => {
    mockLogin.mockRejectedValue({
      twoFactorRequired: true,
      tempToken: 'temp-123',
      email: 'test@test.com',
    });

    const { useLoginUser } = await import(
      '@/lib/react-query/hooks/auth/useLoginUser'
    );
    const { result } = renderHook(() => useLoginUser());

    await result.current.mutateAsync({
      email: 'test@test.com',
      password: 'pass',
    }).catch(() => {});

    expect(mockRouter.push).toHaveBeenCalledWith(
      '/verify-2fa?tempToken=temp-123&email=test%40test.com',
    );
  });

  it('redirects to verify-otp when error has unverified flag', async () => {
    mockLogin.mockRejectedValue({
      unverified: true,
      email: 'test@test.com',
      message: 'Please verify your email',
    });

    const { useLoginUser } = await import(
      '@/lib/react-query/hooks/auth/useLoginUser'
    );
    const { result } = renderHook(() => useLoginUser());

    await result.current.mutateAsync({
      email: 'test@test.com',
      password: 'pass',
    }).catch(() => {});

    const toastModule = await import('sonner');
    expect(toastModule.toast.info).toHaveBeenCalledWith(
      'Please verify your email to continue.',
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/verify-otp?email=test%40test.com',
    );
  });

  it('shows generic error toast for unknown errors', async () => {
    mockLogin.mockRejectedValue(new Error('Network error'));

    const { useLoginUser } = await import(
      '@/lib/react-query/hooks/auth/useLoginUser'
    );
    const { result } = renderHook(() => useLoginUser());

    await result.current.mutateAsync({
      email: 'test@test.com',
      password: 'pass',
    }).catch(() => {});

    const toastModule = await import('sonner');
    expect(toastModule.toast.error).toHaveBeenCalledWith(
      'Login failed. Please check your credentials.',
    );
  });
});
