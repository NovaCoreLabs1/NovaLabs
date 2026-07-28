import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../../users/providers/users.service';

/**
 * Defensive scheduled sweep that ensures anonymised-user invariants hold
 * even if a future code path alters the synchronously-deleted lifecycle:
 *
 *   1. Refresh tokens belonging to any user with `isDeleted=true` are
 *      hard-deleted.
 *   2. Workspace-log rows belonging to any user with `isDeleted=true` are
 *      hard-deleted (biometric-tied data must NOT linger).
 *
 * The actual `DELETE /users/me` flow runs these steps inside the same
 * transaction as the anonymisation, so this cron is purely a safety net.
 *
 * Schedule: daily at 03:00 UTC (one hour after the existing security IP
 * log purge at 02:00 UTC).
 */
@Injectable()
export class AnonymisationHardeningCron {
  private readonly logger = new Logger(AnonymisationHardeningCron.name);

  constructor(private readonly usersService: UsersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    this.logger.log('Starting anonymisation hardening sweep');
    try {
      const purged = await this.usersService.hardenAnonymisedAccounts();
      this.logger.log(
        `Anonymisation hardening sweep complete — ` +
          `purged ${purged.refreshTokens} refresh token(s), ` +
          `purged ${purged.workspaceLogs} workspace log(s)`,
      );
    } catch (error) {
      this.logger.error(
        `Anonymisation hardening sweep failed: ${error.message}`,
      );
    }
  }
}
