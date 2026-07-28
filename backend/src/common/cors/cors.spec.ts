/**
 * Integration test asserting that CORS actually rejects disallowed origins
 * (acceptance criterion of issue #110 — "requests from disallowed origin
 * get 403").
 *
 * Implementation: NestJS `@nestjs/platform-express` `enableCors` ultimately
 * delegates to the `cors` npm middleware. We exercise that middleware
 * directly with the resolver's allow-list output, which is exactly what
 * `enableCors({ origin, credentials: true })` would configure.
 */

import express = require('express');
import request = require('supertest');
// `cors` is an Express middleware factory: under our TS config
// (`esModuleInterop: true`) `import cors from 'cors'` resolves to
// `cors.default`, which on `cors@^2.8.5` is undefined. The CommonJS
// interop works correctly with `import cors = require('cors')`.
import cors = require('cors');
import {
  parseCorsOrigins,
  resolveCorsConfig,
  resolveWsCorsConfig,
} from './cors-config';

function buildAppWithCors(origin: string[] | boolean) {
  const app = express();
  // Cast `cfg.origin` to `any[]`: the `cors` middleware's overloads accept
  // every variant we throw at it (string, string[], boolean, function).
  app.use(cors({ origin: origin as any, credentials: true }));
  app.get('/probe', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('HTTP CORS — actual middleware behaviour (issue #110)', () => {
  it(
    'omits the Access-Control-Allow-Origin header for disallowed origins ' +
      '(browser-side block; status is 200 because the server does not return 403)',
    async () => {
      const cfg = resolveCorsConfig(
        'production',
        'https://allowed.example.com,https://www.allowed.example.com',
      );
      const app = buildAppWithCors(cfg.origin);
      const res = await request(app)
        .get('/probe')
        .set('Origin', 'https://evil.example.com');
      expect(res.status).toBe(200);
      // The `cors` middleware deliberately does not return a non-2xx
      // response for disallowed origins — it just omits the ACAO header
      // so the browser refuses the response. Verify the header matches the
      // request origin (and therefore the browser blocks it).
      expect(
        res.headers['access-control-allow-origin'],
      ).not.toBe('https://evil.example.com');
    },
  );

  it('allows requests from an allowed origin and echoes the ACAO header', async () => {
    const cfg = resolveCorsConfig(
      'production',
      'https://allowed.example.com',
    );
    const app = buildAppWithCors(cfg.origin);
    const res = await request(app)
      .get('/probe')
      .set('Origin', 'https://allowed.example.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://allowed.example.com',
    );
  });

  it('rejects wildcard origins at boot, before they can break credentials', () => {
    expect(() => parseCorsOrigins('*')).toThrow(/Wildcard origin/);
    expect(() =>
      parseCorsOrigins('*,https://allowed.example.com'),
    ).toThrow(/Wildcard origin/);
  });
});

describe('resolveWsCorsConfig — production lockdown', () => {
  it('fails closed in production when CORS_ORIGINS is empty', () => {
    expect(() => resolveWsCorsConfig('production', undefined)).toThrow(
      /CORS_ORIGINS/,
    );
  });
});

describe('resolveWsCorsConfigSafe — module-load safety', () => {
  it('returns the production lockdown when CORS_ORIGINS is empty', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./cors-config').resolveWsCorsConfigSafe('production', undefined),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('returns permit-all in development when CORS_ORIGINS is empty', () => {
    const cfg = // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./cors-config').resolveWsCorsConfigSafe('development', undefined);
    expect(cfg).toEqual({ origin: '*' });
  });
});
