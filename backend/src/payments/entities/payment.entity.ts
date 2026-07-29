import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Hub } from '../../hub/entities/hub.entity';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

/**
 * TypeORM entity representing a payment record in the system.
 * Stores payment details including provider info, amount, status, and timestamps.
 * Indexed on bookingId, userId, and providerReference for fast lookups.
 */
@Entity('payments')
@Index(['bookingId'])
@Index(['userId'])
@Index(['providerReference'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Amount in kobo
  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider;

  @Column({ nullable: true })
  providerReference: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  hubId: string;

  @ManyToOne(() => Hub, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hubId' })
  hub: Hub;
}
