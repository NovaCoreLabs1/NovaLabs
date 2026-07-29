/// <reference types="jest" />

// ---------------------------------------------------------------------------
// Adversarial fuzz test for POST /auth/login
//
// Sends a configurable number of random payloads to the login endpoint and
// asserts that the 5xx error rate stays below 0.05% (the acceptance
// threshold from issue #149).
//
// Usage:
//   FUZZ_ITERATIONS=50000 npx jest --config ./jest-fuzz.json
//
// Default iteration count is 5 000 so the suite completes quickly in CI.
// ---------------------------------------------------------------------------

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';

// ---------------------------------------------------------------------------
// Payload generators
// ---------------------------------------------------------------------------

const chars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~\n\r\t ';

function randomString(minLen: number, maxLen: number): string {
  const len = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** Generates a single random login payload. */
function randomLoginPayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // 80% chance of including 'email' — sometimes omit it entirely
  if (Math.random() < 0.8) {
    const r = Math.random();
    if (r < 0.5) {
      payload.email = `user${Math.floor(Math.random() * 1_000_000)}@example.com`;
    } else if (r < 0.8) {
      payload.email = randomString(1, 200); // malformed email
    } else {
      payload.email = null; // null email
    }
  }

  // 90% chance of including 'password' — sometimes omit it
  if (Math.random() < 0.9) {
    const r = Math.random();
    if (r < 0.3) {
      payload.password = randomString(8, 128); // plausible password
    } else if (r < 0.6) {
      payload.password = randomString(0, 7); // too short
    } else if (r < 0.8) {
      payload.password = randomString(1000, 5000); // very long
    } else {
      payload.password = { nested: 'object' }; // wrong type
    }
  }

  // 30% chance of rememberMe, with various types
  if (Math.random() < 0.3) {
    const r = Math.random();
    if (r < 0.5) {
      payload.rememberMe = Math.random() < 0.5;
    } else if (r < 0.8) {
      payload.rememberMe = randomString(1, 20);
    } else {
      payload.rememberMe = Math.floor(Math.random() * 100);
    }
  }

  // 10% chance of extra unknown keys
  if (Math.random() < 0.1) {
    payload[randomString(3, 20)] = randomString(1, 500);
  }

  // 5% chance of SQL-injection-looking strings
  if (Math.random() < 0.05) {
    payload.email = "' OR 1=1 --";
  }

  // 5% chance of very large payload
  if (Math.random() < 0.05) {
    payload[randomString(10, 30)] = randomString(5000, 10000);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Mock AuthService
// ---------------------------------------------------------------------------

const mockAuthService = {
  login: jest.fn(),
};

/**
 * Builds a slim NestJS application with just the auth controller wired up.
 * No database, no Redis, no third-party services — just the HTTP stack and
 * validation pipe (to test real class-validator behaviour under load).
 */
async function buildTestApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: mockAuthService }],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      // Return 400 on validation failure instead of 500
      errorHttpStatusCode: 400,
    }),
  );
  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /auth/login — adversarial fuzz', () => {
  let app: INestApplication;
  const iterations =
    parseInt(process.env.FUZZ_ITERATIONS ?? '5000', 10) || 5000;

  beforeAll(async () => {
    app = await buildTestApp();

    // Default mock: accept a valid-looking login, reject missing credentials
    // with a proper NestJS HttpException so Nest translates it to HTTP 401.
    mockAuthService.login.mockImplementation((dto: any) => {
      if (!dto?.email || !dto?.password) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return { accessToken: 'mock-token', user: { id: 'u1' } };
    });
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it(
    `sends ${iterations.toLocaleString()} random payloads and keeps 5xx < 0.05%`,
    async () => {
      const server = app.getHttpServer();
      let fivexx = 0;
      let total = 0;

      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        const payload = randomLoginPayload();

        try {
          const res = await request(server)
            .post('/auth/login')
            .send(payload)
            .set('Content-Type', 'application/json');

          total++;
          if (res.status >= 500) {
            fivexx++;
            // Log first few 5xx for debugging
            if (fivexx <= 10) {
              console.error(
                `[FUZZ] 5xx #${fivexx}: status=${res.status}, payload=${JSON.stringify(payload).slice(0, 200)}`,
              );
            }
          }
        } catch (err: any) {
          total++;
          // Connection-level errors (e.g. payload too large) count too
          if (err?.status === undefined || err?.status >= 500) {
            fivexx++;
          }
        }

        // Progress indicator every 5000 iterations
        if ((i + 1) % 5000 === 0) {
          console.log(
            `[FUZZ] ${(i + 1).toLocaleString()}/${iterations.toLocaleString()} — 5xx: ${fivexx}, elapsed: ${((Date.now() - start) / 1000).toFixed(1)}s`,
          );
        }
      }

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const rate = total > 0 ? (fivexx / total) * 100 : 0;

      console.log(
        `\n[FUZZ] Done. ${total} requests in ${elapsed}s | 5xx: ${fivexx} (${rate.toFixed(4)}%)`,
      );

      // Acceptance criterion: 5xx error rate must be < 0.05%
      expect(rate).toBeLessThan(0.05);
    },
    180_000,
  );

  it('handles an empty body without crashing (5xx)', async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post('/auth/login')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBeLessThan(500);
  });

  it('handles a null body without crashing (5xx)', async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post('/auth/login')
      .send(null)
      .set('Content-Type', 'application/json');

    expect(res.status).toBeLessThan(500);
  });

  it('handles a huge JSON payload without crashing (5xx)', async () => {
    const server = app.getHttpServer();
    const hugeEmail = 'x'.repeat(500000) + '@example.com';
    const res = await request(server)
      .post('/auth/login')
      .send({ email: hugeEmail, password: 'validpassword123' })
      .set('Content-Type', 'application/json');

    // Express may return 413 (Payload Too Large) or 400 — just not 5xx
    expect(res.status).toBeLessThan(500);
  });

  it('handles non-JSON Content-Type gracefully (no 5xx)', async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post('/auth/login')
      .send('this is not json at all')
      .set('Content-Type', 'text/plain');

    expect(res.status).toBeLessThan(500);
  });
});
