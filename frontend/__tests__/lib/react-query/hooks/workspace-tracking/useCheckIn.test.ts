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

describe('useCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object with mutate function', async () => {
    const { useCheckIn } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useCheckIn'
    );
    const { result } = renderHook(() => useCheckIn());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.post with payload and shows success', async () => {
    const { useCheckIn } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useCheckIn'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockResolvedValue({
      success: true,
      data: { id: 'log-1', workspaceId: 'ws-1' },
    });

    const { result } = renderHook(() => useCheckIn());
    const payload = { workspaceId: 'ws-1', notes: 'Working on project' };

    await result.current.mutateAsync(payload);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/workspace-tracking/check-in',
      payload,
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['workspace-tracking', 'active'],
    });

    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('Checked in successfully');
  });

  it('shows error toast on failure', async () => {
    const { useCheckIn } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useCheckIn'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(new Error('Already checked in'));

    const { result } = renderHook(() => useCheckIn());

    await result.current
      .mutateAsync({ workspaceId: 'ws-1' })
      .catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Already checked in');
  });

  it('shows default error message when none provided', async () => {
    const { useCheckIn } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useCheckIn'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(new Error());

    const { result } = renderHook(() => useCheckIn());

    await result.current
      .mutateAsync({ workspaceId: 'ws-1' })
      .catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Failed to check in');
  });
});
