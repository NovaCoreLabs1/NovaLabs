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
import { WorkspaceType } from '../enums/workspace-type.enum';
import { Hub } from '../../hub/entities/hub.entity';

/**
 * TypeORM entity representing a bookable workspace resource.
 *
 * Stores the workspace type, total and currently-available seat counts,
 * pricing per hour (in kobo), descriptive metadata, and lifecycle flags.
 */
@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: WorkspaceType })
  type: WorkspaceType;

  @Column({ type: 'int', default: 1 })
  totalSeats: number;

  @Column({ type: 'int', default: 1 })
  availableSeats: number;

  // Stored in kobo (smallest currency unit). e.g. ₦5000/hr = 500000 kobo
  @Column({ type: 'bigint' })
  hourlyRate: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-array', nullable: true })
  amenities: string[];

  @Column({ type: 'simple-array', nullable: true })
  images: string[];

  @Column({ default: true })
  isActive: boolean;

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
