import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Newsletter from '@/components/ui/Newsletter';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('Newsletter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders heading and description', () => {
    render(<Newsletter />);
    expect(screen.getByText(/Ready to simplify/)).toBeDefined();
    expect(screen.getByText(/Join thousands/)).toBeDefined();
  });

  it('renders email input and submit button', () => {
    render(<Newsletter />);
    expect(screen.getByPlaceholderText('you@company.com')).toBeDefined();
    expect(screen.getByText('Get early access')).toBeDefined();
  });

  it('shows error for invalid email', async () => {
    render(<Newsletter />);
    const input = screen.getByPlaceholderText('you@company.com');
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: 'invalid-email' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email/)).toBeDefined();
    });
  });

  it('calls apiClient and shows success on valid email', async () => {
    const { apiClient } = await import('@/lib/apiClient');
    vi.mocked(apiClient.post).mockResolvedValueOnce({});

    render(<Newsletter />);
    const input = screen.getByPlaceholderText('you@company.com');
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/newsletter/subscribe', {
        email: 'test@example.com',
      });
    });

    expect(screen.getByText(/Check your email/)).toBeDefined();
  });

  it('shows error message when subscription fails', async () => {
    const { apiClient } = await import('@/lib/apiClient');
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Already subscribed'));

    render(<Newsletter />);
    const input = screen.getByPlaceholderText('you@company.com');
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Already subscribed')).toBeDefined();
    });
  });
});
