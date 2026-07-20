import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockInvalidateQueries = vi.fn();
let onSuccessCallback: ((data?: any) => void) | null = null;
let onErrorCallback: ((error: any) => void) | null = null;
let mutationFn: ((data: any) => Promise<any>) | null = null;

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useMutation: vi.fn(({ mutationKey, onSuccess, onError, mutationFn: fn }: any) => {
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
  }),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('useDisable2fa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object with mutate function', async () => {
    const { useDisable2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useDisable2fa'
    );
    const { result } = renderHook(() => useDisable2fa());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.post with password and invalidates queries on success', async () => {
    const { useDisable2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useDisable2fa'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockResolvedValue({
      success: true,
      message: '2FA disabled',
    });

    const { result } = renderHook(() => useDisable2fa());

    await result.current.mutateAsync('mypassword');

    expect(apiClient.post).toHaveBeenCalledWith('/auth/2fa/disable', {
      password: 'mypassword',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['2fa', 'status'],
    });

    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith(
      'Two-factor authentication disabled',
    );
  });

  it('shows error toast with the error message on failure', async () => {
    const { useDisable2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useDisable2fa'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(new Error('Wrong password'));

    const { result } = renderHook(() => useDisable2fa());

    await result.current.mutateAsync('wrong').catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Wrong password');
  });

  it('shows custom error message when provided', async () => {
    const { useDisable2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useDisable2fa'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(
      new Error('Password is incorrect'),
    );

    const { result } = renderHook(() => useDisable2fa());

    await result.current.mutateAsync('wrong').catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Password is incorrect');
  });
});
