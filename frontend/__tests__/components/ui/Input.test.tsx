import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders with default props', () => {
    render(<Input placeholder="Enter name" />);
    const input = screen.getByPlaceholderText('Enter name');
    expect(input).toBeDefined();
  });

  it('renders with an error message', () => {
    render(<Input placeholder="Email" error="Email is required" />);
    expect(screen.getByText('Email is required')).toBeDefined();
  });

  it('applies custom className', () => {
    render(<Input placeholder="Test" className="custom-class" />);
    const input = screen.getByPlaceholderText('Test');
    expect(input.className).toContain('custom-class');
  });

  it('forwards ref to the input element', () => {
    const ref = { current: null };
    render(<Input placeholder="Ref test" ref={ref} />);
    expect(ref.current).not.toBeNull();
  });

  it('renders with icon when provided', () => {
    render(<Input placeholder="Search" icon={<span>🔍</span>} />);
    expect(screen.getByText('🔍')).toBeDefined();
  });
});
