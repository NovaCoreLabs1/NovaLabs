import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('env', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('getEnvVar (internal)', () => {
    it('returns the value when env var is set and required', async () => {
      vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
      vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'TestApp');

      const { env } = await import('@/utils/env');
      expect(env.NEXT_PUBLIC_API_URL).toBe('https://api.example.com');
    });

    it('throws in non-production when required var is missing', async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'TestApp');
      vi.stubEnv('NODE_ENV', 'development');

      await expect(async () => {
        await import('@/utils/env');
      }).rejects.toThrow('Missing required environment variable');
    });

    it('logs a warning in production when required var is missing', async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'TestApp');
      vi.stubEnv('NODE_ENV', 'production');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { env } = await import('@/utils/env');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('NEXT_PUBLIC_API_URL'),
      );
      expect(env.NEXT_PUBLIC_API_URL).toBe('');

      warnSpy.mockRestore();
    });
  });

  describe('NODE_ENV', () => {
    it('returns NODE_ENV from environment when set', async () => {
      vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
      vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'TestApp');
      vi.stubEnv('NODE_ENV', 'production');

      const { env } = await import('@/utils/env');
      expect(env.NODE_ENV).toBe('production');
    });

    it('defaults to development when NODE_ENV is not set', async () => {
      delete process.env.NODE_ENV;
      vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3000');
      vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'TestApp');

      const { env } = await import('@/utils/env');
      expect(env.NODE_ENV).toBe('development');
    });
  });

  describe('App name', () => {
    it('returns the app name from environment', async () => {
      vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
      vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'NovaLabs');
      vi.stubEnv('NODE_ENV', 'test');

      const { env } = await import('@/utils/env');
      expect(env.NEXT_PUBLIC_APP_NAME).toBe('NovaLabs');
    });
  });
});
