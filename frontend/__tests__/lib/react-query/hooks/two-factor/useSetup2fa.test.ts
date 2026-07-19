import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let mutationFn: ((data: any) => Promise<any>) | null = null;

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(({ mutationKey, onSuccess, onError, mutationFn: fn }: any) => {
    mutationFn = fn;
    return {
      mutate: async (data: any) => {
        try {
          const result = await fn(data);
          if (onSuccess) onSuccess(result);
          return result;
        } catch (err) {
          if (onError) onError(err);
          throw err;
        }
      },
      mutateAsync: async (data: any) => {
        try {
          const result = await fn(data);
          if (onSuccess) onSuccess(result);
          return result;
        } catch (err) {
          if (onError) onError(err);
          throw err;
        }
      },
      isPending: false,
      isError: false,
      isSuccess: false,
      data: null,
      error: null,
    } as any;
  }),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({
      success: true,
      data: { secret: 'JBSWY3DPEHPK3PXP', qrCodeDataUrl: 'data:image/png;base64,...' },
    }),
  },
}));

describe('useSetup2fa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationFn = null;
  });

  it('returns a mutation object with mutate function', async () => {
    const { useSetup2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useSetup2fa'
    );
    const { result } = renderHook(() => useSetup2fa());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.post with correct endpoint', async () => {
    const { useSetup2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useSetup2fa'
    );
    const { apiClient } = await import('@/lib/apiClient');
    const { result } = renderHook(() => useSetup2fa());

    await result.current.mutateAsync(undefined);

    expect(apiClient.post).toHaveBeenCalledWith('/auth/2fa/setup', {});
  });

  it('returns the setup data with secret and QR code', async () => {
    const { useSetup2fa } = await import(
      '@/lib/react-query/hooks/two-factor/useSetup2fa'
    );
    const { result } = renderHook(() => useSetup2fa());

    const response = await result.current.mutateAsync(undefined);

    expect(response).toEqual({
      success: true,
      data: { secret: 'JBSWY3DPEHPK3PXP', qrCodeDataUrl: 'data:image/png;base64,...' },
    });
  });
});
