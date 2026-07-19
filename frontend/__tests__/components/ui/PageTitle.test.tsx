import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageTitle } from '@/components/ui/PageTitle';

describe('PageTitle', () => {
  it('renders the title', () => {
    render(<PageTitle title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeDefined();
  });

  it('renders subtitle when provided', () => {
    render(<PageTitle title="Dashboard" subtitle="Welcome back" />);
    expect(screen.getByText('Welcome back')).toBeDefined();
  });

  it('does not render subtitle when not provided', () => {
    render(<PageTitle title="Dashboard" />);
    expect(screen.queryByText('Welcome back')).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(<PageTitle title="Test" className="custom-class" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('custom-class');
  });
});
