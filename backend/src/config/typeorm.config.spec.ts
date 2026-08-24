import { join } from 'path';
import { buildTypeOrmOptions, EnvGetter } from './typeorm.config';

function envFrom(record: Record<string, string | undefined>): EnvGetter {
  return (key) => record[key];
}

describe('buildTypeOrmOptions (issue #228)', () => {
  it('keeps synchronize enabled outside production', () => {
    const options = buildTypeOrmOptions(envFrom({}));

    expect(options.synchronize).toBe(true);
  });

  // Behavior preserved verbatim from the inline factory in app.module.ts:
  // NODE_ENV=production forces SSL on, independent of any DATABASE_* value.
  it('disables synchronize in production and keeps the production-forced SSL', () => {
    const options = buildTypeOrmOptions(
      envFrom({ NODE_ENV: 'production', DATABASE_HOST: 'db.internal' }),
    );

    expect(options.synchronize).toBe(false);
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('keeps SSL off for plain non-production hosts', () => {
    const options = buildTypeOrmOptions(
      envFrom({ NODE_ENV: 'development', DATABASE_HOST: 'localhost' }),
    );

    expect(options.synchronize).toBe(true);
    expect(options.ssl).toBe(false);
  });

  it('requires SSL against Neon hosts regardless of environment', () => {
    const options = buildTypeOrmOptions(
      envFrom({ DATABASE_HOST: 'ep-cool-name-123.eu-central-1.aws.neon.tech' }),
    );

    expect(options.synchronize).toBe(true);
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });

  it.each([
    ['PGSSLMODE', 'require'],
    ['DATABASE_SSL', 'true'],
  ])('requires SSL when %s=%s', (key, value) => {
    const options = buildTypeOrmOptions(envFrom({ [key]: value }));

    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('falls back to port 5432 and localhost', () => {
    const options = buildTypeOrmOptions(envFrom({}));

    expect(options.port).toBe(5432);
    expect(options.host).toBe('localhost');
  });

  it('passes connection credentials through unchanged', () => {
    const options = buildTypeOrmOptions(
      envFrom({
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5433',
        DATABASE_USERNAME: 'nova',
        DATABASE_PASSWORD: 'secret',
        DATABASE_NAME: 'nova_db',
      }),
    );

    expect(options.host).toBe('localhost');
    expect(options.port).toBe(5433);
    expect(options.username).toBe('nova');
    expect(options.password).toBe('secret');
    expect(options.database).toBe('nova_db');
  });

  it('points migrations at src/migrations and entities at the source tree', () => {
    const options = buildTypeOrmOptions(envFrom({}));
    const [entitiesGlob] = options.entities as string[];
    const [migrationsGlob] = options.migrations as string[];

    expect(entitiesGlob).toMatch(/src(.{1}|\*\*)\*\*.*\.entity\{\.ts,\.js\}$/);
    expect(migrationsGlob).toContain(join('migrations'));
  });
});
