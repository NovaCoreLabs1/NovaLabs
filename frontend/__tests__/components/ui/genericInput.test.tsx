import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GenericInput from '@/components/ui/genericInput';

describe('GenericInput', () => {
  it('renders with placeholder', () => {
    render(<GenericInput placeholder="Enter name" />);
    expect(screen.getByPlaceholderText('Enter name')).toBeDefined();
  });

  it('renders label when provided', () => {
    render(<GenericInput label="Full Name" placeholder="Name" />);
    expect(screen.getByText('Full Name')).toBeDefined();
  });

  it('renders error message when error is provided', () => {
    render(<GenericInput placeholder="Email" error="Invalid email" />);
    expect(screen.getByText('Invalid email')).toBeDefined();
  });

  it('does not render error when error is null', () => {
    render(<GenericInput placeholder="Email" error={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('marks input as invalid when error exists', () => {
    render(<GenericInput placeholder="Email" error="Required" />);
    const input = screen.getByPlaceholderText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('forwards ref to input', () => {
    const ref = { current: null };
    render(<GenericInput placeholder="Ref" ref={ref} />);
    expect(ref.current).not.toBeNull();
  });
});
