import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let onSuccessCallback: ((data?: any) => void) | null = null;
let onErrorCallback: ((error: any) => void) | null = null;
let mutationFn: ((data: any) => Promise<any>) | null = null;

vi.mock('@tanstack/react-query', () => ({
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
    post: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('useInitializePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object', async () => {
    const { useInitializePayment } = await import(
      '@/lib/react-query/hooks/payments/useInitializePayment'
    );
    const { result } = renderHook(() => useInitializePayment());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.post with bookingId', async () => {
    const { useInitializePayment } = await import(
      '@/lib/react-query/hooks/payments/useInitializePayment'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockResolvedValue({
      success: true,
      data: { authorizationUrl: 'https://pay.com/checkout', reference: 'ref-123' },
    });

    const { result } = renderHook(() => useInitializePayment());
    await result.current.mutateAsync('booking-1');

    expect(apiClient.post).toHaveBeenCalledWith('/payments/initialize', {
      bookingId: 'booking-1',
    });
  });

  it('shows error toast on failure', async () => {
    const { useInitializePayment } = await import(
      '@/lib/react-query/hooks/payments/useInitializePayment'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(
      new Error('Payment already completed'),
    );

    const { result } = renderHook(() => useInitializePayment());
    await result.current.mutateAsync('booking-1').catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Payment already completed');
  });

  it('shows default error message when none provided', async () => {
    const { useInitializePayment } = await import(
      '@/lib/react-query/hooks/payments/useInitializePayment'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(new Error());

    const { result } = renderHook(() => useInitializePayment());
    await result.current.mutateAsync('booking-1').catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Failed to initialize payment');
  });
});
