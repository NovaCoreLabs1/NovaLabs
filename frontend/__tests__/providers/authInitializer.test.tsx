import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthInitializerProvider } from '@/providers/authInitializer';

// Mock the useAuthInit hook
vi.mock('@/lib/hooks/useAuthInit', () => ({
  useAuthInit: vi.fn(),
}));

describe('AuthInitializerProvider', () => {
  it('calls useAuthInit and renders children', async () => {
    const { useAuthInit } = await import('@/lib/hooks/useAuthInit');

    render(
      <AuthInitializerProvider>
        <div>Protected Content</div>
      </AuthInitializerProvider>,
    );

    expect(useAuthInit).toHaveBeenCalled();
    expect(screen.getByText('Protected Content')).toBeDefined();
  });
});
