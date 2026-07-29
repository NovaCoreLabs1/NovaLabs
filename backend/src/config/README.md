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
| `secrets/`                       | Secrets provider sub-module         |
| `pagination/interface/`          | Paginated response interface        |
| `pagination/dto/`                | Pagination query DTO                |
