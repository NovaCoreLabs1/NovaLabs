import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SecurityIpLogService } from './security-ip-log.service';

/**
 * Scheduled service that periodically purges expired rows from the
 * security_ip_log table.
 *
 * Schedule: daily at 02:00 UTC (low-traffic window).
 * The @nestjs/schedule module must be bootstrapped via ScheduleModule.forRoot()
 * in AppModule — it already is.
 */
@Injectable()
export class AuditLogPurgeService {
  private readonly logger = new Logger(AuditLogPurgeService.name);

  constructor(private readonly securityIpLogService: SecurityIpLogService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredSecurityIpLogs(): Promise<void> {
    this.logger.log('Starting security IP log purge job');
    try {
      const deleted = await this.securityIpLogService.purgeExpired();
      this.logger.log(
        `Security IP log purge complete — deleted ${deleted} row(s)`,
      );
    } catch (error) {
      this.logger.error(`Security IP log purge failed: ${error.message}`);
    }
  }
}
