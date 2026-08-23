import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';

/**
 * Anything that can spawn a `Booking` query builder: a raw connection
 * (`DataSource.manager`, used by read-only availability checks) or the
 * transactional `EntityManager` handed out by `dataSource.transaction`
 * (used by booking creation so the seat math runs under the same
 * pessimistic workspace lock as the write).
 */
export type QuerySource = DataSource | EntityManager;

/**
 * Single source of truth for seat accounting on a workspace.
 *
 * Every caller — authenticated booking creation, public day-pass
 * creation, and the availability endpoint — must derive seat numbers
 * through this routine so the overlap semantics cannot drift between
 * them (issue #229). The math mirrors what booking creation enforces:
 * seats held by any PENDING or CONFIRMED booking whose [startDate,
 * endDate] window overlaps the requested one.
 */
@Injectable()
export class SeatAvailabilityProvider {
  /**
   * Sums `seatCount` across bookings holding seats on the workspace for
   * the requested window. Returns an integer ≥ 0.
   */
  async bookedSeats(
    source: QuerySource,
    workspaceId: string,
    startDate: string | Date,
    endDate: string | Date,
  ): Promise<number> {
    const overlap = await source
      .createQueryBuilder(Booking, 'b')
      .select('COALESCE(SUM(b.seatCount), 0)', 'booked')
      .where('b.workspaceId = :workspaceId', { workspaceId })
      .andWhere('b.status IN (:...statuses)', {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      })
      .andWhere('b.startDate <= :endDate', { endDate })
      .andWhere('b.endDate >= :startDate', { startDate })
      .getRawOne<{ booked: string }>();

    return Number(overlap?.booked ?? 0);
  }

  /**
   * Free seats on the workspace for the window: capacity minus held
   * seats, floored at zero so data anomalies cannot report phantom
   * capacity.
   */
  async availableSeats(
    source: QuerySource,
    workspaceId: string,
    totalSeats: number,
    startDate: string | Date,
    endDate: string | Date,
  ): Promise<number> {
    const booked = await this.bookedSeats(
      source,
      workspaceId,
      startDate,
      endDate,
    );
    return Math.max(0, totalSeats - booked);
  }
}
