import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiKeyEntity } from './api-key.entity';

/**
 * Append-only audit log: every successful API key authentication
 * is recorded here with the key id and the endpoint hit.
 */
@Entity('api_key_audit_logs')
@Index(['keyId', 'endpoint'])
export class ApiKeyAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  keyId: string;

  @ManyToOne(() => ApiKeyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'keyId' })
  key: ApiKeyEntity;

  /** e.g. "POST /webhooks/payment-received" */
  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  /** Caller IP — useful for abuse detection. */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}