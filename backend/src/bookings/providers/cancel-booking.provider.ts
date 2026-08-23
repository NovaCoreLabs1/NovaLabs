import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { UserRole } from '../../users/enums/userRoles.enum';
import { User } from '../../users/entities/user.entity';
import { EmailService } from '../../email/email.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';

@Injectable()
export class CancelBookingProvider {
  private readonly logger = new Logger(CancelBookingProvider.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async cancel(
    bookingId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking "${bookingId}" not found`);
    }

    const isAdmin =
      userRole === UserRole.ADMIN ||
      userRole === UserRole.SUPER_ADMIN ||
      userRole === UserRole.STAFF;

    if (!isAdmin && booking.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Only PENDING or CONFIRMED bookings can be cancelled',
      );
    }

    booking.status = BookingStatus.CANCELLED;
    const saved = await this.bookingsRepository.save(booking);

    // Fire-and-forget cancellation email; every failure path is logged
    void Promise.all([
      this.usersRepository.findOne({ where: { id: saved.userId } }),
      this.workspacesService.findById(saved.workspaceId),
    ])
      .then(async ([user, workspace]) => {
        if (!user || !workspace) return;
        const cancelledBy =
          saved.userId === userId ? user.fullName : 'Administrator';
        const emailed = await this.emailService.sendBookingCancelledEmail(
          user.email,
          user.fullName,
          {
            bookingId: saved.id,
            workspaceName: workspace.name,
            startDate: saved.startDate,
            endDate: saved.endDate,
            cancelledBy,
          },
        );
        if (!emailed) {
          this.logger.warn(
            `Failed to queue booking-cancelled email for booking ${saved.id}`,
          );
        }
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to send booking-cancelled email for booking ${saved.id}: ${err.message}`,
        ),
      );

    return saved;
  }
}
