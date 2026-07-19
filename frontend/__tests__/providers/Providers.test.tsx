import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Providers from '@/providers/Providers';

// Mock child providers
vi.mock('@/providers/ReactQueryProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="react-query-provider">{children}</div>
  ),
}));

vi.mock('@/providers/authInitializer', () => ({
  AuthInitializerProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-initializer">{children}</div>
  ),
}));

describe('Providers', () => {
  it('renders children nested in provider tree', () => {
    render(
      <Providers>
        <div>App Content</div>
      </Providers>,
    );

    const queryProvider = screen.getByTestId('react-query-provider');
    const authProvider = screen.getByTestId('auth-initializer');

    expect(queryProvider).toBeDefined();
    expect(authProvider).toBeDefined();
    expect(screen.getByText('App Content')).toBeDefined();
  });
});
