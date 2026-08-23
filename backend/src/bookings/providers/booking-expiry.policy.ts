import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanType } from '../enums/plan-type.enum';

/**
 * Default payment window (in minutes) for each plan, measured from booking
 * creation. A DAILY day-pass checkout is expected to complete within the
 * hour, while a YEARLY booking may involve procurement-style approval and
 * therefore gets a full 72 hours.
 */
export const DEFAULT_PAYMENT_TTL_MINUTES: Record<PlanType, number> = {
  [PlanType.DAILY]: 60,
  [PlanType.WEEKLY]: 360,
  [PlanType.MONTHLY]: 1440,
  [PlanType.QUARTERLY]: 2880,
  [PlanType.YEARLY]: 4320,
};

const MIN_TTL_MINUTES = 1;

/**
 * Single source of truth for when a PENDING booking's payment deadline lies.
 *
 * Consumed by both booking-creation paths (which stamp `paymentDeadline`) and
 * by BookingExpiryService (which sweeps overdue PENDING bookings). Keeping it
 * injectable lets deployments tune TTLs per plan via env vars without code
 * changes, while the defaults live in one reviewed constant table.
 */
@Injectable()
export class BookingExpiryPolicy {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Absolute deadline for a booking of `planType` created at `from`.
   */
  deadlineFor(planType: PlanType, from: Date = new Date()): Date {
    const ttlMinutes = this.ttlMinutesFor(planType);
    return new Date(from.getTime() + ttlMinutes * 60_000);
  }

  /**
   * Deadline that applies to an existing booking row. Rows created before
   * `paymentDeadline` was introduced carry `null` and fall back to
   * `createdAt + plan TTL`, so legacy abandoned bookings expire too without
   * requiring a data backfill.
   */
  effectiveDeadline(booking: {
    planType: PlanType;
    paymentDeadline: Date | null;
    createdAt: Date;
  }): Date {
    return (
      booking.paymentDeadline ??
      this.deadlineFor(booking.planType, booking.createdAt)
    );
  }

  private ttlMinutesFor(planType: PlanType): number {
    const envKey = `BOOKING_PAYMENT_TTL_${planType.toUpperCase()}_MINUTES`;
    const configured = this.configService.get<number | string>(envKey);
    const parsed =
      configured === undefined || configured === null
        ? NaN
        : Number(configured);
    if (Number.isFinite(parsed) && parsed >= MIN_TTL_MINUTES) {
      return Math.floor(parsed);
    }
    return DEFAULT_PAYMENT_TTL_MINUTES[planType];
  }
}
