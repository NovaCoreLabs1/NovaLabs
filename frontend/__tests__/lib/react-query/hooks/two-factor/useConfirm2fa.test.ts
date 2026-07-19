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

describe('useConfirm2fa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object with mutate function', async () => {
    const { useConfirm2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useConfirm2fa'
    );
    const { result } = renderHook(() => useConfirm2fa());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.post with the token and invalidates queries on success', async () => {
    const { useConfirm2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useConfirm2fa'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockResolvedValue({
      success: true,
      data: { backupCodes: ['code1', 'code2'] },
    });

    const { result } = renderHook(() => useConfirm2fa());

    await result.current.mutateAsync('123456');

    expect(apiClient.post).toHaveBeenCalledWith('/auth/2fa/confirm', {
      token: '123456',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['2fa', 'status'],
    });

    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith(
      'Two-factor authentication enabled',
    );
  });

  it('shows error toast on failure', async () => {
    const { useConfirm2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useConfirm2fa'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(new Error('Invalid code'));

    const { result } = renderHook(() => useConfirm2fa());

    await result.current.mutateAsync('000000').catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Invalid code');
  });

  it('shows default error message when error has no message', async () => {
    const { useConfirm2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useConfirm2fa'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(new Error());

    const { result } = renderHook(() => useConfirm2fa());

    await result.current.mutateAsync('000000').catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Invalid code. Please try again.');
  });
});
