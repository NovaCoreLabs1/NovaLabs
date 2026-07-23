import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SecretsProvider } from './secrets-provider';

/**
 * Fetches secrets from the Doppler API (v3 /secrets/download).
 *
 * Requires the following env vars (preferably from EnvSecretsProvider):
 *   DOPPLER_TOKEN – Doppler service token with read access to the project
 *
 * When DOPPLER_TOKEN is not set, the provider falls back to reading
 * DOPPLER_SERVICE_TOKEN for backward compatibility.
 */
@Injectable()
export class DopplerSecretsProvider extends SecretsProvider {
  private readonly logger = new Logger(DopplerSecretsProvider.name);
  private readonly dopplerToken: string;
  private readonly apiBase: string;
  private readonly cacheExpiryMs: number;
  private cachedSecrets: Record<string, string> | null = null;
  private cacheExpiresAt = 0;

  constructor(configService: ConfigService) {
    super();
    this.dopplerToken =
      configService.get<string>('DOPPLER_TOKEN') ||
      configService.get<string>('DOPPLER_SERVICE_TOKEN') ||
      '';
    this.apiBase =
      configService.get<string>('DOPPLER_API_BASE') ||
      'https://api.doppler.com/v3';
    this.cacheExpiryMs =
      configService.get<number>('DOPPLER_CACHE_TTL_MS') ?? 300_000;
  }

  /**
   * Fetch the full secret bundle from Doppler and cache it.
   */
  private async fetchSecrets(): Promise<Record<string, string>> {
    if (this.cachedSecrets && Date.now() < this.cacheExpiresAt) {
      return this.cachedSecrets;
    }

    if (!this.dopplerToken) {
      throw new Error(
        'DopplerSecretsProvider requires DOPPLER_TOKEN (or DOPPLER_SERVICE_TOKEN) ' +
          'to be set in the environment.',
      );
    }

    try {
      const url = `${this.apiBase}/secrets/download`;
      const response = await axios.get<{
        secrets: Record<string, { raw: string }>;
      }>(url, {
        headers: {
          Authorization: `Bearer ${this.dopplerToken}`,
        },
      });

      const secrets: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.data.secrets || {})) {
        secrets[key] = value.raw;
      }

      this.cachedSecrets = secrets;
      this.cacheExpiresAt = Date.now() + this.cacheExpiryMs;

      return secrets;
    } catch (error) {
      this.logger.error(
        `Failed to fetch secrets from Doppler: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async get(key: string): Promise<string | undefined> {
    try {
      const secrets = await this.fetchSecrets();
      return secrets[key];
    } catch (error) {
      this.logger.warn(
        `DopplerSecretsProvider.get("${key}") failed: ${(error as Error).message}. ` +
          `Falling back to process.env.`,
      );
      return process.env[key];
    }
  }

  async getOrThrow(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === undefined) {
      throw new Error(
        `Missing required secret: "${key}". ` +
          `Verified neither Doppler nor environment variable is set.`,
      );
    }
    return value;
  }

  async getMany(
    keys: string[],
  ): Promise<Record<string, string | undefined>> {
    const secrets = await this.fetchSecrets();
    const result: Record<string, string | undefined> = {};
    for (const key of keys) {
      result[key] = secrets[key];
    }
    return result;
  }
}
