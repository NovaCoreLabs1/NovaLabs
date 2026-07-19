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
    patch: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('useCheckOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object', async () => {
    const { useCheckOut } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useCheckOut'
    );
    const { result } = renderHook(() => useCheckOut());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.patch with logId and invalidates multiple queries', async () => {
    const { useCheckOut } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useCheckOut'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.patch as any).mockResolvedValue({
      success: true,
      data: { id: 'log-1', checkedOutAt: new Date().toISOString() },
    });

    const { result } = renderHook(() => useCheckOut());

    await result.current.mutateAsync('log-1');

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/workspace-tracking/check-out/log-1',
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['workspace-tracking', 'active'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['workspace-tracking', 'history'],
    });

    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('Checked out successfully');
  });

  it('shows error toast on failure', async () => {
    const { useCheckOut } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useCheckOut'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.patch as any).mockRejectedValue(
      new Error('No active check-in found'),
    );

    const { result } = renderHook(() => useCheckOut());

    await result.current.mutateAsync('log-1').catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('No active check-in found');
  });
});
