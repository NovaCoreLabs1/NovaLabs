import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * TrustedDevice — Issue #120
 *
 * Stores a hashed device token for a user, allowing TOTP to be skipped
 * on recognised devices for up to 30 days. Each record is bound to a
 * single user account and expires automatically.
 */
@Entity('trusted_devices')
@Index(['user', 'deviceToken'])
export class TrustedDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owning user — cascade-delete when user is removed */
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  user: User;

  /** bcrypt hash of the raw 32-byte random device token stored in the cookie */
  @Column({ type: 'text' })
  deviceToken: string;

  /** Human-readable label to show in the trusted-device management UI */
  @Column({ type: 'varchar', length: 255, default: 'Unknown device' })
  deviceLabel: string;

  /** UTC timestamp after which this record must be considered expired */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
