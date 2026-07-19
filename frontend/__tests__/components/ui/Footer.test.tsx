import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '@/components/ui/Footer';

describe('Footer', () => {
  it('renders the brand name', () => {
    render(<Footer />);
    expect(screen.getByText('NovaLabs')).toBeDefined();
  });

  it('renders product links', () => {
    render(<Footer />);
    expect(screen.getByText('Features')).toBeDefined();
    expect(screen.getByText('How it works')).toBeDefined();
    expect(screen.getByText('Early access')).toBeDefined();
  });

  it('renders legal links', () => {
    render(<Footer />);
    expect(screen.getByText('Privacy Policy')).toBeDefined();
    expect(screen.getByText('Terms of Service')).toBeDefined();
    expect(screen.getByText('Contact Us')).toBeDefined();
  });

  it('renders brand description', () => {
    render(<Footer />);
    expect(screen.getByText(/Workspace management for modern teams/)).toBeDefined();
  });

  it('renders copyright with current year', () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(String(currentYear)))).toBeDefined();
  });
});
