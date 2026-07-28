# `users/`

User management module. Hosts:

- **Member directory** (`MembersController`)
- **CRUD endpoints** for users (`UsersController`)
- **GDPR endpoints** — `/users/me/export.json` (Art. 20, portability) and
  `DELETE /users/me` (Art. 17, right-to-be-forgotten)
- **Anonymisation pipeline** (`AnonymiseUserProvider`) — transactional,
  irreversible PII wipe invoked by `DELETE /users/me`

## GDPR Art. 17 — Right to be forgotten

`DELETE /users/me` anonymises the caller. It is **not** a hard-delete of the
`User` row — the row's `id` is preserved so foreign-key references from
`bookings`, `payments`, etc. remain valid. The provider does, in one DB
transaction:

1. Writes an `audit_log` entry with action `users.anonymise` using the
   *original* `actorId` / `actorEmail` for traceability.
2. Hard-deletes all `refresh_tokens` belonging to the user.
3. Hard-deletes all `workspace_logs` (biometric-tied records must NOT linger).
4. Sets `bookings.userId = NULL` and `payments.userId = NULL` so financial
   records are retained anonymously.
5. Replaces the user row's PII:
   - `email` -> `sha256(original-email + per-user-salt)@deleted.novalabs.internal`
     (salt is generated but never persisted → unrecoverable)
   - `firstname` -> `deleted-user-<short-uuid>`
   - `lastname` -> `""`
   - `phone`, `profilePicture` -> `NULL`
   - All credentials (password, totpSecret, totpBackupCodes, passkeyCredentials,
     verificationCode, passwordResetCode) -> `NULL`
   - `twoFactorEnabled = false`, `isActive = false`, `isDeleted = true`,
     `deletedAt = now()`

### Irreversibility guarantees

- The email hash uses a per-user random 16-byte salt that is never stored.
  Once the salt is gone, the hash cannot be reversed to the original email.
- Credentials are NULLed, so even if a stale JWT was somehow still valid,
  re-authentication is impossible.
- Refresh tokens are hard-deleted so a leaked token cannot be replayed
  against the anonymised account.

### Defensive background sweep

The `AnonymisationHardeningCron` (`audit-log/providers/anonymisation-hardening.cron.ts`,
registered in **`UsersModule`** — not in `AuditLogModule` — to avoid the
`UsersModule ↔ AuditLogModule` circular import) runs daily at **03:00 UTC** and:

- hard-deletes any refresh tokens belonging to `isDeleted=true` users
- hard-deletes any workspace logs belonging to `isDeleted=true` users

This is a safety net — the synchronous `/me` flow already performs these
steps. The cron guarantees the invariants hold even if a future code path
deviates from the synchronous flow.

### Idempotency

`anonymise()` is idempotent: if `isDeleted=true` on entry it short-circuits
without writing anything.

## Audit log integration

The `users.anonymise` action is recorded in `audit_log` with:

| field           | value                                          |
| --------------- | ---------------------------------------------- |
| `actorId`       | original user UUID (pre-anonymisation)         |
| `actorEmail`    | original user email (pre-anonymisation)        |
| `targetType`    | `user`                                         |
| `targetId`      | same as `actorId`                              |
| `action`        | `users.anonymise`                              |
| `metadata.mode` | `self_service`                                 |
| `metadata.reason` | optional, caller-supplied                     |
| `metadata.originalEmailHash` | sha256 of original email + salt |

This entry is written **inside** the same DB transaction as the user
mutations so a crash cannot leave an audit gap.
