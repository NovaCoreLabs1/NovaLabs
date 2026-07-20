import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/ui/Hero';

describe('Hero', () => {
  it('renders the headline text', () => {
    render(<Hero />);
    expect(screen.getByText(/Workspace management/)).toBeDefined();
    expect(screen.getByText(/that just works/)).toBeDefined();
  });

  it('renders the subheading', () => {
    render(<Hero />);
    expect(screen.getByText(/One place for bookings/)).toBeDefined();
  });

  it('renders call-to-action buttons', () => {
    render(<Hero />);
    expect(screen.getByText('Get started free')).toBeDefined();
    expect(screen.getByText('See how it works')).toBeDefined();
  });
});
