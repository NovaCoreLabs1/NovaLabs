import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrustedBy from '@/components/ui/TrustedBy';

describe('TrustedBy', () => {
  it('renders the section heading', () => {
    render(<TrustedBy />);
    expect(screen.getByText(/Trusted by teams at/)).toBeDefined();
  });

  it('renders all company names', () => {
    render(<TrustedBy />);
    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('Lattice')).toBeDefined();
    expect(screen.getByText('Runway')).toBeDefined();
    expect(screen.getByText('Vercel')).toBeDefined();
    expect(screen.getByText('Linear')).toBeDefined();
    expect(screen.getByText('Notion')).toBeDefined();
  });
});
