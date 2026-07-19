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

const bookingData = {
  workspaceId: 'ws-1',
  startDate: '2026-08-01',
  endDate: '2026-08-05',
  planType: 'daily' as const,
  seatCount: 2,
};

describe('useCreateBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSuccessCallback = null;
    onErrorCallback = null;
    mutationFn = null;
  });

  it('returns a mutation object', async () => {
    const { useCreateBooking } = await import(
      '@/lib/react-query/hooks/bookings/useCreateBooking'
    );
    const { result } = renderHook(() => useCreateBooking());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.post and shows success toast', async () => {
    const { useCreateBooking } = await import(
      '@/lib/react-query/hooks/bookings/useCreateBooking'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockResolvedValue({
      success: true,
      data: { id: 'booking-1' },
    });

    const { result } = renderHook(() => useCreateBooking());
    await result.current.mutateAsync(bookingData);

    expect(apiClient.post).toHaveBeenCalledWith('/bookings', bookingData);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['bookings'],
    });

    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('Booking created successfully!');
  });

  it('shows error toast on failure', async () => {
    const { useCreateBooking } = await import(
      '@/lib/react-query/hooks/bookings/useCreateBooking'
    );
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(
      new Error('Workspace fully booked'),
    );

    const { result } = renderHook(() => useCreateBooking());
    await result.current.mutateAsync(bookingData).catch(() => {});

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Workspace fully booked');
  });
});
