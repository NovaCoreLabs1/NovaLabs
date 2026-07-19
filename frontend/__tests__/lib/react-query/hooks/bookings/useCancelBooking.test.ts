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

describe('useCancelBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object', async () => {
    const { useCancelBooking } = await import(
      '@/lib/react-query/hooks/bookings/useCancelBooking'
    );
    const { result } = renderHook(() => useCancelBooking());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.patch and shows success toast', async () => {
    const { useCancelBooking } = await import(
      '@/lib/react-query/hooks/bookings/useCancelBooking'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.patch as any).mockResolvedValue({
      success: true,
      data: { id: 'booking-1', status: 'cancelled' },
    });

    const { result } = renderHook(() => useCancelBooking());
    await result.current.mutateAsync('booking-1');

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/bookings/booking-1/cancel',
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['bookings'],
    });

    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('Booking cancelled');
  });

  it('shows error toast on failure', async () => {
    const { useCancelBooking } = await import(
      '@/lib/react-query/hooks/bookings/useCancelBooking'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.patch as any).mockRejectedValue(
      new Error('Cannot cancel past booking'),
    );

    const { result } = renderHook(() => useCancelBooking());
    await result.current.mutateAsync('booking-1').catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Cannot cancel past booking');
  });
});
