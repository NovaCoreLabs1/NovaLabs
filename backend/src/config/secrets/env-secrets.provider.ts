import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SecretsProvider } from './secrets-provider.interface';

/**
 * Reads secrets directly from `process.env`.
 *
 * This is the default provider and requires no external dependencies.
 * Suitable for local development, CI pipelines, and any environment where
 * secrets are injected via environment variables (e.g. Docker, Railway,
 * Render, Heroku, AWS ECS task definitions).
 *
 * Activate with `SECRETS_PROVIDER=env` (or leave unset — this is the default).
 */
@Injectable()
export class EnvSecretsProvider implements SecretsProvider {
  private readonly logger = new Logger(EnvSecretsProvider.name);

  async getSecret(key: string): Promise<string> {
    const value = process.env[key];
    if (value === undefined || value === '') {
      this.logger.warn(`Secret key "${key}" not found in process.env`);
      throw new NotFoundException(`Secret "${key}" is not defined in the environment`);
    }
    return value;
  }
}
