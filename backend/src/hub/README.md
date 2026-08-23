# `hub/`

Multi-tenant (hub) isolation for NovaLabs.

## Purpose

Resolves the active hub for each request and stores it in
`TenantContext` (AsyncLocalStorage) so services can scope queries without
threading `hubId` through every call.

## Key entities

| Entity | Role |
|--------|------|
| `Hub`  | A tenant (physical or logical location) |

## Endpoints

None. This module is infrastructure: `TenantInterceptor` is applied
globally in `main.ts`. It does not expose HTTP routes.

Resolution order: JWT `hubId` claim → `x-hub-id` header → `'default'`.
Scrapers and other unauthenticated GETs (e.g. `/api/metrics`) fall
through to `'default'` and are not blocked.

## Key files

| File                     | Role                                      |
| ------------------------ | ----------------------------------------- |
| `hub.module.ts`          | Global module; exports Hub repo + interceptor |
| `entities/hub.entity.ts` | Hub TypeORM entity                        |
| `tenant.interceptor.ts`  | Resolves hubId after the guard pipeline   |
| `tenant.context.ts`      | AsyncLocalStorage tenant context          |
