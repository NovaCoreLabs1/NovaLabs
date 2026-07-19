import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('env', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the API URL from environment', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'TestApp');

    const { env } = await import('@/utils/env');
    expect(env.NEXT_PUBLIC_API_URL).toBe('https://api.example.com');
  });

  it('returns the app name from environment', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'NovaLabs');
    vi.stubEnv('NODE_ENV', 'test');

    const { env } = await import('@/utils/env');
    expect(env.NEXT_PUBLIC_APP_NAME).toBe('NovaLabs');
  });

  it('returns NODE_ENV from environment', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    vi.stubEnv('NODE_ENV', 'production');

    const { env } = await import('@/utils/env');
    expect(env.NODE_ENV).toBe('production');
  });
});
