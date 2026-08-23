import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BookingStatus } from '../enums/booking-status.enum';
import { PricingService } from '../pricing/pricing.service';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';
import { EmailService } from '../../email/email.service';
import { BookingExpiryPolicy } from './booking-expiry.policy';

@Injectable()
export class CreateBookingProvider {
  private readonly logger = new Logger(CreateBookingProvider.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly pricingService: PricingService,
    private readonly expiryPolicy: BookingExpiryPolicy,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateBookingDto, userId: string): Promise<Booking> {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock the workspace row to prevent concurrent seat over-booking
      const workspace = await manager
        .createQueryBuilder(Workspace, 'w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: dto.workspaceId })
        .getOne();

      if (!workspace) {
        throw new NotFoundException(`Workspace "${dto.workspaceId}" not found`);
      }
      if (!workspace.isActive) {
        throw new BadRequestException('Workspace is not active');
      }

      // Conflict check: sum existing confirmed/pending seat counts for overlapping dates
      const overlap = await manager
        .createQueryBuilder(Booking, 'b')
        .select('COALESCE(SUM(b.seatCount), 0)', 'booked')
        .where('b.workspaceId = :workspaceId', {
          workspaceId: dto.workspaceId,
        })
        .andWhere('b.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        })
        .andWhere('b.startDate <= :endDate', { endDate: dto.endDate })
        .andWhere('b.endDate >= :startDate', { startDate: dto.startDate })
        .getRawOne<{ booked: string }>();

      const alreadyBooked = Number(overlap?.booked ?? 0);
      if (alreadyBooked + dto.seatCount > workspace.totalSeats) {
        throw new ConflictException(
          `Only ${workspace.totalSeats - alreadyBooked} seat(s) available for the requested dates`,
        );
      }

      const totalAmount = this.pricingService.calculateAmount(
        Number(workspace.hourlyRate),
        dto.planType,
        dto.seatCount,
        dto.startDate,
        dto.endDate,
      );

      const booking = manager.create(Booking, {
        ...dto,
        userId,
        totalAmount,
        status: BookingStatus.PENDING,
        paymentDeadline: this.expiryPolicy.deadlineFor(dto.planType),
      });

      const saved = await manager.save(booking);

      // Fire-and-forget booking created email; every failure path is logged
      void this.usersRepository
        .findOne({ where: { id: userId } })
        .then(async (user) => {
          if (!user) return;
          const emailed = await this.emailService.sendBookingCreatedEmail(
            user.email,
            user.fullName,
            {
              bookingId: saved.id,
              workspaceName: workspace.name,
              planType: saved.planType,
              startDate: saved.startDate,
              endDate: saved.endDate,
              seatCount: saved.seatCount,
              totalAmountNaira: (totalAmount / 100).toFixed(2),
            },
          );
          if (!emailed) {
            this.logger.warn(
              `Failed to queue booking-created email for booking ${saved.id}`,
            );
          }
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to send booking-created email for booking ${saved.id}: ${err.message}`,
          ),
        );

      return saved;
    });
  }
}
