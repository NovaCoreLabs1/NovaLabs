import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '@/components/ui/Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages is 1 or less', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders page buttons and navigation', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />
    );
    expect(screen.getByText('Prev')).toBeDefined();
    expect(screen.getByText('Next')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('disables Prev on first page', () => {
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />
    );
    const prevButton = screen.getByText('Prev') as HTMLButtonElement;
    expect(prevButton.disabled).toBe(true);
  });

  it('disables Next on last page', () => {
    render(
      <Pagination currentPage={3} totalPages={3} onPageChange={vi.fn()} />
    );
    const nextButton = screen.getByText('Next') as HTMLButtonElement;
    expect(nextButton.disabled).toBe(true);
  });

  it('calls onPageChange when clicking a page button', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByText('2'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with prev/next values', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByText('Prev'));
    expect(onPageChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('shows ellipsis when far from start', () => {
    render(
      <Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} />
    );
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });
});
