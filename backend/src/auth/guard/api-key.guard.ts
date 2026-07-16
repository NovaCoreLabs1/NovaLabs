import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';

import { ApiKeyEntity, ApiKeyScope } from '../entities/api-key.entity';
import { ApiKeyAuditLogEntity } from '../entities/api-key-audit.entity';
import { SCOPES_KEY } from '../decorators/required-scopes.decorator';

/**
 * ApiKeyGuard
 *
 * Validates the `X-API-Key` header for service-to-service / cron traffic.
 * This guard is intentionally separate from JwtAuthGuard — apply it only
 * to routes that background jobs or external services must reach.
 *
 * Flow:
 *   1. Extract raw key from `X-API-Key` header.
 *   2. Derive prefix (first 8 chars) and look up the row by prefix.
 *   3. bcrypt.compare the full raw key against the stored hash.
 *   4. Check revocation and expiry.
 *   5. Enforce @RequiredScopes() if declared on the handler/controller.
 *   6. Append an audit log entry (key_id + endpoint).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(ApiKeyAuditLogEntity)
    private readonly auditRepo: Repository<ApiKeyAuditLogEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const rawKey = this.extractKey(request);
    if (!rawKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    // Derive prefix for efficient lookup (avoids full-table hash scan)
    const prefix = rawKey.substring(0, 8);

    const apiKey = await this.apiKeyRepo.findOne({ where: { prefix } });
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Constant-time comparison to prevent timing attacks
    const valid = await bcrypt.compare(rawKey, apiKey.hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.revoked) {
      throw new UnauthorizedException('API key has been revoked');
    }

    if (apiKey.isExpired) {
      throw new UnauthorizedException('API key has expired');
    }

    // Scope enforcement — read metadata from handler, then controller
    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredScopes && requiredScopes.length > 0) {
      const hasAllScopes = requiredScopes.every((scope) =>
        apiKey.scopes.includes(scope),
      );
      if (!hasAllScopes) {
        throw new ForbiddenException(
          `Insufficient scopes. Required: ${requiredScopes.join(', ')}`,
        );
      }
    }

    // Attach key to request for downstream use if needed
    (request as any).apiKey = apiKey;

    // Audit log — fire-and-forget (don't block the request on a log write)
    this.writeAuditLog(apiKey.id, request).catch(() => {
      // Swallow audit failures — never block the authenticated request
    });

    return true;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private extractKey(request: Request): string | null {
    const header = request.headers['x-api-key'];
    if (!header) return null;
    return Array.isArray(header) ? header[0] : header;
  }

  private async writeAuditLog(keyId: string, request: Request): Promise<void> {
    const endpoint = `${request.method} ${request.path}`;
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip ??
      null;

    await this.auditRepo.save(
      this.auditRepo.create({ keyId, endpoint, ip }),
    );
  }
}