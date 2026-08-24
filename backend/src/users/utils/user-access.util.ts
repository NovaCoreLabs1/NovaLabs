import { UserRole } from '../enums/userRoles.enum';

/**
 * Authorization primitives for the users module (issue #226).
 *
 * These are pure functions on purpose: every route and provider that touches
 * another user's record must go through them, so the ownership/role matrix in
 * `docs/PERMISSIONS.md` has exactly one implementation. A future endpoint that
 * skips these helpers has no access to the field allowlist below and is easy
 * to spot in review.
 */

/**
 * Fields whose mutation changes account state, verification or security
 * posture. Only ADMIN / SUPER_ADMIN actors may supply them on
 * `PATCH /api/users/:id`; they are rejected outright for everyone else.
 */
export const ADMIN_ONLY_UPDATE_FIELDS = [
  'role',
  'isVerified',
  'isActive',
  'verificationToken',
  'verificationTokenExpiry',
  'passwordResetToken',
  'passwordResetExpiresIn',
  'lastPasswordResetSentAt',
  'lastVerificationEmailSent',
] as const;

export type AdminOnlyUpdateField = (typeof ADMIN_ONLY_UPDATE_FIELDS)[number];

/**
 * True when the role may act on any account (module-level administration).
 * STAFF deliberately is not admin-like: it manages member *status* through
 * MembersController, not user accounts.
 */
export function isAdminLike(role: UserRole | string | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

/**
 * May `actorId` holding `actorRole` write to the record of `targetUserId`?
 *
 * Matrix (docs/PERMISSIONS.md → Users module):
 *   - ADMIN / SUPER_ADMIN → any account
 *   - USER / STAFF        → own account only (self-service profile edit)
 */
export function canMutateUser(
  actorRole: UserRole | string | undefined,
  actorId: string | undefined,
  targetUserId: string,
): boolean {
  if (!actorId) {
    return false;
  }
  return actorId === targetUserId || isAdminLike(actorRole);
}

/**
 * Returns the admin-only fields present in an arbitrary update payload.
 * Used both for enforcement (reject) and audit metadata (what was attempted).
 */
export function findAdminOnlyFields(payload: object): AdminOnlyUpdateField[] {
  const record = payload as Record<string, unknown>;
  return ADMIN_ONLY_UPDATE_FIELDS.filter(
    (field) => record[field] !== undefined,
  );
}
