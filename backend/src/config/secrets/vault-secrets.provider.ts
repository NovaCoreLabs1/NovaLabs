import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { SecretsProvider } from './secrets-provider.interface';

/**
 * Fetches secrets from HashiCorp Vault using the KV v2 secrets engine.
 *
 * ## Required environment variables
 *
 * | Variable              | Description                                               |
 * |-----------------------|-----------------------------------------------------------|
 * | `VAULT_ADDR`          | Base URL of the Vault server (e.g. `http://vault:8200`)   |
 * | `VAULT_TOKEN`         | Vault token with read access to the configured mount path |
 * | `VAULT_MOUNT`         | KV v2 mount path (default: `secret`)                      |
 * | `VAULT_SECRET_PATH`   | Path under the mount (default: `novalabs`)                |
 *
 * ## Activate
 *
 * Set `SECRETS_PROVIDER=vault` in your environment.
 *
 * ## References
 * - https://developer.hashicorp.com/vault/api-docs/secret/kv/kv-v2
 */
@Injectable()
export class VaultSecretsProvider implements SecretsProvider {
  private readonly logger = new Logger(VaultSecretsProvider.name);

  /** All secrets fetched in a single Vault read, cached for the process lifetime. */
  private cache: Record<string, string> | null = null;

  private get vaultAddr(): string {
    return process.env.VAULT_ADDR ?? 'http://localhost:8200';
  }

  private get vaultToken(): string {
    const token = process.env.VAULT_TOKEN;
    if (!token) throw new Error('VAULT_TOKEN environment variable is not set');
    return token;
  }

  private get mountPath(): string {
    return process.env.VAULT_MOUNT ?? 'secret';
  }

  private get secretPath(): string {
    return process.env.VAULT_SECRET_PATH ?? 'novalabs';
  }

  /**
   * Fetches the full secret map from Vault on first call, then serves
   * subsequent requests from an in-process cache.
   */
  private async loadSecrets(): Promise<Record<string, string>> {
    if (this.cache) return this.cache;

    const url = `${this.vaultAddr}/v1/${this.mountPath}/data/${this.secretPath}`;
    this.logger.log(`Loading secrets from Vault: ${url}`);

    const response = await axios.get<{ data: { data: Record<string, string> } }>(url, {
      headers: { 'X-Vault-Token': this.vaultToken },
      timeout: 10_000,
    });

    this.cache = response.data?.data?.data ?? {};
    return this.cache;
  }

  async getSecret(key: string): Promise<string> {
    const secrets = await this.loadSecrets();
    const value = secrets[key];
    if (value === undefined) {
      this.logger.warn(`Secret key "${key}" not found in Vault path "${this.secretPath}"`);
      throw new NotFoundException(`Secret "${key}" not found in Vault`);
    }
    return value;
  }
}
