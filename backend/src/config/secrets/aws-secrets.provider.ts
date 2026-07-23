import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { SecretsProvider } from './secrets-provider';

/**
 * Fetches secrets from AWS Secrets Manager.
 *
 * Required env vars (preferably from EnvSecretsProvider):
 *   AWS_REGION              – AWS region (e.g. us-east-1)
 *   AWS_SECRETS_MANAGER_ARN – ARN or name of the secret in Secrets Manager
 *
 * Authentication is handled by the default AWS credential chain
 * (env vars, ~/.aws/credentials, IAM roles, etc.).
 *
 * The AWS SDK client is lazily instantiated so no network calls happen
 * at module load time.
 */
@Injectable()
export class AwsSecretsProvider extends SecretsProvider {
  private readonly logger = new Logger(AwsSecretsProvider.name);
  private readonly region: string;
  private readonly secretArn: string;
  private readonly cacheExpiryMs: number;
  private cachedSecrets: Record<string, string> | null = null;
  private cacheExpiresAt = 0;

  private client: SecretsManagerClient | null = null;

  constructor(configService: ConfigService) {
    super();
    this.region =
      configService.get<string>('AWS_REGION') ||
      configService.get<string>('AWS_DEFAULT_REGION') ||
      'us-east-1';
    this.secretArn =
      configService.get<string>('AWS_SECRETS_MANAGER_ARN') ||
      configService.get<string>('AWS_SECRETS_MANAGER_SECRET_ID') ||
      '';
    this.cacheExpiryMs =
      configService.get<number>('AWS_SECRETS_CACHE_TTL_MS') ?? 300_000;
  }

  /**
   * Lazily instantiate the AWS Secrets Manager client.
   */
  private getClient(): SecretsManagerClient {
    if (!this.client) {
      this.client = new SecretsManagerClient({ region: this.region });
    }
    return this.client;
  }

  /**
   * Fetch and parse the full secret JSON from AWS Secrets Manager.
   */
  private async fetchSecrets(): Promise<Record<string, string>> {
    if (this.cachedSecrets && Date.now() < this.cacheExpiresAt) {
      return this.cachedSecrets;
    }

    if (!this.secretArn) {
      throw new Error(
        'AwsSecretsProvider requires AWS_SECRETS_MANAGER_ARN ' +
          '(or AWS_SECRETS_MANAGER_SECRET_ID) to be set.',
      );
    }

    try {
      const client = this.getClient();
      const command = new GetSecretValueCommand({
        SecretId: this.secretArn,
      });
      const response = await client.send(command);

      const secretString =
        response.SecretString ||
        (response.SecretBinary
          ? Buffer.from(response.SecretBinary).toString()
          : null);

      if (!secretString) {
        throw new Error(
          `Secret "${this.secretArn}" returned no value (SecretString/SecretBinary is empty).`,
        );
      }

      let parsed: Record<string, string>;

      try {
        const raw = JSON.parse(secretString) as Record<string, unknown>;
        parsed = {};
        for (const [k, v] of Object.entries(raw)) {
          parsed[k] = String(v);
        }
      } catch {
        // Plain string secret — wrap under the last path segment
        const key = this.secretArn.split('/').pop() || 'secret';
        parsed = { [key]: secretString };
      }

      this.cachedSecrets = parsed;
      this.cacheExpiresAt = Date.now() + this.cacheExpiryMs;

      return parsed;
    } catch (error) {
      this.logger.error(
        `Failed to fetch secrets from AWS Secrets Manager: ${(error as Error).message}`,
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
        `AwsSecretsProvider.get("${key}") failed: ${(error as Error).message}. ` +
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
          `Verified neither AWS Secrets Manager nor environment variable is set.`,
      );
    }
    return value;
  }

  async getMany(keys: string[]): Promise<Record<string, string | undefined>> {
    const secrets = await this.fetchSecrets();
    const result: Record<string, string | undefined> = {};
    for (const key of keys) {
      result[key] = secrets[key];
    }
    return result;
  }
}
