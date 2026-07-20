# NovaLabs — PostgreSQL Data Model

> **Source of truth:** this document is hand-maintained from the TypeORM entities under
> `backend/src/**/entities/*.entity.ts`. The **CI "Verify Data Model Sync" job** in
> `.github/workflows/CI.yaml` fails any pull request that modifies a `.entity.ts` file
> without also updating this file.
>
> **Maintainers' rule:** every PR that adds, removes, or renames a column, table, or
> relationship must update the corresponding section below. Reviewers should block
> merges that change entities but leave this document untouched.

---

## 1. Entity-Relationship Overview

```mermaid
erDiagram
    USER ||--o{ REFRESH_TOKEN        : "has"
    USER ||--o{ BOOKING              : "creates"
    USER ||--o{ PAYMENT              : "initiates"
    USER ||--o{ INVOICE              : "receives"
    USER ||--o{ WORKSPACE_LOG        : "generates"
    USER ||--o{ NOTIFICATION         : "receives"

    WORKSPACE ||--o{ BOOKING         : "is booked as"
    WORKSPACE ||--o{ WORKSPACE_LOG   : "is logged in"

    BOOKING ||--o{ PAYMENT           : "is paid by"
    BOOKING ||--o{ INVOICE           : "produces"
    BOOKING ||--o{ WORKSPACE_LOG     : "may be linked to"

    PAYMENT ||--o| INVOICE           : "satisfies (nullable)"

    USER {
        uuid    id PK
        string  firstname
        string  lastname
        string  username "nullable"
        string  email "unique"
        string  password "excluded"
        enum    role "USER | ADMIN | ..."
        string  passwordResetToken "excluded, nullable"
        timestamptz passwordResetExpiresIn "excluded, nullable"
        timestamptz lastPasswordResetSentAt "excluded, nullable"
        string  verificationToken "excluded, nullable"
        timestamptz verificationTokenExpiry "excluded, nullable"
        timestamptz lastVerificationEmailSent "excluded, nullable"
        string  verificationCode "excluded, nullable"
        timestamptz verificationCodeExpiresAt "excluded, nullable"
        string  passwordResetCode "excluded, nullable"
        timestamptz passwordResetCodeExpiresAt "excluded, nullable"
        bool    isVerified
        bool    isActive
        bool    isDeleted
        bool    isSuspended
        string  profilePicture "nullable, varchar(500)"
        string  phone "nullable, varchar(15)"
        bool    twoFactorEnabled
        string  totpSecret "excluded, nullable, varchar(255)"
        jsonb   totpBackupCodes "excluded, nullable"
        enum    membershipStatus "INACTIVE | ACTIVE | ..."
        timestamptz memberSince "nullable"
        int     profileCompleteness "default 0"
        timestamptz createdAt
        timestamptz updatedAt
        timestamptz deletedAt "soft delete"
    }

    REFRESH_TOKEN {
        uuid    id PK
        uuid    userId FK "indexed, ON DELETE CASCADE"
        text    token "unique index"
        string  familyId "varchar(255), token rotation family"
        int     version "rotation version counter"
        timestamptz expiresAt "nullable"
        bool    revoked
        timestamptz consumedAt "nullable"
        timestamptz createdAt
        timestamptz updatedAt
    }

    WORKSPACE {
        uuid    id PK
        string  name
        enum    type "HOT_DESK | DEDICATED_DESK | PRIVATE_OFFICE | MEETING_ROOM | VIRTUAL | HYBRID"
        int     totalSeats "default 1"
        int     availableSeats "default 1"
        bigint  hourlyRate "amount in kobo"
        text    description "nullable"
        text[]  amenities "nullable, TypeORM simple-array"
        text[]  images "nullable, TypeORM simple-array"
        bool    isActive
        timestamptz createdAt
        timestamptz updatedAt
    }

    BOOKING {
        uuid    id PK
        uuid    userId FK "nullable, ON DELETE RESTRICT, indexed"
        uuid    workspaceId FK "ON DELETE RESTRICT, indexed"
        enum    planType "DAILY | WEEKLY | MONTHLY | QUARTERLY | YEARLY"
        date    startDate
        date    endDate
        bigint  totalAmount "amount in kobo"
        enum    status "PENDING | CONFIRMED | CANCELLED | ..."
        int     seatCount "default 1"
        text    notes "nullable"
        string  sorobanEscrowId "nullable"
        bool    reminderSent
        bool    isGuestBooking
        jsonb   guestInfo "nullable {name,email,phone}"
        timestamptz createdAt
        timestamptz updatedAt
    }

    PAYMENT {
        uuid    id PK
        uuid    bookingId FK "indexed, ON DELETE RESTRICT"
        uuid    userId FK "nullable, indexed, ON DELETE RESTRICT"
        bigint  amount "amount in kobo"
        varchar currency "ISO-4217, default 'NGN'"
        enum    provider "PAYSTACK | SOROBAN"
        string  providerReference "indexed, nullable"
        enum    status "PENDING | SUCCESSFUL | FAILED | ..."
        timestamptz paidAt "nullable"
        jsonb   metadata "nullable"
        timestamptz createdAt
        timestamptz updatedAt
    }

    INVOICE {
        uuid    id PK
        varchar invoiceNumber "unique, INV-00001"
        uuid    userId FK "indexed, ON DELETE RESTRICT"
        uuid    bookingId FK "indexed, ON DELETE RESTRICT"
        uuid    paymentId FK "nullable, ON DELETE SET NULL"
        bigint  amountKobo "amount in kobo"
        varchar currency "default 'NGN'"
        enum    status "PENDING | PAID | VOID"
        timestamptz paidAt "nullable"
        jsonb   lineItems "immutable snapshot"
        timestamptz createdAt
        timestamptz updatedAt
    }

    WORKSPACE_LOG {
        uuid    id PK
        uuid    userId FK "ON DELETE RESTRICT, composite index (userId,checkedInAt)"
        uuid    workspaceId FK "ON DELETE RESTRICT, composite index (workspaceId,checkedInAt)"
        uuid    bookingId FK "nullable, ON DELETE SET NULL"
        timestamptz checkedInAt
        timestamptz checkedOutAt "nullable"
        int     durationMinutes "nullable, computed on checkout"
        text    notes "nullable"
        string  biometricTemplateHash "nullable, varchar(128)"
        string  biometricStorageReference "nullable, varchar(255)"
        string  biometricProcessingLocation "nullable, varchar(32)"
        string  biometricVendor "nullable, varchar(64)"
    }

    NOTIFICATION {
        uuid    id PK
        uuid    userId FK "ON DELETE CASCADE, composite index (userId,isRead)"
        enum    type "BOOKING_CONFIRMED | PAYMENT_SUCCESS | ..."
        varchar title
        text    message
        bool    isRead
        jsonb   metadata "nullable, refs related entity"
        timestamptz createdAt
    }

    NEWSLETTER_SUBSCRIBER {
        uuid    id PK
        varchar email "unique, max 254, indexed"
        bool    isVerified
        timestamptz verifiedAt "nullable"
        varchar verificationToken "nullable"
        timestamptz verificationTokenExpiresAt "nullable"
        timestamptz subscribedAt
        timestamptz unsubscribedAt "nullable"
        bool    isActive "indexed"
        varchar unsubscribeToken
        timestamptz consentedAt "nullable"
        varchar ipAddress "nullable, max 64"
        timestamptz createdAt
        timestamptz updatedAt
        timestamptz deletedAt "soft delete"
    }

    CONTACT_MESSAGE {
        uuid    id PK
        varchar fullName "max 100"
        varchar email "max 254"
        varchar phone "nullable, max 20"
        varchar company "nullable, max 150"
        varchar subject "max 200"
        text    message
        varchar ipAddress "nullable, max 64"
        bool    isRead
        timestamptz createdAt
        timestamptz updatedAt
    }

    AUDIT_LOG {
        uuid    id PK
        uuid    actorId "nullable"
        varchar actorEmail "nullable, max 255"
        varchar actorRole "nullable, max 50"
        varchar action "max 100"
        varchar targetType "nullable, max 100"
        uuid    targetId "nullable"
        varchar ipAddress "nullable, max 45"
        text    userAgent "nullable"
        jsonb   metadata "nullable"
        timestamptz createdAt
    }
```

---

## 2. Enumerations

### `UserRole`
| Value | Description |
|---|---|
| `super_admin` | Full system access |
| `admin` | Administrative access |
| `staff` | Staff-level access |
| `user` | Regular platform user (default) |

### `MembershipStatus`
| Value | Description |
|---|---|
| `active` | Active member |
| `inactive` | Not a member (default) |
| `suspended` | Membership suspended |

### `WorkspaceType`
| Value | Description |
|---|---|
| `HotDesk` | Unassigned hot desk |
| `DedicatedDesk` | Assigned dedicated desk |
| `PrivateOffice` | Private office space |
| `MeetingRoom` | Meeting/conference room |
| `Virtual` | Virtual office |
| `Hybrid` | Hybrid space |

### `PlanType`
| Value | Description |
|---|---|
| `daily` | Daily booking |
| `weekly` | Weekly booking |
| `monthly` | Monthly booking |
| `quarterly` | Quarterly subscription |
| `yearly` | Annual subscription |

### `BookingStatus`
| Value | Description |
|---|---|
| `pending` | Awaiting confirmation |
| `confirmed` | Booking confirmed |
| `cancelled` | Booking cancelled |
| `completed` | Booking completed |

### `PaymentProvider`
| Value | Description |
|---|---|
| `paystack` | Paystack (NGN fiat) |
| `soroban` | Soroban smart contract (Stellar) |

### `PaymentStatus`
| Value | Description |
|---|---|
| `pending` | Awaiting processing |
| `success` | Payment completed |
| `failed` | Payment failed |
| `refunded` | Payment refunded |

### `InvoiceStatus`
| Value | Description |
|---|---|
| `pending` | Unpaid |
| `paid` | Settled |
| `void` | Cancelled/voided |

### `NotificationType`
| Value | Description |
|---|---|
| `booking_confirmed` | Booking confirmed |
| `booking_cancelled` | Booking cancelled |
| `booking_completed` | Booking completed |
| `payment_success` | Payment successful |
| `payment_failed` | Payment failed |
| `payment_refunded` | Payment refunded |
| `invoice_generated` | New invoice |
| `general` | General notification |

### `AuditAction`
| Value | Description |
|---|---|
| `create` | Resource created |
| `update` | Resource updated |
| `delete` | Resource deleted |
| `refund` | Payment refunded |
| `login` | User logged in |
| `logout` | User logged out |
| `impersonate` | Admin impersonated a user |
| `cancel` | Booking cancelled |
| `auth.refresh.family.revoked` | Refresh token family revoked |

---

## 3. Relationship Cheat-Sheet

| From | Cardinality | To | Join column | On delete | Nullable |
|---|---|---|---|---|---|
| `User`        | 1 → 0..* | `RefreshToken`  | `refresh_tokens.userId`        | `CASCADE`  | no  |
| `User`        | 1 → 0..* | `Booking`       | `bookings.userId`             | `RESTRICT` | yes |
| `User`        | 1 → 0..* | `Payment`       | `payments.userId`             | `RESTRICT` | yes |
| `User`        | 1 → 0..* | `Invoice`       | `invoices.userId`             | `RESTRICT` | no  |
| `User`        | 1 → 0..* | `WorkspaceLog`  | `workspace_logs.userId`       | `RESTRICT` | no  |
| `User`        | 1 → 0..* | `Notification`  | `notifications.userId`        | `CASCADE`  | no  |
| `Workspace`   | 1 → 0..* | `Booking`       | `bookings.workspaceId`        | `RESTRICT` | no  |
| `Workspace`   | 1 → 0..* | `WorkspaceLog`  | `workspace_logs.workspaceId`  | `RESTRICT` | no  |
| `Booking`     | 1 → 0..* | `Payment`       | `payments.bookingId`          | `RESTRICT` | no  |
| `Booking`     | 1 → 0..* | `Invoice`       | `invoices.bookingId`          | `RESTRICT` | no  |
| `Booking`     | 1 → 0..* | `WorkspaceLog`  | `workspace_logs.bookingId`    | `SET NULL` | yes |
| `Payment`     | 1 → 0..1 | `Invoice`       | `invoices.paymentId`          | `SET NULL` | yes |

`NewsletterSubscriber`, `ContactMessage`, and `AuditLog` are intentionally standalone — they do
not reference any other table via TypeORM relationships and are isolated from the core user domain.

---

## 3. Index Summary

| Table | Index | Columns | Notes |
|---|---|---|---|
| `users`                  | PK                        | `id`            | uuid |
| `refresh_tokens`         | unique                    | `token`         | hashed |
| `refresh_tokens`         | unique                    | `familyId`, `version` | token rotation |
| `refresh_tokens`         | btree                     | `userId`        | |
| `refresh_tokens`         | btree                     | `familyId`      | |
| `bookings`               | btree                     | `userId`        | |
| `bookings`               | btree                     | `workspaceId`   | |
| `bookings`               | btree                     | `status`        | |
| `payments`               | btree                     | `bookingId`     | |
| `payments`               | btree                     | `userId`        | |
| `payments`               | btree                     | `providerReference` | |
| `invoices`               | unique                    | `invoiceNumber` | human-readable |
| `invoices`               | btree                     | `userId`        | |
| `invoices`               | btree                     | `bookingId`     | |
| `workspace_logs`         | composite                 | `workspaceId`, `checkedInAt` | |
| `workspace_logs`         | composite                 | `userId`, `checkedInAt`      | |
| `notifications`          | composite                 | `userId`, `isRead`           | |
| `newsletter_subscribers` | unique                    | `email`        | |
| `newsletter_subscribers` | btree                     | `email`        | |
| `newsletter_subscribers` | btree                     | `isActive`     | |
| `newsletter_subscribers` | btree                     | `isVerified`   | |

---

## 4. Conventions

- **Money:** all monetary amounts are stored in **kobo** (smallest currency unit) as
  `bigint` to avoid floating-point errors.
- **Timestamps:** `timestamptz` for absolute instants, `date` for calendar days
  (e.g. `Booking.startDate`).
- **Soft deletes:** `User` and `NewsletterSubscriber` use a `deletedAt` column
  driven by TypeORM's `@DeleteDateColumn`. All other tables hard-delete.
- **Excluded fields:** sensitive columns on `User` (password, OTP secrets, tokens)
  are decorated with `@Exclude()` so they are stripped from JSON responses.
  These columns exist in the database (with `varchar`/`text`/`jsonb`/`timestamptz`
  types as listed in the ER diagram) but never reach the API consumer.
- **Audit columns:** most entities expose `createdAt` / `updatedAt` via
  `@CreateDateColumn` / `@UpdateDateColumn`.
- **Cascade vs Restrict:** cascading deletes are reserved for strictly-owned rows
  (refresh tokens, notifications). Domain entities (`Booking`, `Payment`,
  `Invoice`, `WorkspaceLog`) refuse to delete their parent user/workspace to
  preserve audit trails — `RESTRICT` is enforced at the database level.
- **Biometric data:** `WorkspaceLog` stores only privacy-safe markers (hash,
  vendor reference, processing location) — never raw biometric templates.
  See [`docs/THREAT-MODEL.md`](../../docs/THREAT-MODEL.md) for the full threat model.

---

## 5. Keeping this document in sync

The CI workflow includes a **`verify-data-model`** job that:

1. Computes `git diff --name-only origin/main...HEAD`.
2. If any path matches `\.entity\.ts$` and **no** path matches
   `backend/docs/data-model\.md$`, the job fails with an `::error::` annotation.

To regenerate after a deliberate schema change, edit the Mermaid block above
and (if helpful) regenerate a visual preview with any Mermaid live editor before
committing.
