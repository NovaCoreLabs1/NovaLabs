import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (lib/utils)', () => {
  it('merges class strings', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'visible', false && 'hidden')).toBe('base visible');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });

  it('accepts arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
  });
});
