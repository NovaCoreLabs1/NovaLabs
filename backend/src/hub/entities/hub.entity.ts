import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TypeORM entity representing a co-working hub (tenant).
 *
 * Each hub is a physically or logically separated location.  All
 * tenant-owned entities (User, Workspace, Booking, etc.) carry a
 * `hubId` foreign key back to this table so that operators can run
 * multiple hubs from a single NovaLabs deployment.
 *
 * Legacy rows created before multi-tenancy was introduced are assigned
 * to a **default hub** (slug: `default`) via a backfill migration.
 */
@Entity('hubs')
export class Hub {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  name: string;

  /** URL-safe identifier used in API paths and the JWT `hubId` claim. */
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
