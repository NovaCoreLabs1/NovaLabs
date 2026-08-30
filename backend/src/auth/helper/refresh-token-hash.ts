import { createHash } from 'crypto';

/**
 * Refresh tokens are 7-day bearer credentials. Storing them verbatim turns any
 * database dump, backup leak, or read-replica compromise into a full
 * session-hijack event (issue #237). We therefore persist only a hash of the
 * token: the write path hashes before insert and every lookup hashes the
 * presented token before querying, so the raw JWT never touches disk.
 *
 * `sha256` (unkeyed) is sufficient here — the tokens are signed JWTs with high
 * entropy, so there is nothing to brute-force, and this mirrors how the
 * password-reset / verification tokens are already hashed at rest
 * (`users/providers/forgotPassword.provider.ts`). Keeping one primitive across
 * the codebase avoids introducing a new managed secret. See `docs/SECRETS.md`.
 *
 * This module is the single source of truth for the hash: both the runtime
 * repository and the hash-in-place migration import `hashRefreshToken`, so the
 * value the migration writes always matches the value a live lookup computes.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * True when `value` is already a stored refresh-token hash (64 lowercase hex
 * chars) rather than a raw JWT. Used by the migration to stay idempotent:
 * already-migrated rows are skipped, so re-running it is safe. A JWT can never
 * match this pattern — it contains `.` separators and is far longer than 64
 * characters.
 */
export function isHashedRefreshToken(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
