# `hub/`

Multi-tenant isolation module — the source of truth for co-working hubs
(tenants) and the per-request tenant context used across the backend.

## Purpose

Lets a single NovaLabs deployment run multiple hubs from one codebase. The
module:

- Defines the `Hub` entity that every tenant-owned row (`User`, `Workspace`,
  `Booking`, `Payment`, …) references via its `hubId` foreign key.
- Resolves the **active hub** for each incoming request and stores it in an
  `AsyncLocalStorage`-backed `TenantContext`, so downstream services, guards,
  and interceptors can read `tenantContext.getHubId()` without threading a
  tenant parameter through every call signature.

## Tenant resolution

The `TenantInterceptor` (registered globally in `main.ts` via
`app.useGlobalInterceptors`) resolves the active hub per request in this order:

1. The authenticated user's JWT `hubId` claim.
2. The `x-hub-id` request header (used for service-to-service calls).
3. Fallback to `default`.

Admin users may switch hubs via the `x-hub-id` header; a regular user who
tries to override their assigned hub receives `403 Forbidden`.

## Key Entities

- **Hub** (`entities/hub.entity.ts`) — a physical/logical co-working location.
  Columns: `id` (UUID), `name` (unique), `slug` (URL-safe, unique, used in API
  paths and the JWT `hubId` claim), `description`, `isActive`, timestamps.
  Legacy rows created before multi-tenancy are backfilled to the **default hub**
  (slug `default`).

## Endpoints

This module exposes **no HTTP endpoints of its own**; it is registered as a
`@Global()` infrastructure module in `AppModule`. Tenant isolation is applied
transparently to every request handled by the backend.

## Key Files

| File                        | Role                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `hub.module.ts`             | `@Global()` NestJS module; registers/exports `Hub` and the interceptor |
| `tenant.context.ts`         | `AsyncLocalStorage`-backed `TenantContext` singleton           |
| `tenant.interceptor.ts`     | Resolves + enforces the active hub per request                 |
| `entities/hub.entity.ts`    | TypeORM `Hub` entity (`hubs` table)                            |
