import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '@/components/ui/label';

describe('Label', () => {
  it('renders with text content', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toBeDefined();
  });

  it('renders with htmlFor attribute', () => {
    render(<Label htmlFor="username-input">Username</Label>);
    const label = screen.getByText('Username');
    expect(label.getAttribute('for')).toBe('username-input');
  });

  it('applies custom className', () => {
    const { container } = render(
      <Label className="custom-label-class">Label Text</Label>,
    );
    // Radix LabelPrimitive.Root renders a label element
    const label = container.querySelector('label');
    expect(label?.className).toContain('custom-label-class');
  });

  it('renders with data-slot attribute', () => {
    const { container } = render(<Label>Test</Label>);
    const label = container.querySelector('label');
    expect(label?.getAttribute('data-slot')).toBe('label');
  });
});
