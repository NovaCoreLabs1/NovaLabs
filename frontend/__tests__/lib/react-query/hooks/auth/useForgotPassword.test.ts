import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Track mutation callbacks
let mutationFn: ((data: any) => Promise<any>) | null = null;

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(({ mutationKey, mutationFn: fn }: any) => {
    mutationFn = fn;
    return {
      mutate: vi.fn((data: any) => fn(data)),
      mutateAsync: vi.fn((data: any) => fn(data)),
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
    post: vi.fn().mockResolvedValue({ success: true, message: 'Reset link sent' }),
  },
}));

describe('useForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationFn = null;
  });

  it('returns a mutation object with mutate function', async () => {
    const { useForgotPassword } = await import(
      '@/lib/react-query/hooks/auth/useForgotPassword'
    );
    const { result } = renderHook(() => useForgotPassword());

    expect(result.current.mutate).toBeInstanceOf(Function);
    expect(result.current.isPending).toBe(false);
  });

  it('calls apiClient.post with correct endpoint and body', async () => {
    const { useForgotPassword } = await import(
      '@/lib/react-query/hooks/auth/useForgotPassword'
    );
    const { apiClient } = await import('@/lib/apiClient');
    const { result } = renderHook(() => useForgotPassword());

    await result.current.mutateAsync({ email: 'test@test.com' });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'test@test.com',
    });
  });

  it('forwards the response from the API', async () => {
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockResolvedValue({
      success: true,
      message: 'Check your email',
    });

    const { useForgotPassword } = await import(
      '@/lib/react-query/hooks/auth/useForgotPassword'
    );
    const { result } = renderHook(() => useForgotPassword());

    const response = await result.current.mutateAsync({
      email: 'test@test.com',
    });

    expect(response).toEqual({ success: true, message: 'Check your email' });
  });

  it('rejects when API call fails', async () => {
    const { apiClient } = await import('@/lib/apiClient');
    (apiClient.post as any).mockRejectedValue(new Error('User not found'));

    const { useForgotPassword } = await import(
      '@/lib/react-query/hooks/auth/useForgotPassword'
    );
    const { result } = renderHook(() => useForgotPassword());

    await expect(
      result.current.mutateAsync({ email: 'test@test.com' }),
    ).rejects.toThrow('User not found');
  });
});
