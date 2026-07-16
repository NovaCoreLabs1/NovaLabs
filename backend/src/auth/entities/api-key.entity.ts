import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Supported scopes for API keys.
 * Extend this list as new service-to-service operations are added.
 */
export enum ApiKeyScope {
  READ_PAYMENTS = 'read:payments',
  WRITE_INVOICES = 'write:invoices',
  READ_MEMBERS = 'read:members',
  WRITE_BOOKINGS = 'write:bookings',
  WEBHOOK_RECEIVE = 'webhook:receive',
}

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-readable label — e.g. "cron-invoicing-service" */
  @Column({ type: 'varchar', length: 120 })
  name: string;

  /**
   * Short public prefix (first 8 chars of the raw key).
   * Stored in plaintext so we can look up the row quickly
   * without a full-table scan of hashed values.
   */
  @Index()
  @Column({ type: 'varchar', length: 16, unique: true })
  prefix: string;

  /**
   * bcrypt hash of the full raw key.
   * The raw key is NEVER stored; only this hash is persisted.
   */
  @Column({ type: 'varchar', length: 255 })
  hash: string;

  /** Scopes granted to this key. */
  @Column({ type: 'simple-array' })
  scopes: ApiKeyScope[];

  /** Optional hard expiry — null means the key never expires. */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /** Soft-revoke a key without deleting the audit history. */
  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  get isExpired(): boolean {
    return this.expiresAt !== null && this.expiresAt < new Date();
  }

  get isActive(): boolean {
    return !this.revoked && !this.isExpired;
  }
}