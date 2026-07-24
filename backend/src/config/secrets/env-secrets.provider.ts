import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsProvider } from './secrets-provider';

/**
 * Reads secrets from environment variables via NestJS ConfigService.
 *
 * This is the default provider and requires no external infrastructure.
 * It is also used as the fallback when a remote provider is unavailable
 * for a particular key.
 */
@Injectable()
export class EnvSecretsProvider extends SecretsProvider {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async get(key: string): Promise<string | undefined> {
    const value = this.configService.get<string>(key);
    return value ?? undefined;
  }

  async getOrThrow(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === undefined) {
      throw new Error(
        `Missing required secret: "${key}". ` +
          `Ensure the variable is set in your environment or secrets backend.`,
      );
    }
    return value;
  }

  async getMany(keys: string[]): Promise<Record<string, string | undefined>> {
    const result: Record<string, string | undefined> = {};
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    return result;
  }
}
