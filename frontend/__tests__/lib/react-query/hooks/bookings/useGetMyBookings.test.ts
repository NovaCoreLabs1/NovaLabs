import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey, queryFn }: any) => ({
    data: {
      success: true,
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    },
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

describe('useGetMyBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object with data', async () => {
    const { useGetMyBookings } = await import(
      '@/lib/react-query/hooks/bookings/useGetMyBookings'
    );
    const { result } = renderHook(() => useGetMyBookings());

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('passes default page and limit to queryKey', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetMyBookings } = await import(
      '@/lib/react-query/hooks/bookings/useGetMyBookings'
    );
    renderHook(() => useGetMyBookings());

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['bookings', 'mine', { page: 1, limit: 10 }],
      }),
    );
  });

  it('passes custom page and limit to queryKey', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetMyBookings } = await import(
      '@/lib/react-query/hooks/bookings/useGetMyBookings'
    );
    renderHook(() => useGetMyBookings(2, 25));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['bookings', 'mine', { page: 2, limit: 25 }],
      }),
    );
  });
});
