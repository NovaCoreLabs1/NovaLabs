import {
  parseCorsOrigins,
  resolveCorsConfig,
  resolveWsCorsConfig,
} from './cors-config';

describe('parseCorsOrigins', () => {
  it('returns an empty list when the env value is undefined or empty', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins(null)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins('   ')).toEqual([]);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(parseCorsOrigins(' https://a.com , https://b.com , ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('de-duplicates while preserving order', () => {
    expect(
      parseCorsOrigins('https://a.com,https://b.com,https://a.com'),
    ).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('resolveCorsConfig', () => {
  it('throws in production when CORS_ORIGINS is empty (fail-fast)', () => {
    expect(() => resolveCorsConfig('production', undefined)).toThrow(
      /CORS_ORIGINS/,
    );
    expect(() => resolveCorsConfig('production', '')).toThrow(/CORS_ORIGINS/);
    expect(() => resolveCorsConfig('production', '  , ,  ')).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('uses the parsed CORS_ORIGINS allow-list in production', () => {
    expect(
      resolveCorsConfig(
        'production',
        'https://novalabs.app, https://www.novalabs.app',
      ),
    ).toEqual({
      origin: ['https://novalabs.app', 'https://www.novalabs.app'],
    });
  });

  it('uses the explicit allow-list in development when provided', () => {
    expect(resolveCorsConfig('development', 'https://preview.example')).toEqual(
      { origin: ['https://preview.example'] },
    );
  });

  it('falls back to the dev host list when neither env var is set and not in production', () => {
    expect(resolveCorsConfig('development', undefined).origin).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ]);
  });

  it('treats NODE_ENV other than "production" as non-production', () => {
    expect(resolveCorsConfig(undefined, undefined).origin).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ]);
  });
});

describe('resolveWsCorsConfig', () => {
  it('throws in production when CORS_ORIGINS is empty (defence in depth)', () => {
    expect(() => resolveWsCorsConfig('production', undefined)).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('mirrors the strict HTTP allow-list in production', () => {
    expect(resolveWsCorsConfig('production', 'https://novalabs.app')).toEqual({
      origin: ['https://novalabs.app'],
    });
  });

  it('returns "*" in development when CORS_ORIGINS is unset', () => {
    expect(resolveWsCorsConfig('development', undefined)).toEqual({
      origin: '*',
    });
  });

  it('uses the explicit allow-list in development when provided', () => {
    expect(resolveWsCorsConfig('development', 'http://localhost:3000')).toEqual(
      { origin: ['http://localhost:3000'] },
    );
  });
});
