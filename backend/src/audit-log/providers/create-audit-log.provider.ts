import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import { SecurityIpLogService } from './security-ip-log.service';
import { maskIp, requiresSecurityRetention } from '../../common/utils/ip.util';

export interface CreateAuditLogInput {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Actions that are considered security-grade events.
 * Raw IPs for these actions are routed to the short-retention
 * security_ip_log table in addition to the masked routine log.
 */
const SECURITY_ACTIONS = new Set<string>([
  AuditAction.LOGIN,
  AuditAction.LOGOUT,
  AuditAction.IMPERSONATE,
  AuditAction.REFRESH_FAMILY_REVOKED,
]);

@Injectable()
export class CreateAuditLogProvider {
  private readonly logger = new Logger(CreateAuditLogProvider.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly securityIpLogService: SecurityIpLogService,
  ) {}

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    try {
      const rawIp = input.ipAddress ?? null;

      // Always store the masked IP in the routine audit log.
      // maskIp returns null for invalid / empty values, which is fine.
      const maskedIp = maskIp(rawIp);

      const log = this.auditLogRepository.create({
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        ipAddress: maskedIp,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ?? null,
      });

      const saved = await this.auditLogRepository.save(log);

      // Write raw IP to the short-retention table when:
      //   (a) a raw IP exists, AND
      //   (b) the action is security-flagged, OR the IP is IPv6 (no masking
      //       semantics defined, so the full value must be handled separately)
      const isSecurityAction = SECURITY_ACTIONS.has(input.action);
      const needsRawRetention =
        rawIp !== null &&
        (isSecurityAction || requiresSecurityRetention(rawIp));

      if (needsRawRetention) {
        // Fire-and-forget; the method catches its own errors internally.
        void this.securityIpLogService.create({
          auditLogId: saved.id,
          rawIp: rawIp as string,
          action: input.action,
        });
      }

      return saved;
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
      throw error;
    }
  }
}
