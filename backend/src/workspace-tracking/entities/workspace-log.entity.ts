import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Booking } from '../../bookings/entities/booking.entity';

/**
 * TypeORM entity representing a workspace check-in/check-out log.
 * Tracks user presence in workspaces, including session duration and optional booking linkage.
 * Indexed on workspaceId+checkedInAt and userId+checkedInAt for efficient querying.
 */
@Entity('workspace_logs')
@Index(['workspaceId', 'checkedInAt'])
@Index(['userId', 'checkedInAt'])
export class WorkspaceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column('uuid', { nullable: true })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @CreateDateColumn({ type: 'timestamptz' })
  checkedInAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  checkedOutAt: Date;

  /** Duration in minutes, computed on checkout */
  @Column({ type: 'int', nullable: true })
  durationMinutes: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  biometricTemplateHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  biometricStorageReference: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  biometricProcessingLocation: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  biometricVendor: string;
}
