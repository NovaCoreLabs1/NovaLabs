import { describe, it, expect } from 'vitest';
import { cn } from '@/utils/cn';

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'visible', false && 'hidden')).toBe('base visible');
  });

  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });

  it('accepts arrays', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('accepts objects', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
  });

  it('filters falsy values', () => {
    expect(cn('a', undefined, null, '', 'b')).toBe('a b');
  });
});
