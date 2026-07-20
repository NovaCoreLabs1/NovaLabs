import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Alert from '@/components/ui/Alert';

describe('Alert', () => {
  it('renders children content', () => {
    render(<Alert>This is an alert</Alert>);
    expect(screen.getByText('This is an alert')).toBeDefined();
  });

  it('renders title when provided', () => {
    render(<Alert title="Warning">Something happened</Alert>);
    expect(screen.getByText('Warning')).toBeDefined();
  });

  it('renders icon when provided', () => {
    render(<Alert icon={<span>🔔</span>}>With icon</Alert>);
    expect(screen.getByText('🔔')).toBeDefined();
  });

  it('renders empty h3 when title is not provided', () => {
    render(<Alert>No title</Alert>);
    const heading = screen.queryByRole('heading');
    expect(heading).toBeDefined();
    expect(heading?.textContent).toBe('');
  });
});
