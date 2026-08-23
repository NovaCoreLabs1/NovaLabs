import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { JwtPayload } from '../auth/interface/user.interface';
import { UserRole } from '../users/enums/userRoles.enum';

const ADMIN_ROLES = new Set<string>([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

/**
 * Dual-audience gate for `GET /api/metrics`.
 *
 * The global `JwtAuthGuard` is skipped via `@Public()` so a Prometheus
 * scraper (which has no NovaLabs JWT) is not rejected before this guard
 * runs. Access is then granted by **either**:
 *
 * 1. A bearer token matching `METRICS_SCRAPE_TOKEN` (or alias
 *    `METRICS_TOKEN`) — the Prometheus `bearer_token` / `bearer_token_file`
 *    scrape credential; or
 * 2. A valid access JWT whose `role` is `admin` or `super_admin`.
 *
 * The endpoint fails closed: if the scrape token is unset/blank **and**
 * the JWT cannot be verified (missing `JWT_SECRET`, invalid token, or
 * non-admin role), the request is rejected. There is no anonymous path.
 *
 * A reverse-proxy IP allow-list is a valid *additional* control but is
 * not implemented here (infra, not repo).
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const presented = extractBearerToken(request);
    const scrapeToken = this.configuredScrapeToken();

    if (scrapeToken && presented && safeEqual(presented, scrapeToken)) {
      return true;
    }

    if (!presented) {
      throw new UnauthorizedException('Invalid metrics scrape credentials');
    }

    const jwtSecret = this.config.get<string>('JWT_SECRET')?.trim();
    if (!jwtSecret) {
      throw new UnauthorizedException('Invalid metrics scrape credentials');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(presented, {
        secret: jwtSecret,
        issuer: this.config.get<string>('JWT_ISSUER') || 'novalabs',
        audience: this.config.get<string>('JWT_AUDIENCE') || 'novalabs-api',
      });
    } catch {
      throw new UnauthorizedException('Invalid metrics scrape credentials');
    }

    if (ADMIN_ROLES.has(payload.role ?? '')) {
      return true;
    }

    throw new ForbiddenException('Insufficient role to read metrics');
  }

  /**
   * Canonical env: `METRICS_SCRAPE_TOKEN`. `METRICS_TOKEN` is accepted as
   * an alias. Whitespace-only values are treated as unset (fail closed).
   */
  private configuredScrapeToken(): string {
    const canonical = this.config.get<string>('METRICS_SCRAPE_TOKEN')?.trim();
    if (canonical) {
      return canonical;
    }
    return this.config.get<string>('METRICS_TOKEN')?.trim() ?? '';
  }
}

function extractBearerToken(request: Request): string {
  const header = request.headers.authorization;
  if (!header || typeof header !== 'string') {
    return '';
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return '';
  }
  return token;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
