import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Separator } from '@/components/ui/separator';

describe('Separator', () => {
  it('renders horizontally by default', () => {
    const { container } = render(<Separator />);
    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator).toBeDefined();
    expect(separator?.getAttribute('data-orientation')).toBe('horizontal');
  });

  it('renders vertically when orientation is vertical', () => {
    const { container } = render(<Separator orientation="vertical" />);
    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator?.getAttribute('data-orientation')).toBe('vertical');
  });

  it('applies custom className', () => {
    const { container } = render(<Separator className="custom-sep" />);
    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator?.className).toContain('custom-sep');
  });
});
