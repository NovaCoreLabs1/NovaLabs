# `audit-log/`

Immutable audit trail and security logging module.

## Purpose

Records every significant action in the system — logins, booking mutations,
payment events, GDPR anonymisations, refresh token revocations — in an
append-only `audit_log` table. Supports regulatory compliance (GDPR, PCI-like)
and security incident investigations.

## Key Entities

- **AuditLog** (`entities/audit-log.entity.ts`) — immutable row recording `actorId`,
  `actorEmail`, `actorRole`, `action`, `targetType`, `targetId`, `ipAddress`,
  `userAgent`, and optional `metadata` JSON.
- **SecurityIpLog** (`entities/security-ip-log.entity.ts`) — IP-based security events
  (rate-limit hits, brute-force indicators).

## Audit Actions

Defined in the `AuditAction` enum. Examples:

- `users.anonymise` — GDPR right-to-be-forgotten
- `REFRESH_FAMILY_REVOKED` — token reuse detected
- Booking lifecycle events, payment events, etc.

## Key Files

| File                                         | Role                                |
| -------------------------------------------- | ----------------------------------- |
| `audit-log.module.ts`                        | NestJS module registration          |
| `audit-log.controller.ts`                    | Query endpoints (admin-only)        |
| `providers/audit-log.service.ts`             | Core audit logging service           |
| `providers/create-audit-log.provider.ts`     | Audit log creation                   |
| `providers/find-audit-logs.provider.ts`      | Audit log queries                    |
| `providers/audit-log-purge.service.ts`       | Scheduled purge of old logs          |
| `providers/anonymisation-hardening.cron.ts`  | Daily sweep for GDPR hardening       |
| `providers/security-ip-log.service.ts`       | IP security event tracking           |
| `interceptors/audit-log.interceptor.ts`      | Automatic HTTP audit interceptor     |
| `entities/audit-log.entity.ts`               | TypeORM entity                       |
| `entities/security-ip-log.entity.ts`         | TypeORM entity                       |
| `dto/audit-log-filter.dto.ts`                | Query filter DTO                    |
| `audit-log.service.spec.ts`                  | Unit tests                           |
