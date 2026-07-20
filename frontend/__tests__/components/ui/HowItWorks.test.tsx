import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HowItWorks from '@/components/ui/HowItWorks';

describe('HowItWorks', () => {
  it('renders the section heading', () => {
    render(<HowItWorks />);
    expect(screen.getByText('How it works')).toBeDefined();
  });

  it('renders all three steps with numbers', () => {
    render(<HowItWorks />);
    expect(screen.getByText('01')).toBeDefined();
    expect(screen.getByText('02')).toBeDefined();
    expect(screen.getByText('03')).toBeDefined();
  });

  it('renders step titles', () => {
    render(<HowItWorks />);
    expect(screen.getByText('Set up your space')).toBeDefined();
    expect(screen.getByText('Invite your team')).toBeDefined();
    expect(screen.getByText('Manage everything')).toBeDefined();
  });

  it('renders step descriptions', () => {
    render(<HowItWorks />);
    expect(screen.getByText(/Create your workspace/)).toBeDefined();
    expect(screen.getByText(/Add members/)).toBeDefined();
    expect(screen.getByText(/Bookings, billing/)).toBeDefined();
  });

  it('has the how-it-works id for anchor linking', () => {
    const { container } = render(<HowItWorks />);
    const section = container.querySelector('#how-it-works');
    expect(section).toBeDefined();
  });
});
