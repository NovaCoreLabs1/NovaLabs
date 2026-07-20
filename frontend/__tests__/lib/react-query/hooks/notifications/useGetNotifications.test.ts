import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey, queryFn, staleTime }: any) => ({
    data: {
      success: true,
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0, unreadCount: 0 },
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

describe('useGetNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object with data', async () => {
    const { useGetNotifications } = await import(
      '@/lib/react-query/hooks/notifications/useGetNotifications'
    );
    const { result } = renderHook(() => useGetNotifications());

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('uses default pagination and staleTime', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetNotifications } = await import(
      '@/lib/react-query/hooks/notifications/useGetNotifications'
    );
    renderHook(() => useGetNotifications());

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['notifications', 'list', { page: 1, limit: 20 }],
        staleTime: 30000,
      }),
    );
  });

  it('passes custom pagination', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetNotifications } = await import(
      '@/lib/react-query/hooks/notifications/useGetNotifications'
    );
    renderHook(() => useGetNotifications(2, 50));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['notifications', 'list', { page: 2, limit: 50 }],
      }),
    );
  });
});
