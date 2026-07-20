import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthInit } from '@/lib/hooks/useAuthInit';

const mockInitializeAuth = vi.fn();

vi.mock('@/lib/store/authStore', () => ({
  useAuthActions: () => ({
    initializeAuth: mockInitializeAuth,
  }),
}));

describe('useAuthInit', () => {
  beforeEach(() => {
    mockInitializeAuth.mockClear();
  });

  it('calls initializeAuth on mount', () => {
    renderHook(() => useAuthInit());
    expect(mockInitializeAuth).toHaveBeenCalledTimes(1);
  });
});
