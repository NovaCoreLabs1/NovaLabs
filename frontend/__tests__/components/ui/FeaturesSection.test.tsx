import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeaturesSection from '@/components/ui/FeaturesSection';

describe('FeaturesSection', () => {
  it('renders the section heading', () => {
    render(<FeaturesSection />);
    expect(screen.getByText(/Everything you need/)).toBeDefined();
  });

  it('renders the subheading', () => {
    render(<FeaturesSection />);
    expect(screen.getByText(/Built for coworking/)).toBeDefined();
  });

  it('renders all six feature cards', () => {
    render(<FeaturesSection />);
    expect(screen.getByText('Team management')).toBeDefined();
    expect(screen.getByText('Real-time analytics')).toBeDefined();
    expect(screen.getByText('Access control')).toBeDefined();
    expect(screen.getByText('Mobile ready')).toBeDefined();
    expect(screen.getByText('Automated billing')).toBeDefined();
    expect(screen.getByText('Multi-location')).toBeDefined();
  });

  it('renders feature descriptions', () => {
    render(<FeaturesSection />);
    expect(screen.getByText(/Roles, permissions/)).toBeDefined();
    expect(screen.getByText(/Occupancy, revenue/)).toBeDefined();
  });

  it('has features id for anchor linking', () => {
    const { container } = render(<FeaturesSection />);
    const section = container.querySelector('#features');
    expect(section).toBeDefined();
  });
});
