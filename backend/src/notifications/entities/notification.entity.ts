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
import { Hub } from '../../hub/entities/hub.entity';
import { NotificationType } from '../enums/notification-type.enum';

@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['hubId'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  /** Optional reference to the related entity (booking ID, payment ID, etc.) */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  // Indexed via the class-level `@Index(['hubId'])` above — a second
  // column-level @Index here would register the same index twice.
  @Column({ type: 'uuid', nullable: true })
  hubId: string;

  @ManyToOne(() => Hub, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hubId' })
  hub: Hub;
}
