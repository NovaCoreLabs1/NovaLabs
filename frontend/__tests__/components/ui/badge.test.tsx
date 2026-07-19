import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toBeDefined();
  });

  it('renders with secondary variant', () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText('Secondary')).toBeDefined();
  });

  it('renders with destructive variant', () => {
    render(<Badge variant="destructive">Destructive</Badge>);
    expect(screen.getByText('Destructive')).toBeDefined();
  });

  it('renders with outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText('Outline')).toBeDefined();
  });

  it('renders with success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success')).toBeDefined();
  });

  it('renders with warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning')).toBeDefined();
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class">Styled</Badge>);
    const badge = screen.getByText('Styled');
    expect(badge.className).toContain('custom-class');
  });
});
