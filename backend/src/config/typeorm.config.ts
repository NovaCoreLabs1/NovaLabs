import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

/**
 * Standalone TypeORM DataSource for CLI tools (migrations, erdia, etc.).
 *
 * Reads connection parameters from environment variables using the same
 * naming convention as the NestJS ConfigModule.
 *
 * Entity auto-loading: src/** /entities/*.entity.ts
 */
const options: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? process.env.DB_PORT ?? 5432),
  username: process.env.DATABASE_USERNAME ?? process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? process.env.DB_PASSWORD ?? 'password',
  database: process.env.DATABASE_NAME ?? process.env.DB_NAME ?? 'novalabs',
  entities: [join(__dirname, '..', '**', 'entities', '*.entity.{ts,js}')],
  synchronize: true,
  logging: false,
};

export const AppDataSource = new DataSource(options);
