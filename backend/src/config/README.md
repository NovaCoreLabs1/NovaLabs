# `config/`

Application configuration and infrastructure module.

## Purpose

Centralizes environment-based configuration (database, app settings),
secrets management (multi-provider), and pagination utilities.

## Sub-modules

- **[`secrets/`](secrets/README.md)** — Vendor-neutral secrets abstraction
  supporting env, Doppler, HashiCorp Vault, and AWS Secrets Manager.

## Key Files

| File                             | Role                                |
| -------------------------------- | ----------------------------------- |
| `app.config.ts`                  | Application-level configuration     |
| `database-config.ts`             | TypeORM database configuration      |
| `typeorm.config.ts`              | Shared TypeORM connection options + migration CLI datasource |
| `secrets/`                       | Secrets provider sub-module         |
| `pagination/interface/`          | Paginated response interface        |
| `pagination/dto/`                | Pagination query DTO                |

## TypeORM connection & migrations

`typeorm.config.ts` is the single source of TypeORM connection options:

- `app.module.ts` builds its `TypeOrmModule.forRootAsync` factory from
  `buildTypeOrmOptions()` (fed by `ConfigService`).
- The default export is a standalone `DataSource` consumed by every
  `typeorm:*` script in `backend/package.json`, so the migration CLI and the
  application always resolve the connection identically (including the
  Neon/SSL logic).

Schema policy: `synchronize` is enabled for local development and disabled
when `NODE_ENV=production`. Entity changes must be accompanied by a
migration under `src/migrations/`; CI enforces this with a schema-drift
check (`npm run typeorm:check-drift`). See `backend/README.md → Migrations`.
