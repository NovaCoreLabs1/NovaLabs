import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimePill } from '@/components/ui/TimePill';

describe('TimePill', () => {
  it('renders the value zero-padded to 2 digits', () => {
    render(<TimePill label="Hours" value={5} />);
    expect(screen.getByText('05')).toBeDefined();
  });

  it('renders double-digit values without padding', () => {
    render(<TimePill label="Days" value={12} />);
    expect(screen.getByText('12')).toBeDefined();
  });

  it('renders label below the value', () => {
    render(<TimePill label="Minutes" value={30} />);
    expect(screen.getByText('Minutes')).toBeDefined();
  });

  it('renders zero as "00"', () => {
    render(<TimePill label="Seconds" value={0} />);
    expect(screen.getByText('00')).toBeDefined();
  });
});
