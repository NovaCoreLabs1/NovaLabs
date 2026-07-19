import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey, queryFn, enabled }: any) => ({
    data: { message: 'Booking retrieved', data: { id: 'booking-1' } },
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('useGetBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object with data', async () => {
    const { useGetBooking } = await import(
      '@/lib/react-query/hooks/bookings/useGetBooking'
    );
    const { result } = renderHook(() => useGetBooking('booking-1'));

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('disables query when id is empty', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetBooking } = await import(
      '@/lib/react-query/hooks/bookings/useGetBooking'
    );
    renderHook(() => useGetBooking(''));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('correctly sets queryKey with the booking id', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetBooking } = await import(
      '@/lib/react-query/hooks/bookings/useGetBooking'
    );
    renderHook(() => useGetBooking('booking-42'));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['bookings', 'booking-42'],
      }),
    );
  });
});
