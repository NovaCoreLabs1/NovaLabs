import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders with default variant and size', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDefined();
    expect(button.getAttribute('data-slot')).toBe('button');
  });

  it('renders children text', () => {
    render(<Button>Submit</Button>);
    expect(screen.getByText('Submit')).toBeDefined();
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Styled</Button>);
    const button = screen.getByText('Styled');
    expect(button.className).toContain('custom-class');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByText('Disabled') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('shows loading spinner when loading prop is true', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    // When loading, children are replaced with spinner
    expect(button.querySelector('.animate-spin')).toBeDefined();
  });

  it('is disabled when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
