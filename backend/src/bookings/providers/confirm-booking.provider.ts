import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { User } from '../../users/entities/user.entity';
import { MembershipStatus } from '../../users/enums/membership-status.enum';

/**
 * Activates a user's membership on their first confirmed booking.
 * Shared with ReactivateExpiredBookingProvider so an expired-then-paid
 * booking gets the exact same membership semantics as a normal confirmation.
 */
export async function activateMembershipIfNeeded(
  usersRepository: Repository<User>,
  userId: string | null,
): Promise<void> {
  if (!userId) return;
  const user = await usersRepository.findOne({ where: { id: userId } });
  if (user && !user.memberSince) {
    user.memberSince = new Date();
    user.membershipStatus = MembershipStatus.ACTIVE;
    await usersRepository.save(user);
  }
}

@Injectable()
export class ConfirmBookingProvider {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async confirm(bookingId: string): Promise<Booking> {
    // Atomic transition: PENDING → CONFIRMED with a conditional UPDATE.
    // This is defense-in-depth alongside the atomic payment transition in
    // HandleWebhookProvider — if two webhook deliveries both attempt to
    // confirm the same booking, only one succeeds at the storage level.
    const result = await this.bookingsRepository
      .createQueryBuilder()
      .update(Booking)
      .set({ status: BookingStatus.CONFIRMED })
      .where('id = :id AND status = :status', {
        id: bookingId,
        status: BookingStatus.PENDING,
      })
      .execute();

    if (result.affected === 0) {
      // Re-read to determine current state.
      const current = await this.bookingsRepository.findOne({
        where: { id: bookingId },
      });
      if (!current) {
        throw new NotFoundException(`Booking "${bookingId}" not found`);
      }
      if (current.status === BookingStatus.CONFIRMED) {
        // Already confirmed by a concurrent delivery — idempotent success.
        return current;
      }
      throw new BadRequestException(
        `Only PENDING bookings can be confirmed (current: ${current.status})`,
      );
    }

    // Atomic update succeeded — read back the full entity for the return value
    // (the UPDATE query doesn't populate the entity).
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking "${bookingId}" not found`);
    }

    // Activate member and set memberSince if first booking
    await activateMembershipIfNeeded(this.usersRepository, booking.userId);

    return booking;
  }
}
