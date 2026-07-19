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
          if (onSuccess) onSuccess(result);
        } catch (err) {
          if (onError) onError(err);
        }
      },
      mutateAsync: async (data: any) => {
        try {
          const result = await fn(data);
          if (onSuccess) onSuccess(result);
          return result;
        } catch (err) {
          if (onError) onError(err);
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

describe('useMarkNotificationRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object', async () => {
    const { useMarkNotificationRead } = await import(
      '@/lib/react-query/hooks/notifications/useMarkNotificationRead'
    );
    const { result } = renderHook(() => useMarkNotificationRead());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.patch with notification id and invalidates queries', async () => {
    const { useMarkNotificationRead } = await import(
      '@/lib/react-query/hooks/notifications/useMarkNotificationRead'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.patch as any).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMarkNotificationRead());
    await result.current.mutateAsync('notif-1');

    expect(apiClient.patch).toHaveBeenCalledWith('/notifications/notif-1/read');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['notifications'],
    });
  });
});
