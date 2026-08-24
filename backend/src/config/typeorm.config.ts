import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

// The typeorm:* npm scripts boot this file outside NestJS, so the local
// .env file has to be loaded explicitly here (ConfigModule does that for
// the application runtime). Existing environment variables always win.
loadEnv();

/**
 * Environment accessor — `ConfigService.get` in the app, `process.env[k]`
 * in the migration CLI. Keeping the builder a pure function over this
 * accessor is what lets both entry points share one source of truth.
 */
export type EnvGetter = (key: string) => string | undefined;

/**
 * Single source of TypeORM connection options, shared by
 * `app.module.ts` (via ConfigService) and the migration CLI datasource
 * (default export below) so the two can never drift.
 *
 * Schema policy: `synchronize` stays enabled for local development but is
 * disabled in production — schema changes must ship as migrations under
 * `src/migrations/`. CI enforces this with a schema-drift check.
 */
export function buildTypeOrmOptions(
  getEnv: EnvGetter,
): PostgresConnectionOptions {
  const host = getEnv('DATABASE_HOST');
  const sslRequired =
    getEnv('NODE_ENV') === 'production' ||
    getEnv('PGSSLMODE') === 'require' ||
    getEnv('DATABASE_SSL') === 'true' ||
    (host ? host.includes('neon.tech') : false);

  return {
    type: 'postgres',
    host: host || 'localhost',
    port: Number(getEnv('DATABASE_PORT') ?? 5432),
    username: getEnv('DATABASE_USERNAME'),
    password: getEnv('DATABASE_PASSWORD'),
    database: getEnv('DATABASE_NAME'),
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
    synchronize: getEnv('NODE_ENV') !== 'production',
    ssl: sslRequired ? { rejectUnauthorized: false } : false,
  };
}

/**
 * Standalone datasource consumed by every `typeorm:*` script in
 * backend/package.json via `-d ./src/config/typeorm.config.ts`.
 */
export default new DataSource(buildTypeOrmOptions((key) => process.env[key]));
