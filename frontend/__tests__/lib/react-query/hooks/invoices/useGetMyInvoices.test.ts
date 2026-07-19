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

describe('useGetMyInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a query object', async () => {
    const { useGetMyInvoices } = await import(
      '@/lib/react-query/hooks/invoices/useGetMyInvoices'
    );
    const { result } = renderHook(() => useGetMyInvoices());

    expect(result.current.data).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('passes default pagination to queryKey', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetMyInvoices } = await import(
      '@/lib/react-query/hooks/invoices/useGetMyInvoices'
    );
    renderHook(() => useGetMyInvoices());

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['invoices', 'mine', { page: 1, limit: 10, bookingId: undefined }],
      }),
    );
  });

  it('passes custom pagination and bookingId', async () => {
    const { useQuery } = await import('@tanstack/react-query');

    const { useGetMyInvoices } = await import(
      '@/lib/react-query/hooks/invoices/useGetMyInvoices'
    );
    renderHook(() => useGetMyInvoices(2, 25, 'booking-1'));

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['invoices', 'mine', { page: 2, limit: 25, bookingId: 'booking-1' }],
      }),
    );
  });
});
