import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card body</Card>);
    expect(screen.getByText('Card body')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-card">Test</Card>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('custom-card');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header content</CardHeader>);
    expect(screen.getByText('Header content')).toBeDefined();
  });
});

describe('CardTitle', () => {
  it('renders as an h3 heading', () => {
    render(<CardTitle>Card Title</CardTitle>);
    const heading = screen.getByText('Card Title');
    expect(heading.tagName).toBe('H3');
  });
});

describe('CardDescription', () => {
  it('renders description text', () => {
    render(<CardDescription>Description here</CardDescription>);
    expect(screen.getByText('Description here')).toBeDefined();
  });
});

describe('CardContent', () => {
  it('renders content', () => {
    render(<CardContent>Content area</CardContent>);
    expect(screen.getByText('Content area')).toBeDefined();
  });
});

describe('CardFooter', () => {
  it('renders footer content', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toBeDefined();
  });
});
