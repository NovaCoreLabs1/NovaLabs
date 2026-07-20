import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '@/components/ui/Navbar';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('Navbar', () => {
  it('renders the logo and brand name', () => {
    render(<Navbar />);
    expect(screen.getByText('NovaLabs')).toBeDefined();
  });

  it('renders default navigation items', () => {
    render(<Navbar />);
    expect(screen.getByText('Features')).toBeDefined();
    expect(screen.getByText('How it works')).toBeDefined();
  });

  it('renders login and signup links', () => {
    render(<Navbar />);
    expect(screen.getByText('Log in')).toBeDefined();
    expect(screen.getByText('Sign up')).toBeDefined();
  });

  it('has mobile menu toggle button', () => {
    render(<Navbar />);
    const toggleButton = screen.getByLabelText('Toggle menu');
    expect(toggleButton).toBeDefined();
  });

  it('opens mobile menu when toggle is clicked', () => {
    render(<Navbar />);
    const toggleButton = screen.getByLabelText('Toggle menu');
    fireEvent.click(toggleButton);
    // Mobile menu items should appear
    expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(2);
  });

  it('renders custom navigation items', () => {
    const customItems = [
      { label: 'Pricing', href: '/pricing' },
      { label: 'About', href: '/about' },
    ];
    render(<Navbar items={customItems} />);
    expect(screen.getByText('Pricing')).toBeDefined();
    expect(screen.getByText('About')).toBeDefined();
  });
});
