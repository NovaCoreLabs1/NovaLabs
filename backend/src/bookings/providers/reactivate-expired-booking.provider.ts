import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';
import { activateMembershipIfNeeded } from './confirm-booking.provider';

/**
 * Re-confirms an EXPIRED booking after its payment arrived late (Paystack
 * retries and slow checkouts can deliver `charge.success` minutes after the
 * sweep released the booking's seat).
 *
 * Deterministic policy: the booking is revived only if its seats are still
 * free. Seat availability is re-checked atomically — under the same
 * pessimistic workspace lock used by both creation paths and against the
 * same PENDING/CONFIRMED overlap sum, excluding this booking itself.
 *
 * Returns the CONFIRMED booking on success, or `null` when the seats have
 * since been taken; callers then record the payment without honouring the
 * booking (refund handling stays with RefundPaymentProvider). Never throws
 * for the "seats gone" case so webhook processing stays non-retryable.
 */
@Injectable()
export class ReactivateExpiredBookingProvider {
  private readonly logger = new Logger(ReactivateExpiredBookingProvider.name);

  constructor(private readonly dataSource: DataSource) {}

  async reactivateExpired(bookingId: string): Promise<Booking | null> {
    return this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
      });
      if (!booking) {
        throw new NotFoundException(`Booking "${bookingId}" not found`);
      }
      if (booking.status !== BookingStatus.EXPIRED) {
        // Confirmed concurrently between payment save and this call — the
        // caller treats it as already-honoured. Anything else is unexpected.
        if (booking.status === BookingStatus.CONFIRMED) {
          return booking;
        }
        throw new NotFoundException(
          `Booking "${bookingId}" is ${booking.status}, expected EXPIRED`,
        );
      }

      const workspace = await manager
        .createQueryBuilder(Workspace, 'w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: booking.workspaceId })
        .getOne();

      if (!workspace) {
        throw new NotFoundException(
          `Workspace "${booking.workspaceId}" not found`,
        );
      }

      // Fresh seat check over live capacity holders only. This booking is
      // EXPIRED here, so it is not part of the sum; exclude it by id anyway
      // to stay correct even if the status guard above ever changes.
      const overlap = await manager
        .createQueryBuilder(Booking, 'b')
        .select('COALESCE(SUM(b.seatCount), 0)', 'booked')
        .where('b.workspaceId = :workspaceId', {
          workspaceId: booking.workspaceId,
        })
        .andWhere('b.id != :excludedId', { excludedId: booking.id })
        .andWhere('b.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        })
        .andWhere('b.startDate <= :endDate', { endDate: booking.endDate })
        .andWhere('b.endDate >= :startDate', { startDate: booking.startDate })
        .getRawOne<{ booked: string }>();

      const alreadyBooked = Number(overlap?.booked ?? 0);
      if (alreadyBooked + booking.seatCount > workspace.totalSeats) {
        this.logger.warn(
          `Late payment for expired booking ${booking.id}: no seats left (${alreadyBooked}/${workspace.totalSeats}) — payment recorded without re-confirmation`,
        );
        return null;
      }

      booking.status = BookingStatus.CONFIRMED;
      const saved = await manager.save(booking);

      // Same membership semantics as a normal confirmation.
      await activateMembershipIfNeeded(
        manager.getRepository(User),
        saved.userId,
      );

      return saved;
    });
  }
}
