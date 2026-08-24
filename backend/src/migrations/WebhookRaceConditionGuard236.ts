import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #236 — Webhook race-condition guard.
 *
 * Index on bookings(sorobanEscrowId) to speed up the idempotency check
 * in HandleWebhookProvider.recordSorobanEscrow — before creating an on-chain
 * escrow, the handler checks `booking.sorobanEscrowId` to avoid double-creation.
 *
 * Note: The partial unique index on payments(providerReference) WHERE status='success'
 * is intentionally omitted. TypeORM cannot express partial indexes via entity
 * decorators, so including it would cause perpetual schema-drift CI failures.
 * The real race-condition guard is the atomic conditional UPDATE in the webhook
 * handler code (UPDATE ... WHERE status='pending'), which is enforced at the
 * storage layer regardless of index presence.
 *
 * Migration name numeric portion must exceed the baseline's
 * (BaselineSchema17356896000001787522225542) so TypeORM runs this AFTER tables exist.
 */
export class WebhookRaceConditionGuard23617561568000001787522225543 implements MigrationInterface {
  name = 'WebhookRaceConditionGuard23617561568000001787522225543';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index on sorobanEscrowId for the idempotency guard in recordSorobanEscrow.
    // Plain index matching the @Index() decorator on Booking.sorobanEscrowId.
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_soroban_escrow_id" ON "bookings" ("sorobanEscrowId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bookings_soroban_escrow_id"`);
  }
}
