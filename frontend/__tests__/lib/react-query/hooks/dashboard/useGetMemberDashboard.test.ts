import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey, queryFn }: any) => ({
    data: {
      success: true,
      data: {
        stats: { activeBookings: 2, totalSpent: 150000, invoiceCount: 3, lastCheckIn: null },
        recentBookings: [],
        recentPayments: [],
      },
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

describe('useGetMemberDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object with data', async () => {
    const { useGetMemberDashboard } = await import(
      '@/lib/react-query/hooks/dashboard/useGetMemberDashboard'
    );
    const { result } = renderHook(() => useGetMemberDashboard());

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('uses correct queryKey', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetMemberDashboard } = await import(
      '@/lib/react-query/hooks/dashboard/useGetMemberDashboard'
    );
    renderHook(() => useGetMemberDashboard());

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['dashboard', 'member'],
      }),
    );
  });
});
