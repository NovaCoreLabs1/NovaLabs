import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  hashRefreshToken,
  isHashedRefreshToken,
} from '../auth/helper/refresh-token-hash';

/**
 * Issue #237 — hash existing plaintext refresh tokens at rest.
 *
 * Strategy: **hash-in-place**. Each stored `token` is rewritten to its
 * `sha256` hex digest. The raw JWT still lives only on the client, and because
 * a live lookup hashes the presented token before querying
 * (`RefreshTokenRepositoryOperations.findByToken`), every already-issued
 * session keeps working — a client can refresh once with the token it already
 * holds, no forced re-login. See docs/SECRETS.md.
 *
 * Safe to run on a live database:
 *  - Idempotent: rows already holding a 64-char hex hash are skipped, so a
 *    re-run (or a run that overlaps a partially-migrated table) is a no-op.
 *  - Batched via keyset pagination on the immutable `id`, so it never loads the
 *    whole table into memory and the page cursor can't drift as tokens change.
 *  - Uses the same `hashRefreshToken` the runtime uses, so migrated values are
 *    byte-for-byte what a subsequent lookup computes.
 */
export class HashRefreshTokensAtRest1790000000000 implements MigrationInterface {
  name = 'HashRefreshTokensAtRest1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const BATCH_SIZE = 500;
    // Minimum UUID sentinel; `id > cursor` walks the table in a stable order.
    let cursor = '00000000-0000-0000-0000-000000000000';

    for (;;) {
      const rows: Array<{ id: string; token: string }> =
        await queryRunner.query(
          `SELECT "id", "token" FROM "refresh_tokens"
             WHERE "id" > $1::uuid
             ORDER BY "id" ASC
             LIMIT $2`,
          [cursor, BATCH_SIZE],
        );

      if (rows.length === 0) break;

      for (const row of rows) {
        // Skip rows that are already hashed so the migration is idempotent.
        if (!isHashedRefreshToken(row.token)) {
          await queryRunner.query(
            `UPDATE "refresh_tokens" SET "token" = $1 WHERE "id" = $2::uuid`,
            [hashRefreshToken(row.token), row.id],
          );
        }
      }

      cursor = rows[rows.length - 1].id;
      if (rows.length < BATCH_SIZE) break;
    }
  }

  public async down(): Promise<void> {
    // Intentionally irreversible. sha256 is one-way, so the original plaintext
    // refresh tokens cannot be recovered — and restoring them would re-open the
    // vulnerability this migration closes. To roll back operationally, revoke
    // all refresh tokens and require re-login (see docs/SECRETS.md), rather
    // than un-hashing.
  }
}
