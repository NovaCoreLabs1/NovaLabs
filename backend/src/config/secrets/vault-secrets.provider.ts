import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SecretsProvider } from './secrets-provider';

/**
 * Fetches secrets from HashiCorp Vault KV v2 engine.
 *
 * Required env vars (preferably from EnvSecretsProvider):
 *   VAULT_ADDR    – Vault server URL (e.g. https://vault.example.com:8200)
 *   VAULT_TOKEN   – Vault authentication token
 *   VAULT_KV_PATH – KV v2 mount path + secret path (e.g. "secret/data/nova-labs")
 *
 * Optional:
 *   VAULT_NAMESPACE  – Vault enterprise namespace
 *   VAULT_CACHE_TTL_MS – Cache duration in ms (default: 300000 / 5 min)
 */
@Injectable()
export class VaultSecretsProvider extends SecretsProvider {
  private readonly logger = new Logger(VaultSecretsProvider.name);
  private readonly vaultAddr: string;
  private readonly vaultToken: string;
  private readonly kvPath: string;
  private readonly vaultNamespace?: string;
  private readonly cacheExpiryMs: number;
  private cachedSecrets: Record<string, string> | null = null;
  private cacheExpiresAt = 0;

  constructor(configService: ConfigService) {
    super();
    this.vaultAddr =
      configService.get<string>('VAULT_ADDR') ||
      configService.get<string>('VAULT_ADDRESS') ||
      '';
    this.vaultToken = configService.get<string>('VAULT_TOKEN') || '';
    this.kvPath =
      configService.get<string>('VAULT_KV_PATH') ||
      configService.get<string>('VAULT_SECRET_PATH') ||
      '';
    this.vaultNamespace = configService.get<string>('VAULT_NAMESPACE');
    this.cacheExpiryMs =
      configService.get<number>('VAULT_CACHE_TTL_MS') ?? 300_000;
  }

  /**
   * Fetch the full secret bundle from Vault KV v2 and cache it.
   */
  private async fetchSecrets(): Promise<Record<string, string>> {
    if (this.cachedSecrets && Date.now() < this.cacheExpiresAt) {
      return this.cachedSecrets;
    }

    if (!this.vaultAddr) {
      throw new Error(
        'VaultSecretsProvider requires VAULT_ADDR to be set in the environment.',
      );
    }
    if (!this.vaultToken) {
      throw new Error(
        'VaultSecretsProvider requires VAULT_TOKEN to be set in the environment.',
      );
    }
    if (!this.kvPath) {
      throw new Error(
        'VaultSecretsProvider requires VAULT_KV_PATH to be set in the environment.',
      );
    }

    // KV v2 API path: /v1/{mount}/data/{path}
    const apiPath = this.kvPath.startsWith('/')
      ? this.kvPath
      : `/v1/${this.kvPath}`;
    const url = `${this.vaultAddr}${apiPath}`;

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.vaultToken}`,
        'Content-Type': 'application/json',
      };
      if (this.vaultNamespace) {
        headers['X-Vault-Namespace'] = this.vaultNamespace;
      }

      const response = await axios.get<{
        data?: { data?: Record<string, unknown> };
      }>(url, { headers });

      const rawData = response.data.data?.data;
      if (!rawData) {
        throw new Error(
          `Vault response missing data.data at path "${this.kvPath}".`,
        );
      }

      const secrets: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawData)) {
        secrets[key] = String(value);
      }

      this.cachedSecrets = secrets;
      this.cacheExpiresAt = Date.now() + this.cacheExpiryMs;

      return secrets;
    } catch (error) {
      this.logger.error(
        `Failed to fetch secrets from Vault: ${(error as Error).message}`,
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
        `VaultSecretsProvider.get("${key}") failed: ${(error as Error).message}. ` +
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
          `Verified neither Vault nor environment variable is set.`,
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
