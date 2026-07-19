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

describe('useGetWorkspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object with data', async () => {
    const { useGetWorkspaces } = await import(
      '@/lib/react-query/hooks/workspaces/useGetWorkspaces'
    );
    const { result } = renderHook(() => useGetWorkspaces());

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('passes queryKey with empty params', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetWorkspaces } = await import(
      '@/lib/react-query/hooks/workspaces/useGetWorkspaces'
    );
    renderHook(() => useGetWorkspaces());

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['workspaces', 'list', {}],
      }),
    );
  });

});
