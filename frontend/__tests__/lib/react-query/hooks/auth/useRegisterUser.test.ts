import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockRouter = { push: vi.fn() };
const mockRegister = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

vi.mock('@/lib/store/authStore', () => ({
  useAuthActions: () => ({ register: mockRegister }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Track mutation callbacks to invoke them in tests
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

const registerData = {
  email: 'new@test.com',
  password: 'password123',
  firstname: 'Jane',
  lastname: 'Doe',
};

describe('useRegisterUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object with mutate function', async () => {
    const { useRegisterUser } = await import(
      '@/lib/react-query/hooks/auth/useRegisterUser'
    );
    const { result } = renderHook(() => useRegisterUser());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls register on mutation and shows success toast then redirects to verify-otp', async () => {
    mockRegister.mockResolvedValue(undefined);

    const { useRegisterUser } = await import(
      '@/lib/react-query/hooks/auth/useRegisterUser'
    );
    const { result } = renderHook(() => useRegisterUser());

    await result.current.mutateAsync(registerData);

    expect(mockRegister).toHaveBeenCalledWith(registerData);
    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith(
      'Account created! Please verify your email.',
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/verify-otp?email=new%40test.com',
    );
  });

  it('shows error toast when registration fails', async () => {
    mockRegister.mockRejectedValue(new Error('Email already taken'));

    const { useRegisterUser } = await import(
      '@/lib/react-query/hooks/auth/useRegisterUser'
    );
    const { result } = renderHook(() => useRegisterUser());

    await result.current.mutateAsync(registerData).catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Error creating user');
  });
});
