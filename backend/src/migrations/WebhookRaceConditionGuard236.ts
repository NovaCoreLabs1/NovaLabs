import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #236 — Webhook race-condition guard.
 *
 * This migration is intentionally empty. The race-condition fix is enforced
 * entirely at the application layer via atomic conditional UPDATEs:
 *
 *   UPDATE payments SET status = 'success' WHERE id = :id AND status = 'pending'
 *   UPDATE payments SET status = 'failed'  WHERE id = :id AND status = 'pending'
 *
 * These guarantee that only one concurrent webhook delivery can win the
 * PENDING → SUCCESS/FAILED transition, eliminating duplicate booking
 * confirms, double escrows, and FAILED-after-SUCCESS corruption.
 *
 * A partial unique index on payments(providerReference) WHERE status='success'
 * was considered as defense-in-depth but removed because TypeORM cannot express
 * partial indexes via entity decorators, causing perpetual schema-drift CI failures.
 *
 * Migration name numeric portion must exceed the baseline's
 * (BaselineSchema17356896000001787522225542) so TypeORM runs this AFTER tables exist.
 */
export class WebhookRaceConditionGuard23617561568000001787522225543 implements MigrationInterface {
  name = 'WebhookRaceConditionGuard23617561568000001787522225543';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // No-op: the race-condition guard is enforced by atomic UPDATEs in code.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op.
  }
}
