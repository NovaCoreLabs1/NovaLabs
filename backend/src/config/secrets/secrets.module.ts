import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsProvider } from './secrets-provider';
import { EnvSecretsProvider } from './env-secrets.provider';
import { DopplerSecretsProvider } from './doppler-secrets.provider';
import { VaultSecretsProvider } from './vault-secrets.provider';
import { AwsSecretsProvider } from './aws-secrets.provider';

export type SecretsProviderType = 'env' | 'doppler' | 'vault' | 'aws';

/**
 * Determines which secrets backend to use at runtime.
 *
 * The provider is selected via the `SECRETS_PROVIDER` environment variable:
 *   - `env`     (default) – Reads from environment variables via ConfigService
 *   - `doppler`            – Fetches from Doppler API (requires DOPPLER_TOKEN)
 *   - `vault`              – Fetches from HashiCorp Vault (requires VAULT_* vars)
 *   - `aws`                – Fetches from AWS Secrets Manager (requires AWS_* vars)
 */
function resolveProviderType(): SecretsProviderType {
  const raw = (process.env.SECRETS_PROVIDER || 'env').toLowerCase();
  if (raw === 'doppler') return 'doppler';
  if (raw === 'vault') return 'vault';
  if (raw === 'aws') return 'aws';
  return 'env';
}

@Global()
@Module({})
export class SecretsModule {
  private static readonly logger = new Logger(SecretsModule.name);

  /**
   * Register the SecretsModule with the configured provider.
   *
   * Usage:
   * ```typescript
   * // In your AppModule imports:
   * SecretsModule.forRoot()
   * ```
   */
  static forRoot(): DynamicModule {
    const providerType = resolveProviderType();

    this.logger.log(`Initializing SecretsProvider: "${providerType}"`);

    const providers: any[] = [
      {
        provide: 'SECRETS_PROVIDER_TYPE',
        useValue: providerType,
      },
    ];

    switch (providerType) {
      case 'doppler':
        providers.push({
          provide: SecretsProvider,
          useClass: DopplerSecretsProvider,
        });
        break;
      case 'vault':
        providers.push({
          provide: SecretsProvider,
          useClass: VaultSecretsProvider,
        });
        break;
      case 'aws':
        providers.push({
          provide: SecretsProvider,
          useClass: AwsSecretsProvider,
        });
        break;
      case 'env':
      default:
        providers.push({
          provide: SecretsProvider,
          useClass: EnvSecretsProvider,
        });
        break;
    }

    return {
      module: SecretsModule,
      global: true,
      imports: [ConfigModule],
      providers,
      exports: [SecretsProvider],
    };
  }

  /**
   * Explicitly register a specific provider (useful for testing).
   */
  static forTest(provider: SecretsProvider): DynamicModule {
    return {
      module: SecretsModule,
      global: true,
      providers: [
        {
          provide: SecretsProvider,
          useValue: provider,
        },
      ],
      exports: [SecretsProvider],
    };
  }
}
