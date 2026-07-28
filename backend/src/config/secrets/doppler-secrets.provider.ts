import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { SecretsProvider } from './secrets-provider.interface';

/**
 * Fetches secrets from Doppler using the Secrets API.
 *
 * ## Required environment variables
 *
 * | Variable              | Description                                                       |
 * |-----------------------|-------------------------------------------------------------------|
 * | `DOPPLER_TOKEN`       | Doppler service token with read access to the target project      |
 *
 * The service token implicitly determines the project and config (environment),
 * so no additional project/config variables are needed.
 *
 * ## Activate
 *
 * Set `SECRETS_PROVIDER=doppler` in your environment.
 *
 * ## References
 * - https://docs.doppler.com/reference/secrets-get
 */
@Injectable()
export class DopplerSecretsProvider implements SecretsProvider {
  private readonly logger = new Logger(DopplerSecretsProvider.name);
  private readonly DOPPLER_API = 'https://api.doppler.com/v3/configs/config/secret';

  /** All secrets fetched in a single Doppler download, cached for the process lifetime. */
  private cache: Record<string, string> | null = null;

  private get dopplerToken(): string {
    const token = process.env.DOPPLER_TOKEN;
    if (!token) throw new Error('DOPPLER_TOKEN environment variable is not set');
    return token;
  }

  private async loadSecrets(): Promise<Record<string, string>> {
    if (this.cache) return this.cache;

    // Doppler's /download endpoint returns a flat JSON object of all secrets.
    const url = 'https://api.doppler.com/v3/configs/config/secrets/download';
    this.logger.log('Loading secrets from Doppler');

    const response = await axios.get<Record<string, string>>(url, {
      params: { format: 'json' },
      auth: { username: this.dopplerToken, password: '' },
      timeout: 10_000,
    });

    this.cache = response.data ?? {};
    return this.cache;
  }

  async getSecret(key: string): Promise<string> {
    const secrets = await this.loadSecrets();
    const value = secrets[key];
    if (value === undefined) {
      this.logger.warn(`Secret key "${key}" not found in Doppler`);
      throw new NotFoundException(`Secret "${key}" not found in Doppler`);
    }
    return value;
  }
}
