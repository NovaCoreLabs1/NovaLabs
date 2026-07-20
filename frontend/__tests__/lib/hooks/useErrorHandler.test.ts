import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '@/lib/hooks/useErrorHandler';

const mockLogout = vi.fn();

vi.mock('@/lib/store/authStore', () => ({
  useAuthActions: () => ({
    logout: mockLogout,
  }),
}));

describe('useErrorHandler', () => {
  beforeEach(() => {
    mockLogout.mockClear();
    vi.restoreAllMocks();
  });

  it('returns a handleError function', () => {
    const { result } = renderHook(() => useErrorHandler());
    expect(result.current.handleError).toBeInstanceOf(Function);
  });

  it('logs out on 401 status', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = { response: { status: 401 } };

    act(() => {
      result.current.handleError(error);
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('does not log out on 403 status', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = { response: { status: 403 } };

    act(() => {
      result.current.handleError(error);
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('handles error with top-level status property', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = { status: 401 };

    act(() => {
      result.current.handleError(error);
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('handles error without status gracefully', () => {
    const { result } = renderHook(() => useErrorHandler());
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    act(() => {
      result.current.handleError('string error');
    });

    expect(mockLogout).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles 500 status without logging out', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = { response: { status: 500 } };

    act(() => {
      result.current.handleError(error);
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('handles 404 status without logging out', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = { response: { status: 404 } };

    act(() => {
      result.current.handleError(error);
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });
});
