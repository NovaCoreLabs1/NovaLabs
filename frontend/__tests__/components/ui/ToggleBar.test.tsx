import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleBar } from '@/components/ui/ToggleBar';

describe('ToggleBar', () => {
  const options = [
    { id: 'password', label: 'Password' },
    { id: 'otp', label: 'OTP' },
  ];

  it('renders all options', () => {
    render(<ToggleBar options={options} value="password" onChange={vi.fn()} />);
    expect(screen.getByText('Password')).toBeDefined();
    expect(screen.getByText('OTP')).toBeDefined();
  });

  it('has role="tablist"', () => {
    render(<ToggleBar options={options} value="password" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist')).toBeDefined();
  });

  it('marks the selected tab as aria-selected', () => {
    render(<ToggleBar options={options} value="password" onChange={vi.fn()} />);
    const passwordTab = screen.getByText('Password').closest('[role="tab"]');
    const otpTab = screen.getByText('OTP').closest('[role="tab"]');
    expect(passwordTab?.getAttribute('aria-selected')).toBe('true');
    expect(otpTab?.getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange when a tab is clicked', () => {
    const onChange = vi.fn();
    render(<ToggleBar options={options} value="password" onChange={onChange} />);
    fireEvent.click(screen.getByText('OTP'));
    expect(onChange).toHaveBeenCalledWith('otp');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ToggleBar options={options} value="password" onChange={vi.fn()} className="custom-bar" />
    );
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist?.className).toContain('custom-bar');
  });
});
