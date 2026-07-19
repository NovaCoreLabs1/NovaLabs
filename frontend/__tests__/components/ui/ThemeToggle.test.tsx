import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ThemeToggle', () => {
  it('renders theme toggle button with aria-label', async () => {
    const ThemeToggle = (await import('@/components/ui/ThemeToggle')).default;
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle />
      </ThemeProvider>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-label')).toBe('Toggle theme');
  });
});
