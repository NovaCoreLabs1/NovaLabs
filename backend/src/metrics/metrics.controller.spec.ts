/// <reference types="jest" />
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PUBLIC } from '../auth/decorators/public.decorator';
import { UserRole } from '../users/enums/userRoles.enum';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsAuthGuard } from './metrics-auth.guard';

// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');

const JWT_SECRET = 'test-jwt-secret-for-metrics-http';
const SCRAPE_TOKEN = 'prometheus-scrape-token-abcdefghijklmnopqrstuvwxyz';
const PROMETHEUS_CONTENT_TYPE = /text\/plain; version=0\.0\.4/;

/**
 * Stands in for the global JwtAuthGuard: honours `@Public()` the same way
 * so these specs prove scrapers are not 401'd by JWT before MetricsAuthGuard
 * runs. Does not invoke Passport.
 */
@Injectable()
class PublicAwareJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    throw new UnauthorizedException();
  }
}

function signRole(role: string): string {
  return new JwtService().sign(
    { sub: 'user-1', email: 'op@novalabs.test', role },
    {
      secret: JWT_SECRET,
      issuer: 'novalabs',
      audience: 'novalabs-api',
    },
  );
}

async function buildApp(
  env: Record<string, string | undefined>,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [JwtModule.register({})],
    controllers: [MetricsController],
    providers: [
      MetricsService,
      MetricsAuthGuard,
      Reflector,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => env[key],
        },
      },
      {
        provide: APP_GUARD,
        useFactory: (reflector: Reflector) =>
          new PublicAwareJwtGuard(reflector),
        inject: [Reflector],
      },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

describe('GET /api/metrics (access modes)', () => {
  describe('scrape token + JWT secret configured', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp({
        METRICS_SCRAPE_TOKEN: SCRAPE_TOKEN,
        JWT_SECRET,
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows a Prometheus scraper presenting the configured token and returns text/plain; version=0.0.4', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/metrics')
        .set('Authorization', `Bearer ${SCRAPE_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(PROMETHEUS_CONTENT_TYPE);
      expect(res.text).toContain('novalabs_');
    });

    it('rejects unauthenticated requests without a scrape credential', async () => {
      const res = await request(app.getHttpServer()).get('/api/metrics');
      expect(res.status).toBe(401);
    });

    it('rejects a regular USER JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/metrics')
        .set('Authorization', `Bearer ${signRole(UserRole.USER)}`);

      expect(res.status).toBe(403);
    });

    it('allows an admin JWT and keeps the Prometheus content-type', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/metrics')
        .set('Authorization', `Bearer ${signRole(UserRole.ADMIN)}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(PROMETHEUS_CONTENT_TYPE);
      expect(res.text).toContain('novalabs_');
    });
  });

  describe('both credential paths misconfigured', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp({
        METRICS_SCRAPE_TOKEN: '',
        JWT_SECRET: undefined,
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('fails closed (401) even when a bearer token is presented', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/metrics')
        .set('Authorization', `Bearer ${signRole(UserRole.ADMIN)}`);

      expect(res.status).toBe(401);
    });
  });
});
