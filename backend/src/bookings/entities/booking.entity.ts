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
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Hub } from '../../hub/entities/hub.entity';
import { PlanType } from '../enums/plan-type.enum';
import { BookingStatus } from '../enums/booking-status.enum';

@Entity('bookings')
@Index(['userId'])
@Index(['workspaceId'])
@Index(['status'])
@Index(['hubId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'enum', enum: PlanType })
  planType: PlanType;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  // Total amount in kobo
  @Column({ type: 'bigint' })
  totalAmount: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  /**
   * Absolute deadline for the payment of a PENDING booking to arrive before
   * the scheduled sweep moves it to EXPIRED and releases its seats.
   * Nullable because rows created before this column existed have no stamped
   * deadline; the sweep then falls back to `createdAt + plan TTL`.
   */
  @Column({ type: 'timestamptz', nullable: true })
  paymentDeadline: Date | null;

  @Column({ type: 'int', default: 1 })
  seatCount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Populated for MONTHLY/QUARTERLY/YEARLY after Soroban escrow is created
  @Column({ nullable: true })
  sorobanEscrowId: string;

  @Column({ default: false })
  reminderSent: boolean;

  @Column({ default: false })
  isGuestBooking: boolean;

  @Column({ type: 'jsonb', nullable: true })
  guestInfo: { name: string; email: string; phone: string } | null;

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
