import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from '@/components/ui/genericButton';

describe('GenericButton', () => {
  it('renders with default props (primary, md)', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDefined();
    expect(button.className).toContain('bg-blue-600');
  });

  it('renders with secondary variant', () => {
    render(<Button variant="secondary">Cancel</Button>);
    const button = screen.getByText('Cancel');
    expect(button.className).toContain('bg-gray-100');
  });

  it('renders with different sizes', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByText('Large');
    expect(button.className).toContain('h-12');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByText('Disabled') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('applies custom className', () => {
    render(<Button className="custom-btn">Styled</Button>);
    const button = screen.getByText('Styled');
    expect(button.className).toContain('custom-btn');
  });
});
