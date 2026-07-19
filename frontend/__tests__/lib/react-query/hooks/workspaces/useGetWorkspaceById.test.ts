import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey, queryFn, enabled }: any) => ({
    data: { success: true, data: { id: 'ws-1', name: 'Workspace 1' } },
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

describe('useGetWorkspaceById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object with data', async () => {
    const { useGetWorkspaceById } = await import(
      '@/lib/react-query/hooks/workspaces/useGetWorkspaceById'
    );
    const { result } = renderHook(() => useGetWorkspaceById('ws-1'));

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('passes enabled=false when id is empty', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetWorkspaceById } = await import(
      '@/lib/react-query/hooks/workspaces/useGetWorkspaceById'
    );
    renderHook(() => useGetWorkspaceById(''));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('passes enabled=true when id is provided', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetWorkspaceById } = await import(
      '@/lib/react-query/hooks/workspaces/useGetWorkspaceById'
    );
    renderHook(() => useGetWorkspaceById('ws-1'));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('uses correct queryKey and endpoint', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetWorkspaceById } = await import(
      '@/lib/react-query/hooks/workspaces/useGetWorkspaceById'
    );
    renderHook(() => useGetWorkspaceById('ws-42'));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['workspaces', 'ws-42'],
      }),
    );
  });
});
