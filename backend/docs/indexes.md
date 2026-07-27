# Database Index Audit

This document enumerates every PostgreSQL index declared across the
NovaLabs NestJS backend, including the originating query pattern that
each index serves. It is the human-readable companion to
`scripts/export-indexes.ts` and the source of truth for "do we have an
index for this access path?"

> Source of truth: TypeORM `@Index(...)` decorators in
> `backend/src/**/*.entity.ts`. Bare `@PrimaryGeneratedColumn('uuid')`
> columns add an implicit B-tree PK. `@Column({ unique: true })` adds an
> implicit unique B-tree index.
>
> Generated 2026-07-27. Closes #27.

---

## users

| Column(s)     | Type             | Origin                                            | Why it exists                                                                                              |
| ------------- | ---------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id` (uuid)   | PK b-tree        | `@PrimaryGeneratedColumn('uuid')`                 | Implicit PK. Every FK lookup and `findOne`/`findOneBy` pivots on this.                                     |
| `email`       | **unique b-tree**| `@Column({ unique: true })`                       | Every `findOne({ where: { email } })` (login, signup, OTP, password reset, resend). Implicit at PG level.   |
| `refreshTokens.token` | indirect | FK from `refresh_tokens.userId` | Referenced on every refresh-token rotation: `findByToken(token)` joins through this FK.                    |
| `deletedAt`   | partial b-tree   | `@DeleteDateColumn()`                             | Soft-delete filter `WHERE deletedAt IS NULL`; PG adds a partial index automatically on `@DeleteDateColumn`. |

Hot write path: signup, login, OTP resend. Hot read path:
`email → user` lookup. The unique constraint on `email` covers all reads
and `ConflictException` enforcement on signup.

### Gaps flagged

- **`verificationCode`, `passwordResetCode`, `verificationToken`,
  `passwordResetToken`** are nullable `varchar` columns that the
  `/auth/resend-verification-otp`, `/auth/forgot-password`,
  `/auth/resend-reset-password-otp` flows `findOne` against at the admin
  fix-rate limit (max 100 rpm `long` bucket + 5 rpm `feedback`).
  Without an index, these rare-path lookups do a sequential scan but
  the column cardinality is one row out of `users`. **Index intentionally
  omitted** — low-cardinality scan is acceptable.
- **`phone`** is searchable in the future Phone-OTP flow. Not indexed
  today (no read path uses it). Flagged for "add index when first query
  lands".
- **`membershipStatus`** powers the upcoming `members` index page. A
  partial index on `(membershipStatus) WHERE membershipStatus = 'active'`
  would help once that page exists; tracked under a separate ticket.

---

## refresh_tokens

| Column(s)                        | Type             | Origin            | Why it exists                                                              |
| -------------------------------- | ---------------- | ----------------- | -------------------------------------------------------------------------- |
| `id` (uuid)                      | PK b-tree        | `@PrimaryGeneratedColumn` | Implicit PK.                              |
| `token`                          | **unique b-tree**| `@Index(['token'], { unique: true })` | `findByToken` lookup on every `/auth/refresh-token`. Also dedupes at insert time. |
| `userId`                         | b-tree           | `@Index(['userId'])` | "All refresh tokens for user X" -> used on logout-everywhere.              |
| `familyId`                       | b-tree           | `@Index(['familyId'])` | "All tokens in refresh family X" -> `revokeFamily` on reuse detection.    |
| `(familyId, version)`            | unique b-tree    | `@Index(['familyId', 'version'], { unique: true })` | Two refresh-tokens must never share family + version — would race.    |

### Gaps flagged

- None. Every read path is covered.

---

## bookings

| Column(s)      | Type      | Origin                                  | Why it exists                                                                  |
| -------------- | --------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `id` (uuid)    | PK        | implicit                                | every find / join                                                              |
| `userId`       | b-tree    | `@Index(['userId'])`                    | "All my bookings" dashboard feed + refund lookups.                              |
| `workspaceId`  | b-tree    | `@Index(['workspaceId'])`               | "Occupancy by workspace" view + cron availability recompute.                    |
| `status`       | b-tree    | `@Index(['status'])`                    | Throttler admin dashboard pulls `pending` and `confirmed` buckets.            |
| `startDate`    | partial   | not-indexed                             | Needed for "overlapping bookings in window" but expressed as `WHERE startDate BETWEEN x AND y`; covered by index merge on `(workspaceId, startDate)` once we add it. |
| `endDate`      | partial   | not-indexed                             | Same as `startDate` above.                                                     |

### Gaps flagged

- **(workspaceId, startDate)** composite index — needed once we ship
  the calendar availability query. Tracked separately.
- **isGuestBooking** partial index — present in `bookings WHERE
  isGuestBooking = true` is the only path that pulls guest rows;
  cardinality is usually small so we wait for prod telemetry.

---

## payments

| Column(s)          | Type      | Origin                              | Why it exists                                                                                              |
| ------------------ | --------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id` (uuid)        | PK        | implicit                            | every find                                                                                                |
| `bookingId`        | b-tree    | `@Index(['bookingId'])`             | All payments on a booking — refund-by-booking dashboard.                                                   |
| `userId`           | b-tree    | `@Index(['userId'])`                | "My payments" view + admin refund-list page.                                                              |
| `providerReference`| b-tree    | `@Index(['providerReference'])`     | Payment webhook reconciliation on Paystack/Flutterwave response. The unique-bucket reference *isn't* unique in our DB — retries insert parallel rows. |

### Gaps flagged

- **`providerReference` should be unique** in spirit; a malformed provider
  that retries with the same ref creates duplicate rows. Tracked
  separately as a uniqueness enforcement fix once we capture the exact
  payload.

---

## invoices

| Column(s)      | Type               | Origin                                              | Why it exists                                                      |
| -------------- | ------------------ | --------------------------------------------------- | ------------------------------------------------------------------ |
| `id` (uuid)    | PK                 | implicit                                            | every find                                                         |
| `invoiceNumber`| **unique b-tree**  | `@Index(['invoiceNumber'], { unique: true })`       | Human-readable invoice codes ("INV-00001") must be unique.         |
| `userId`       | b-tree             | `@Index(['userId'])`                                | "My invoices" feed + tax reporting.                                |
| `bookingId`    | b-tree             | `@Index(['bookingId'])`                             | Join path for the bookings detail page.                            |

### Gaps flagged

- **`paymentId`** is indexed implicitly through FK; no separate
  `@Index` needed because lookups always join `invoices.paymentId`
  with the small set of payments per booking.

---

## workspaces

| Column(s)  | Type   | Origin                  | Why it exists                                                                |
| ---------- | ------ | ----------------------- | ---------------------------------------------------------------------------- |
| `id`       | PK     | implicit                | every find                                                                   |
| `name`     | none   | n/a                     | Not queried by slug. If we ship `/workspaces/:slug`, add a unique b-tree.    |
| `type`     | none   | n/a                     | Low-cardinality; sequential scan acceptable until catalogue UI ships.        |
| `isActive` | none   | n/a                     | Filtering dashboard; combine with `type` partial index when needed.          |

### Gaps flagged

- **(type, isActive)** partial b-tree — needed once the marketplace page
  ships. Tracked separately.

---

## notifications

| Column(s)        | Type     | Origin                              | Why it exists                                                                |
| ---------------- | -------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `id`             | PK       | implicit                            | every find                                                                   |
| `(userId, isRead)`| b-tree  | `@Index(['userId', 'isRead'])`     | "Unread badge count" + "mark all read" updates both filter by this composite. |

### Gaps flagged

- **createdAt** partial index — needed once we ship the
  "notifications older than 30 days" janitor. Tracked separately.

---

## contact_messages

| Column(s)  | Type      | Origin  | Why it exists                                                  |
| ---------- | --------- | ------- | -------------------------------------------------------------- |
| `id`       | PK        | implicit| every find                                                     |
| `isRead`   | none      | n/a     | Admin "unread inbox" view is fine on small N; sequential scan. |

### Gaps flagged

- **(isRead, createdAt DESC)** partial b-tree — needed once inbox
  exceeds ~50k rows. Tracked separately.

---

## newsletter (subscribers)

| Column(s)         | Type              | Origin                                  | Why it exists                                                          |
| ----------------- | ----------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `id`              | PK                | implicit                                | every find                                                             |
| `email`           | **unique b-tree** | both `@Unique(['email'])` and `@Index(['email'])` | The `subscribe` and `unsubscribe` flows `findOne` by email; unique constraint enforces dedupe. |
| `isActive`        | b-tree            | `@Index(['isActive'])`                  | Active-only subscriber export job.                                     |
| `isVerified`      | b-tree            | `@Index(['isVerified'])`                | Verified-only subscriber export job.                                   |

### Gaps flagged

- **`unsubscribeToken`** is looked up on every unsubscribe link click;
  cardinality is one row out of `newsletter`. No index needed.

---

## audit_log

| Column(s)     | Type      | Origin       | Why it exists                                              |
| ------------- | --------- | ------------ | ---------------------------------------------------------- |
| `id`          | PK        | implicit     | every find                                                 |
| `actorId`     | none      | n/a          | "Audit events by user" not currently paginated; sequential scan acceptable at audit-log scale (cron-purged). |
| `createdAt`   | implicit   | `@CreateDateColumn` | Sorts newest first via PG default index on PK + heap.      |

### Gaps flagged

- **(actorId, createdAt DESC)** b-tree — needed once we expose the
  "audit by user" admin page beyond 100k rows. Tracked separately.

---

## security_ip_log

| Column(s)    | Type      | Origin       | Why it exists                                                       |
| ------------ | --------- | ------------ | ------------------------------------------------------------------- |
| `id`         | PK        | implicit     | every find                                                          |
| `auditLogId` | b-tree    | `@Index()`   | Lookup-by-audit-log-id for the cron purge job.                      |
| `expiresAt`  | b-tree    | `@Index()`   | Purge query `WHERE expires_at < NOW()`. Explicit index since the cron job runs every 6h and the table grows ~thousands of rows/day. |

### Gaps flagged

- **`raw_ip`** uses `inet` type so subnet lookups (e.g.
  `host(raw_ip) << '10.0.0.0/8'`) are evaluated without an index. If
  the security team starts running subnet queries, add a `gist` index
  using `inet_ops` operator class. Tracked separately.

---

## workspace_logs

| Column(s)                       | Type      | Origin                                                | Why it exists                                                          |
| ------------------------------- | --------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `id`                            | PK        | implicit                                              | every find                                                             |
| `(workspaceId, checkedInAt)`   | b-tree    | `@Index(['workspaceId', 'checkedInAt'])`              | "Active check-ins for workspace X" + daily-occupancy aggregation.       |
| `(userId, checkedInAt)`         | b-tree    | `@Index(['userId', 'checkedInAt'])`                   | "My history" view + billing aggregation.                                |

### Gaps flagged

- None. The two composite indexes cover both aggregated read paths and
  range scans by date.

---

## How to regenerate

Run `npx ts-node backend/scripts/export-indexes.ts > indexes.md.tmp`
against a live database and diff against this file. CI runs the same
command on every PR; a missing `@Index` for any new FK column fails
the build.

## How to query a specific index in Postgres

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```
