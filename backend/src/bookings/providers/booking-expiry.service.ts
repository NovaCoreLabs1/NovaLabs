import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';
import { PlanType } from '../enums/plan-type.enum';
import { BookingExpiryPolicy } from './booking-expiry.policy';

export interface ExpirySweepResult {
  expiredBookings: number;
  releasedPayments: number;
}

/**
 * Scheduled sweep that retires abandoned PENDING bookings.
 *
 * A booking becomes stale when its effective payment deadline (stamped
 * `paymentDeadline`, or `createdAt + plan TTL` for legacy rows) has passed.
 * Stale bookings are moved to EXPIRED — which removes them from the
 * seat-overlap sums in both booking-creation paths — and their still-PENDING
 * payments are marked FAILED so the payments table does not accrue dead
 * pending records.
 *
 * Idempotency & concurrency: every UPDATE re-checks the source status inside
 * the same statement, so a `charge.success` webhook confirming the booking
 * concurrently wins the race and the sweep leaves that row untouched; a sweep
 * re-run over already-expired rows matches nothing. Both writes run in one
 * transaction so a booking is never EXPIRED while its payment stays PENDING
 * (or vice versa).
 *
 * Schedule: hourly — bounds how long an abandoned checkout can hold a seat.
 * The @nestjs/schedule module is bootstrapped via ScheduleModule.forRoot()
 * in AppModule (same pattern as AuditLogPurgeService).
 */
@Injectable()
export class BookingExpiryService {
  private readonly logger = new Logger(BookingExpiryService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly expiryPolicy: BookingExpiryPolicy,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweepAbandonedBookings(): Promise<void> {
    try {
      const result = await this.expireStalePendingBookings();
      if (result.expiredBookings > 0) {
        this.logger.log(
          `Booking expiry sweep: expired ${result.expiredBookings} booking(s), released ${result.releasedPayments} pending payment(s)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Booking expiry sweep failed: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Transitions every overdue PENDING booking to EXPIRED and releases its
   * seats. Safe to call repeatedly; returns the number of rows changed, so an
   * immediate second invocation reports zero for both counters.
   */
  async expireStalePendingBookings(): Promise<ExpirySweepResult> {
    const now = new Date();
    let expiredBookings = 0;
    let releasedPayments = 0;

    // One guarded update batch per plan keeps the per-plan TTL semantics
    // exact, including legacy rows without a stamped deadline.
    for (const planType of Object.values(PlanType)) {
      const pendingBookings = await this.bookingsRepository.find({
        where: { status: BookingStatus.PENDING, planType },
      });

      const staleIds = pendingBookings
        .filter(
          (booking) =>
            this.expiryPolicy.effectiveDeadline(booking).getTime() <=
            now.getTime(),
        )
        .map((booking) => booking.id);

      if (staleIds.length === 0) {
        continue;
      }

      const planResult = await this.dataSource.transaction(async (manager) => {
        // The status guard makes concurrent webhook confirmations win:
        // a booking confirmed between the SELECT above and this UPDATE no
        // longer matches and keeps its CONFIRMED status.
        const bookingUpdate = await manager
          .createQueryBuilder()
          .update(Booking)
          .set({ status: BookingStatus.EXPIRED })
          .where('id IN (:...ids)', { ids: staleIds })
          .andWhere('status = :status', { status: BookingStatus.PENDING })
          .execute();

        const paymentUpdate = await manager
          .createQueryBuilder()
          .update(Payment)
          .set({ status: PaymentStatus.FAILED })
          .where('"bookingId" IN (:...ids)', { ids: staleIds })
          .andWhere('status = :status', { status: PaymentStatus.PENDING })
          .execute();

        return {
          expiredBookings: bookingUpdate.affected ?? 0,
          releasedPayments: paymentUpdate.affected ?? 0,
        };
      });

      expiredBookings += planResult.expiredBookings;
      releasedPayments += planResult.releasedPayments;
    }

    return { expiredBookings, releasedPayments };
  }
}
