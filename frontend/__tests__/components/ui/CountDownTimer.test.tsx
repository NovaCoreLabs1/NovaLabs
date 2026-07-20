import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CountdownTimer } from '@/components/ui/CountDownTimer';

describe('CountdownTimer', () => {
  it('renders all four countdown units', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    render(<CountdownTimer targetDate={futureDate} />);
    expect(screen.getByText('Days')).toBeDefined();
    expect(screen.getByText('Hours')).toBeDefined();
    expect(screen.getByText('Minutes')).toBeDefined();
    expect(screen.getByText('Seconds')).toBeDefined();
  });

  it('renders "Launching In" heading', () => {
    const futureDate = new Date(Date.now() + 86400000);
    render(<CountdownTimer targetDate={futureDate} />);
    expect(screen.getByText('Launching In')).toBeDefined();
  });

  it('handles past dates by showing all zeros', () => {
    const pastDate = new Date('2020-01-01');
    render(<CountdownTimer targetDate={pastDate} />);
    const zeros = screen.getAllByText('00');
    expect(zeros.length).toBe(4); // days, hours, minutes, seconds
  });
});
