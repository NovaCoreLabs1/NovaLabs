import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey, queryFn, staleTime }: any) => ({
    data: { success: true, data: null },
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

describe('useGetActiveCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object', async () => {
    const { useGetActiveCheckIn } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useGetActiveCheckIn'
    );
    const { result } = renderHook(() => useGetActiveCheckIn());

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('uses correct queryKey and staleTime', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetActiveCheckIn } = await import(
      '@/lib/react-query/hooks/workspace-tracking/useGetActiveCheckIn'
    );
    renderHook(() => useGetActiveCheckIn());

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['workspace-tracking', 'active'],
        staleTime: 30000,
      }),
    );
  });

});
