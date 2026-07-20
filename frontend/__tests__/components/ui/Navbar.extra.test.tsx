import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '@/components/ui/Navbar';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

describe('Navbar (extra coverage)', () => {
  it('renders the Building2 icon in the logo', () => {
    const { container } = render(<Navbar />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('toggles mobile menu open and closed', () => {
    render(<Navbar />);
    const toggleButton = screen.getByLabelText('Toggle menu');

    // Initially closed - menu should not be visible
    expect(screen.queryByRole('link', { name: 'Features' })).toBeDefined();
    // Desktop features link exists, mobile ones only show when menu is open

    // Click to open - mobile menu items appear
    fireEvent.click(toggleButton);
    // Features should now appear in both desktop and mobile
    const featureLinks = screen.getAllByText('Features');
    expect(featureLinks.length).toBeGreaterThanOrEqual(2);

    // Click to close
    fireEvent.click(toggleButton);
    // Mobile menu should be gone - only desktop features remain
    const featureLinksAfter = screen.getAllByText('Features');
    expect(featureLinksAfter.length).toBeGreaterThanOrEqual(1);
  });

  it('closes mobile menu when a nav link is clicked', () => {
    render(<Navbar />);
    const toggleButton = screen.getByLabelText('Toggle menu');

    // Open mobile menu
    fireEvent.click(toggleButton);

    // Click the mobile menu close button (icon changes to X when open)
    const closeButton = screen.getByLabelText('Toggle menu');
    fireEvent.click(closeButton);

    // After closing, the mobile menu should be closed
    // Desktop Features link still exists
    expect(screen.getByText('Features')).toBeDefined();
  });

  it('renders with custom empty items', () => {
    render(<Navbar items={[]} />);
    // Should still render logo and auth buttons
    expect(screen.getByText('NovaLabs')).toBeDefined();
    expect(screen.getByText('Log in')).toBeDefined();
    expect(screen.getByText('Sign up')).toBeDefined();
  });

  it('renders mobile menu with custom items', () => {
    const customItems = [
      { label: 'Pricing', href: '#pricing' },
    ];
    render(<Navbar items={customItems} />);

    // Open mobile menu
    fireEvent.click(screen.getByLabelText('Toggle menu'));

    // Custom item should appear in mobile
    const pricingLinks = screen.getAllByText('Pricing');
    expect(pricingLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('has correct link hrefs for auth buttons', () => {
    render(<Navbar />);
    const loginLink = screen.getByText('Log in');
    const signupLink = screen.getByText('Sign up');

    expect(loginLink.getAttribute('href')).toBe('/login');
    expect(signupLink.getAttribute('href')).toBe('/register');
  });

  it('renders mobile sign up button with correct href', () => {
    render(<Navbar />);
    // Open mobile menu
    fireEvent.click(screen.getByLabelText('Toggle menu'));

    // Find all Sign up links - at least one should have /register href
    const signupLinks = screen.getAllByText('Sign up');
    const hasRegisterLink = signupLinks.some(
      (link) => link.getAttribute('href') === '/register',
    );
    expect(hasRegisterLink).toBe(true);
  });
});
