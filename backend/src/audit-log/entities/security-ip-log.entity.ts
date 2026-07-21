import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Short-retention table that stores raw (unmasked) IP addresses for
 * security-flagged audit actions (login, logout, token revocation,
 * impersonation, etc.).
 *
 * Rows are automatically expired by the AuditLogPurgeService cron job.
 * The default retention window is 30 days, configurable via the
 * SECURITY_IP_RETENTION_DAYS environment variable.
 *
 * The `raw_ip` column uses the Postgres `inet` type so the database can
 * efficiently query by subnet (e.g. host(raw_ip) << '10.0.0.0/8').
 */
@Entity('security_ip_log')
export class SecurityIpLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * UUID of the audit_log row this record belongs to.
   * Not a FK constraint so that audit_log rows can be queried independently
   * and purges do not cascade unexpectedly.
   */
  @Index()
  @Column({ name: 'audit_log_id', type: 'uuid', nullable: false })
  auditLogId: string;

  /**
   * Raw (unmasked) IP address stored as Postgres inet type.
   * Supports both IPv4 (e.g. 203.0.113.42) and IPv6 (e.g. 2001:db8::1).
   */
  @Column({ name: 'raw_ip', type: 'inet', nullable: false })
  rawIp: string;

  /** The audit action that triggered security-grade retention. */
  @Column({ name: 'action', type: 'varchar', length: 100, nullable: false })
  action: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /**
   * Hard expiry timestamp.  The purge job deletes rows where NOW() > expires_at.
   */
  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expiresAt: Date;
}
