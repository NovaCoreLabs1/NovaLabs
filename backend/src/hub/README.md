# `hub/`

Multi-tenant (hub) management module. Hosts:

- **Hub entity** (`Hub`) — TypeORM entity representing a co-working hub (tenant),
  with fields `id`, `name`, `slug`, `description`, `isActive`, `createdAt`,
  `updatedAt`
- **TenantContext** (`TenantContext`) — Lightweight `AsyncLocalStorage`-based
  tenant context that stores the active `hubId` per request, accessible via
  `tenantContext.getHubId()`
- **TenantInterceptor** (`TenantInterceptor`) — NestJS interceptor that resolves
  the active tenant for each request from the JWT `hubId` claim, the
  `x-hub-id` header, or falls back to `'default'`

## Multi-tenancy design

Each hub is a physically or logically separated location. All tenant-owned
entities (User, Workspace, Booking, etc.) carry a `hubId` foreign key back
to the `hubs` table, enabling operators to run multiple hubs from a single
NovaLabs deployment.

Legacy rows created before multi-tenancy was introduced are assigned to a
**default hub** (slug: `default`) via a backfill migration.

## Tenant resolution order

1. Authenticated user's JWT `hubId` claim
2. `x-hub-id` request header (service-to-service calls)
3. Falls back to `'default'`

Admin users may switch hubs via the `x-hub-id` header; regular users who
attempt to override their assigned hub receive a `403 Forbidden`.

## Key files

| File | Purpose |
|------|---------|
| `entities/hub.entity.ts` | TypeORM `Hub` entity |
| `hub.module.ts` | Global module registration |
| `tenant.context.ts` | `AsyncLocalStorage`-based tenant context |
| `tenant.interceptor.ts` | Request-scoped tenant resolution interceptor |
