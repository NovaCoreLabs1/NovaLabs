import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #236 — Webhook race-condition guard.
 *
 * 1. Partial unique index on payments(providerReference, status) WHERE status = 'success'.
 *    Prevents two concurrent charge.success deliveries from both inserting a SUCCESS row
 *    for the same reference — the database rejects the second INSERT/UPDATE.
 *    The application already uses atomic conditional UPDATEs, but this index is a
 *    defense-in-depth safety net.
 *
 * 2. Index on bookings(sorobanEscrowId).
 *    Speeds up the idempotency check in HandleWebhookProvider.recordSorobanEscrow —
 *    before creating an on-chain escrow, the handler checks `booking.sorobanEscrowId`
 *    to avoid double-creation.
 */
export class WebhookRaceConditionGuard2361756156800000 implements MigrationInterface {
  name = 'WebhookRaceConditionGuard2361756156800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Partial unique index: at most one SUCCESS payment per provider reference.
    // This is a defense-in-depth constraint — the application uses atomic UPDATEs,
    // but this catches any bug that slips through.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payment_reference_success"
         ON "payments" ("providerReference")
         WHERE "status" = 'success'`,
    );

    // Index on sorobanEscrowId for the idempotency guard in recordSorobanEscrow.
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_soroban_escrow_id"
         ON "bookings" ("sorobanEscrowId")
         WHERE "sorobanEscrowId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bookings_soroban_escrow_id"`);
    await queryRunner.query(`DROP INDEX "UQ_payment_reference_success"`);
  }
}
