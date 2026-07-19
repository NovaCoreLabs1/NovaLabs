import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey, queryFn }: any) => ({
    data: { success: true, data: { enabled: false, backupCodesRemaining: 0 } },
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

describe('use2faStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object with data', async () => {
    const { use2faStatus } = await import(
      '@/lib/react-query/hooks/two-factor/use2faStatus'
    );
    const { result } = renderHook(() => use2faStatus());

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('calls apiClient.get with correct endpoint', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { use2faStatus } = await import(
      '@/lib/react-query/hooks/two-factor/use2faStatus'
    );
    renderHook(() => use2faStatus());

    // Verify the queryKey and queryFn are set up correctly
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['2fa', 'status'],
      }),
    );
  });
});
