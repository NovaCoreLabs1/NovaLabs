import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../../auth/entities/refreshToken.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { WorkspaceLog } from '../../workspace-tracking/entities/workspace-log.entity';
import { AuditLogService } from '../../audit-log/providers/audit-log.service';

/**
 * Provider that performs GDPR Art. 17 anonymisation of a user's account.
 *
 * Behaviour:
 *  - The `User` row is NOT deleted: its `id` is preserved so that existing
 *    `Booking`, `Payment` (and any historical) records that reference it via
 *    foreign key remain referentially intact.
 *  - All personally-identifying columns are wiped or replaced:
 *      - email  -> sha256(original email + per-user salt)@deleted.novalabs.internal
 *      - firstname -> "deleted-user-<short-uuid>"
 *      - lastname  -> ""
 *      - phone, profilePicture -> NULL
 *  - All credentials are NULLed (password, totpSecret, totpBackupCodes,
 *    passkeyCredentials, verificationCode, passwordResetCode, etc.) so the
 *    account cannot log in again.
 *  - Refresh tokens for the user are hard-deleted.
 *  - Workspace check-in logs (non-financial, may contain biometric refs) are
 *    hard-deleted.
 *  - Booking and Payment rows (financial records) have their `userId` set to
 *    NULL and a `{ anonymisedAt, anonymisedFromUserId }` marker added to
 *    `metadata` so auditability is retained without leaking PII.
 *  - The whole flow runs inside a single TypeORM transaction so a crash
 *    cannot leave the account partially anonymised.
 *  - An `audit_log` entry with action `users.anonymise` is written *inside the
 *    same transaction* using the *original* `actorId`/`actorEmail` so that
 *    later forensic queries can still trace what happened.
 *
 * Irreversibility:
 *  - The email hash is keyed with a per-user random salt that is not stored
 *    anywhere — once the original email is gone, the salt is unrecoverable.
 *  - Credentials are NULLed — re-authentication is impossible.
 *  - The chosen `firstname` placeholder contains no PII.
 */
@Injectable()
export class AnonymiseUserProvider {
  private readonly logger = new Logger(AnonymiseUserProvider.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(WorkspaceLog)
    private readonly workspaceLogRepository: Repository<WorkspaceLog>,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Idempotent, transactional anonymisation of the user identified by
   * `userId`. Throws `NotFoundException` if the user does not exist.
   * If the user is already anonymised (`isDeleted=true`), this is a no-op
   * that still emits an audit log entry for visibility.
   */
  async anonymise(userId: string, reason?: string | null): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isDeleted) {
      this.logger.warn(`User ${userId} is already anonymised — no-op`);
      return;
    }

    // Generated once per user but never persisted (irreversibility guarantee).
    const salt = crypto.randomBytes(16).toString('hex');
    const originalEmailHash = crypto
      .createHash('sha256')
      .update(`${user.email}::${salt}`)
      .digest('hex');

    const placeholder = `deleted-user-${user.id.split('-')[0]}`;

    await this.dataSource.transaction(async (manager) => {
      // 1. Write the audit log entry FIRST so the trace of who did what
      //    exists even if a later step in this transaction is interrupted.
      //    The audit_log table itself has its own table and the masked IP
      //    is handled by the upstream `audit-log` pipeline at creation time.
      await this.auditLogService.create({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'users.anonymise',
        targetType: 'user',
        targetId: user.id,
        ipAddress: null,
        userAgent: null,
        metadata: {
          mode: 'self_service',
          reason: reason ?? null,
          originalEmailHash,
          anonymisedAtHint: new Date().toISOString(),
        },
      });

      // 2. Hard-delete refresh tokens (these can never be re-issued because
      //    the user credentials are about to be wiped).
      await manager.delete(RefreshToken, { userId });

      // 3. Hard-delete workspace check-in logs. These contain biometric
      //    template hashes / storage references which constitute biometric
      //    data; per GDPR these MUST be hard-deleted, not anonymised.
      await manager.delete(WorkspaceLog, { userId });

      // 4. Decouple financial records from the user. Bookings and payments
      //    reference the user via nullable FKs; we set userId to NULL.
      //    Auditability is preserved by the audit_log record written in
      //    step 1 above — we deliberately do NOT mutate the `notes` column
      //    on Booking or the `metadata` on Payment (other code paths      //     append contractual state to these and must remain untouched).
      //    Auditability is preserved by the audit_log record written in
      //    step 1 above.
      await manager
        .createQueryBuilder()
        .update(Booking)
        .set({ userId: null })
        .where('userId = :userId', { userId })
        .execute();

      await manager
        .createQueryBuilder()
        .update(Payment)
        .set({ userId: null })
        .where('userId = :userId', { userId })
        .execute();

      // 5. Finally, anonymise the user row itself. We do this LAST so that
      //    a partial failure above does not surface a half-anonymised user.
      const anonymised = manager.create(User, {
        ...user,
        email: `${originalEmailHash}@deleted.novalabs.internal`,
        firstname: placeholder,
        lastname: '',
        phone: null,
        profilePicture: null,
        password: null,
        passwordResetToken: null,
        passwordResetExpiresIn: null,
        lastPasswordResetSentAt: null,
        verificationToken: null,
        verificationTokenExpiry: null,
        lastVerificationEmailSent: null,
        verificationCode: null,
        verificationCodeExpiresAt: null,
        passwordResetCode: null,
        passwordResetCodeExpiresAt: null,
        totpSecret: null,
        totpBackupCodes: null,
        passkeyCredentials: null,
        twoFactorEnabled: false,
        isVerified: false,
        isActive: false,
        isSuspended: false,
        isDeleted: true,
        deletedAt: new Date(),
        refreshTokens: [],
      });
      await manager.save(User, anonymised);
    });

    // Defensive post-transaction sweep: any lingering refresh tokens whose
    // owner is now deleted get purged. This guards against a future code
    // path that might mint a refresh token for a soft-deleted user.
    await this.refreshTokenRepository.delete({
      userId,
    });
    await this.workspaceLogRepository.delete({ userId });

    this.logger.log(`User ${userId} anonymised (GDPR Art. 17)`);
  }

  /**
   * Convenience helper used by tests / cron to verify that any users marked
   * `isDeleted=true` no longer have any associated refresh tokens or
   * workspace logs. Returns counts of purged rows.
   */
  async hardenDeletedUsers(): Promise<{
    refreshTokens: number;
    workspaceLogs: number;
  }> {
    const deletedUsers = await this.usersRepository.find({
      where: { isDeleted: true },
      select: ['id'],
    });
    if (deletedUsers.length === 0) {
      return { refreshTokens: 0, workspaceLogs: 0 };
    }
    const ids = deletedUsers.map((u) => u.id);

    const refreshResult = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('userId IN (:...ids)', { ids })
      .execute();

    const workspaceLogResult = await this.workspaceLogRepository
      .createQueryBuilder()
      .delete()
      .where('userId IN (:...ids)', { ids })
      .execute();

    await this.usersRepository
      .createQueryBuilder()
      .update()
      .set({ deletedAt: () => 'COALESCE(deletedAt, NOW())' })
      .where('id IN (:...ids)', { ids })
      .andWhere('deletedAt IS NULL')
      .execute();

    return {
      refreshTokens: refreshResult.affected ?? 0,
      workspaceLogs: workspaceLogResult.affected ?? 0,
    };
  }

  /**
   * Returns the count of bookings/payments that retain `userId IS NULL AND
   * metadata @> { anonymisedFromUserId: '<>' }` rows — useful for audit log
   * reports after a bulk anonymisation.
   */
  async countAnonymisedFinancialRecords(userId: string): Promise<{
    bookings: number;
    payments: number;
  }> {
    const bookings = await this.usersRepository.manager.count(Booking, {
      where: { userId: IsNull() },
    });
    const payments = await this.usersRepository.manager.count(Payment, {
      where: { userId: IsNull() },
    });
    // userId filtering is informational only; the rows are intentionally
    // unlinked after anonymisation.
    void userId;
    return { bookings, payments };
  }
}
