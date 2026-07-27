import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsProvider } from './secrets-provider.interface';
import { EnvSecretsProvider } from './env-secrets.provider';
import { VaultSecretsProvider } from './vault-secrets.provider';
import { DopplerSecretsProvider } from './doppler-secrets.provider';
import { AwsSecretsProvider } from './aws-secrets.provider';

/**
 * Injection token for the active `SecretsProvider`.
 *
 * Inject it anywhere with:
 * ```ts
 * @Inject(SECRETS_PROVIDER)
 * private readonly secrets: SecretsProvider,
 * ```
 */
export const SECRETS_PROVIDER = Symbol('SECRETS_PROVIDER');

/**
 * SecretsModule registers the appropriate `SecretsProvider` implementation
 * based on the `SECRETS_PROVIDER` environment variable.
 *
 * | `SECRETS_PROVIDER` value | Provider class           |
 * |--------------------------|--------------------------|
 * | `env` (default / unset)  | `EnvSecretsProvider`     |
 * | `vault`                  | `VaultSecretsProvider`   |
 * | `doppler`                | `DopplerSecretsProvider` |
 * | `aws`                    | `AwsSecretsProvider`     |
 *
 * Import `SecretsModule` into any feature module that needs runtime secrets.
 * Because it is marked `global: false`, you must import it explicitly in each
 * module that requires it.  If you prefer a single global registration, set
 * `global: true` in the `@Module` decorator or use `SecretsModule.forRoot()`.
 *
 * ## Example
 *
 * ```ts
 * // app.module.ts
 * imports: [SecretsModule, ...],
 * ```
 *
 * ```ts
 * // some.service.ts
 * import { Inject } from '@nestjs/common';
 * import { SECRETS_PROVIDER } from 'src/config/secrets/secrets.module';
 * import type { SecretsProvider } from 'src/config/secrets/secrets-provider.interface';
 *
 * @Injectable()
 * export class SomeService {
 *   constructor(
 *     @Inject(SECRETS_PROVIDER) private readonly secrets: SecretsProvider,
 *   ) {}
 *
 *   async doWork() {
 *     const dbPassword = await this.secrets.getSecret('DATABASE_PASSWORD');
 *   }
 * }
 * ```
 */
@Module({
  imports: [ConfigModule],
  providers: [
    EnvSecretsProvider,
    VaultSecretsProvider,
    DopplerSecretsProvider,
    AwsSecretsProvider,
    {
      provide: SECRETS_PROVIDER,
      useFactory: (
        env: EnvSecretsProvider,
        vault: VaultSecretsProvider,
        doppler: DopplerSecretsProvider,
        aws: AwsSecretsProvider,
      ): SecretsProvider => {
        const providerName = (process.env.SECRETS_PROVIDER ?? 'env').toLowerCase();
        const logger = new Logger('SecretsModule');

        const providerMap: Record<string, SecretsProvider> = {
          env: env,
          vault: vault,
          doppler: doppler,
          aws: aws,
        };

        const provider = providerMap[providerName];
        if (!provider) {
          logger.warn(
            `Unknown SECRETS_PROVIDER "${providerName}", falling back to "env". ` +
              `Valid values: ${Object.keys(providerMap).join(', ')}`,
          );
          return env;
        }

        logger.log(`Active secrets provider: ${providerName}`);
        return provider;
      },
      inject: [EnvSecretsProvider, VaultSecretsProvider, DopplerSecretsProvider, AwsSecretsProvider],
    },
  ],
  exports: [SECRETS_PROVIDER],
})
export class SecretsModule {}
