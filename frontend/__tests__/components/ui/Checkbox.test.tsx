import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from '@/components/ui/Checkbox';

describe('Checkbox', () => {
  it('renders as a checkbox input', () => {
    render(<Checkbox aria-label="Accept terms" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDefined();
  });

  it('can be checked and unchecked', () => {
    render(<Checkbox aria-label="Toggle" />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('applies custom className', () => {
    render(<Checkbox aria-label="Styled" className="custom-class" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.className).toContain('custom-class');
  });
});
