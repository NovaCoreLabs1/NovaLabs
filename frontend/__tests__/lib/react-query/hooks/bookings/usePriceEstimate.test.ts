import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey, queryFn, enabled }: any) => ({
    data: {
      success: true,
      data: {
        totalAmount: 500000,
        planType: 'daily',
        seatCount: 2,
        startDate: '2026-08-01',
        endDate: '2026-08-05',
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

const validParams = {
  workspaceId: 'ws-1',
  planType: 'daily' as const,
  startDate: '2026-08-01',
  endDate: '2026-08-05',
  seatCount: 2,
};

describe('usePriceEstimate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object', async () => {
    const { usePriceEstimate } = await import(
      '@/lib/react-query/hooks/bookings/usePriceEstimate'
    );
    const { result } = renderHook(() => usePriceEstimate(validParams));

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('enables query when all params are provided', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { usePriceEstimate } = await import(
      '@/lib/react-query/hooks/bookings/usePriceEstimate'
    );
    renderHook(() => usePriceEstimate(validParams));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('disables query when params is null', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { usePriceEstimate } = await import(
      '@/lib/react-query/hooks/bookings/usePriceEstimate'
    );
    renderHook(() => usePriceEstimate(null));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('disables query when required params are missing', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { usePriceEstimate } = await import(
      '@/lib/react-query/hooks/bookings/usePriceEstimate'
    );
    renderHook(() => usePriceEstimate({ workspaceId: 'ws-1' } as any));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
