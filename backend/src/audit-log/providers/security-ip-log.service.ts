import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SecurityIpLog } from '../entities/security-ip-log.entity';

export interface CreateSecurityIpLogInput {
  auditLogId: string;
  rawIp: string;
  action: string;
}

@Injectable()
export class SecurityIpLogService {
  private readonly logger = new Logger(SecurityIpLogService.name);

  /**
   * Retention window in days.  Defaults to 30 if the env var is absent or
   * cannot be parsed as a positive integer.
   */
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(SecurityIpLog)
    private readonly repo: Repository<SecurityIpLog>,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>('SECURITY_IP_RETENTION_DAYS');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    this.retentionDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }

  /**
   * Persists a raw IP address for a security-flagged audit event.
   * Failures are caught and logged so that a security-log write error never
   * blocks the primary audit log path.
   */
  async create(input: CreateSecurityIpLogInput): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.retentionDays);

      const entry = this.repo.create({
        auditLogId: input.auditLogId,
        rawIp: input.rawIp,
        action: input.action,
        expiresAt,
      });

      await this.repo.save(entry);
    } catch (error) {
      // Non-fatal: the core audit log has already been written.
      this.logger.error(
        `Failed to write security IP log for auditLogId=${input.auditLogId}: ${error.message}`,
      );
    }
  }

  /**
   * Deletes all expired rows.  Called by the purge cron job.
   * Returns the number of deleted rows.
   */
  async purgeExpired(): Promise<number> {
    const result = await this.repo.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }
}
