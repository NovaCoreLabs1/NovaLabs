import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SecretsProvider } from './secrets-provider.interface';

/**
 * Fetches secrets from AWS Secrets Manager.
 *
 * The AWS SDK (`@aws-sdk/client-secrets-manager`) is loaded dynamically at
 * runtime so that the package remains an optional peer dependency — teams not
 * using AWS will not need to install it.
 *
 * ## Required environment variables
 *
 * | Variable                  | Description                                                  |
 * |---------------------------|--------------------------------------------------------------|
 * | `AWS_REGION`              | AWS region (e.g. `us-east-1`)                                |
 * | `AWS_SECRETS_NAME`        | Name or ARN of the Secrets Manager secret to load            |
 * | `AWS_ACCESS_KEY_ID`       | AWS access key ID (optional when running on EC2/ECS/Lambda)  |
 * | `AWS_SECRET_ACCESS_KEY`   | AWS secret access key (optional when using IAM roles)        |
 *
 * The secret value should be a JSON object where each top-level key
 * corresponds to a secret name (e.g. `{ "DATABASE_PASSWORD": "s3cr3t" }`).
 *
 * ## Activate
 *
 * Set `SECRETS_PROVIDER=aws` in your environment and ensure
 * `@aws-sdk/client-secrets-manager` is installed:
 * ```
 * npm install @aws-sdk/client-secrets-manager
 * ```
 *
 * ## References
 * - https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
 */
@Injectable()
export class AwsSecretsProvider implements SecretsProvider {
  private readonly logger = new Logger(AwsSecretsProvider.name);

  /** Parsed JSON payload from Secrets Manager, cached for the process lifetime. */
  private cache: Record<string, string> | null = null;

  private get secretName(): string {
    const name = process.env.AWS_SECRETS_NAME;
    if (!name) throw new Error('AWS_SECRETS_NAME environment variable is not set');
    return name;
  }

  private async loadSecrets(): Promise<Record<string, string>> {
    if (this.cache) return this.cache;

    // Dynamic import so @aws-sdk/client-secrets-manager is optional at bundle time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let SecretsManagerClient: any, GetSecretValueCommand: any;
    try {
      // Use require() wrapped in eval to prevent TS from resolving the type at
      // compile time.  This keeps @aws-sdk/client-secrets-manager as a true
      // optional peer dependency.
      // eslint-disable-next-line no-eval
      const mod = eval('require')('@aws-sdk/client-secrets-manager') as {
        SecretsManagerClient: any;
        GetSecretValueCommand: any;
      };
      SecretsManagerClient = mod.SecretsManagerClient;
      GetSecretValueCommand = mod.GetSecretValueCommand;
    } catch {
      throw new Error(
        'AwsSecretsProvider requires @aws-sdk/client-secrets-manager. ' +
          'Install it with: npm install @aws-sdk/client-secrets-manager',
      );
    }

    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
    });

    this.logger.log(`Loading secrets from AWS Secrets Manager: ${this.secretName}`);

    const command = new GetSecretValueCommand({ SecretId: this.secretName });
    const response = await client.send(command);

    const raw: string = response.SecretString ?? '';
    try {
      this.cache = JSON.parse(raw) as Record<string, string>;
    } catch {
      throw new Error(
        `AWS secret "${this.secretName}" is not valid JSON. ` +
          'The secret value must be a JSON object mapping secret names to values.',
      );
    }

    return this.cache;
  }

  async getSecret(key: string): Promise<string> {
    const secrets = await this.loadSecrets();
    const value = secrets[key];
    if (value === undefined) {
      this.logger.warn(`Secret key "${key}" not found in AWS secret "${this.secretName}"`);
      throw new NotFoundException(`Secret "${key}" not found in AWS Secrets Manager`);
    }
    return value;
  }
}
