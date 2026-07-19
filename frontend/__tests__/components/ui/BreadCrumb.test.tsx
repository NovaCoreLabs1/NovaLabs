import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BreadCrumb from '@/components/ui/BreadCrumb';

describe('BreadCrumb', () => {
  const mockLinks = [
    { label: 'Home', href: '/' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Settings' }, // no href = current page
  ];

  it('renders all breadcrumb links', () => {
    render(<BreadCrumb links={mockLinks} />);
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders nav with aria-label=\"Breadcrumb\"', () => {
    render(<BreadCrumb links={mockLinks} />);
    const nav = screen.getByLabelText('Breadcrumb');
    expect(nav).toBeDefined();
  });

  it('renders the last item as a non-link span (current page)', () => {
    render(<BreadCrumb links={mockLinks} />);
    const settings = screen.getByText('Settings');
    expect(settings.tagName).toBe('SPAN');
  });

  it('renders first items as links', () => {
    render(<BreadCrumb links={mockLinks} />);
    const home = screen.getByText('Home');
    expect(home.tagName).toBe('A');
  });
});
