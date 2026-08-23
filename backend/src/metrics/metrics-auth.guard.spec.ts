/// <reference types="jest" />
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { UserRole } from '../users/enums/userRoles.enum';

const JWT_SECRET = 'test-jwt-secret-for-metrics-guard';
const SCRAPE_TOKEN = 'prometheus-scrape-token-abcdefghijklmnopqrstuvwxyz';

function mockConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
}

function contextWithAuth(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authorization ? { authorization } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

function signRole(role: string, secret = JWT_SECRET): string {
  return new JwtService().sign(
    { sub: 'user-1', email: 'op@novalabs.test', role },
    {
      secret,
      issuer: 'novalabs',
      audience: 'novalabs-api',
    },
  );
}

describe('MetricsAuthGuard', () => {
  const jwtService = new JwtService();

  describe('scrape token configured', () => {
    const guard = new MetricsAuthGuard(
      mockConfig({
        METRICS_SCRAPE_TOKEN: SCRAPE_TOKEN,
        JWT_SECRET,
      }),
      jwtService,
    );

    it('allows a matching scrape bearer token', async () => {
      await expect(
        guard.canActivate(contextWithAuth(`Bearer ${SCRAPE_TOKEN}`)),
      ).resolves.toBe(true);
    });

    it('rejects a request with no token', async () => {
      await expect(guard.canActivate(contextWithAuth())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a regular USER JWT', async () => {
      const token = signRole(UserRole.USER);
      await expect(
        guard.canActivate(contextWithAuth(`Bearer ${token}`)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an admin JWT', async () => {
      const token = signRole(UserRole.ADMIN);
      await expect(
        guard.canActivate(contextWithAuth(`Bearer ${token}`)),
      ).resolves.toBe(true);
    });

    it('allows a super_admin JWT', async () => {
      const token = signRole(UserRole.SUPER_ADMIN);
      await expect(
        guard.canActivate(contextWithAuth(`Bearer ${token}`)),
      ).resolves.toBe(true);
    });

    it('rejects a STAFF JWT', async () => {
      const token = signRole(UserRole.STAFF);
      await expect(
        guard.canActivate(contextWithAuth(`Bearer ${token}`)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a wrong scrape token', async () => {
      await expect(
        guard.canActivate(contextWithAuth('Bearer totally-wrong-token')),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts METRICS_TOKEN as an alias when METRICS_SCRAPE_TOKEN is unset', async () => {
      const aliasGuard = new MetricsAuthGuard(
        mockConfig({
          METRICS_TOKEN: SCRAPE_TOKEN,
          JWT_SECRET,
        }),
        jwtService,
      );
      await expect(
        aliasGuard.canActivate(contextWithAuth(`Bearer ${SCRAPE_TOKEN}`)),
      ).resolves.toBe(true);
    });
  });

  describe('fail closed when both credential paths are misconfigured', () => {
    const guard = new MetricsAuthGuard(
      mockConfig({
        METRICS_SCRAPE_TOKEN: '   ',
        JWT_SECRET: undefined,
      }),
      jwtService,
    );

    it('rejects unauthenticated traffic', async () => {
      await expect(guard.canActivate(contextWithAuth())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a presented bearer token that cannot be verified', async () => {
      const token = signRole(UserRole.ADMIN);
      await expect(
        guard.canActivate(contextWithAuth(`Bearer ${token}`)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
