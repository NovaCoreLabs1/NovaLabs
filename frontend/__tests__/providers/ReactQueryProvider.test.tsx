import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReactQueryProvider from '@/providers/ReactQueryProvider';

// Mock react-query-devtools to avoid issues in test environment
vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => null,
}));

describe('ReactQueryProvider', () => {
  it('renders children within QueryClientProvider', () => {
    render(
      <ReactQueryProvider>
        <div>Test Child</div>
      </ReactQueryProvider>,
    );
    expect(screen.getByText('Test Child')).toBeDefined();
  });

  it('renders multiple children', () => {
    render(
      <ReactQueryProvider>
        <span>First</span>
        <span>Second</span>
      </ReactQueryProvider>,
    );
    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
  });
});
