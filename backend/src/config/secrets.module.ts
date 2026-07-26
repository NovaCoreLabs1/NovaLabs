/**
 * `SecretsService` — global, polling-based secret registry.
 *
 * Behaviour:
 *
 *   - On `onModuleInit`, picks a `SecretProvider` based on
 *     `SECRETS_PROVIDER` (`env` | `doppler` | `vault`; default `env`).
 *   - Fetches the full secret map once, then re-fetches every
 *     `refreshIntervalMs` (default 60_000). Stale cache is kept on
 *     transient fetch failures so a Doppler/Vault outage does not
 *     break existing in-flight requests.
 *   - `get(key)` returns the cached value, falling back to
 *     `process.env[key]` so the path is a strict superset of the
 *     pre-existing behaviour.
 *
 * Backwards compatibility: when `SECRETS_PROVIDER` is unset or set to
 * `env`, the service is effectively a typed wrapper over
 * `process.env`; every existing `process.env.X` and
 * `ConfigService.get('X')` lookup continues to work unchanged.
 */
import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  SecretProvider,
  SecretProviderKind,
  SecretProviderOptions,
} from './secret-provider.interface';
import { buildSecretProvider, EnvSecretProvider } from './secret-providers';

const DEFAULT_REFRESH_INTERVAL_MS = 60_000;
const MIN_REFRESH_INTERVAL_MS = 1_000;

/**
 * Resolves `SECRETS_PROVIDER` (string from env) into a known kind,
 * returning a flag indicating whether the input was recognised. Caller
 * decides whether to log a warning on an unknown value.
 */
function parseProviderKind(
  raw: string | undefined,
): { kind: SecretProviderKind; known: boolean } {
  if (!raw || raw === 'env') return { kind: 'env', known: true };
  if (raw === 'doppler') return { kind: 'doppler', known: true };
  if (raw === 'vault') return { kind: 'vault', known: true };
  return { kind: 'env', known: false };
}

function parseOptions(
  onParseError?: (message: string) => void,
): SecretProviderOptions {
  const opts: SecretProviderOptions = {};

  const rawConfig = process.env.SECRETS_PROVIDER_CONFIG;
  if (rawConfig) {
    try {
      Object.assign(opts, JSON.parse(rawConfig));
    } catch (err) {
      // Surface the error to boot logs (caller-supplied callback) so
      // a typo'd `SECRETS_PROVIDER_CONFIG` is visible at startup
      // rather than silently dropping the user's intent.
      const message = err instanceof Error ? err.message : String(err);
      onParseError?.(`SECRETS_PROVIDER_CONFIG is not valid JSON: ${message}`);
    }
  }

  // Environment variables override the JSON blob so simple deployments
  // do not need a structured `SECRETS_PROVIDER_CONFIG`.
  if (process.env.DOPPLER_TOKEN) {
    opts.doppler = {
      ...(opts.doppler ?? {}),
      token: process.env.DOPPLER_TOKEN,
      ...(process.env.DOPPLER_PROJECT && {
        project: process.env.DOPPLER_PROJECT,
      }),
      ...(process.env.DOPPLER_CONFIG && {
        config: process.env.DOPPLER_CONFIG,
      }),
    };
  }

  if (process.env.VAULT_ADDR && process.env.VAULT_TOKEN) {
    opts.vault = {
      ...(opts.vault ?? {}),
      address: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
      ...(process.env.VAULT_MOUNT && { mount: process.env.VAULT_MOUNT }),
      ...(process.env.VAULT_PATH && { path: process.env.VAULT_PATH }),
    };
  }

  return opts;
}

@Injectable()
export class SecretsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecretsService.name);
  private provider: SecretProvider = new EnvSecretProvider();
  private cache: Record<string, string> = {};
  private refreshTimer: NodeJS.Timeout | null = null;
  private booting = true;

  async onModuleInit(): Promise<void> {
    const { kind, known } = parseProviderKind(process.env.SECRETS_PROVIDER);
    if (!known) {
      this.logger.warn(
        `SECRETS_PROVIDER='${process.env.SECRETS_PROVIDER}' is not recognised. Supported values: env, doppler, vault. Falling back to 'env'.`,
      );
    }
    const opts = parseOptions((message) => this.logger.warn(message));

    try {
      this.provider = buildSecretProvider(kind, opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Falling back to env provider — failed to construct '${kind}' provider: ${message}`,
      );
      this.provider = new EnvSecretProvider();
    }

    await this.sync();

    // Polling is intentionally disabled in two cases:
    //   1. `refreshIntervalMs: 0`  — explicit disable (tests, one-shot CLIs)
    //   2. `kind === 'env'`        — process.env has no live source to poll
    // Otherwise clamp to a safe floor so a typo'd `10` (ms) does not
    // become a busy loop.
    if (
      opts.refreshIntervalMs !== 0 &&
      this.provider.kind !== 'env'
    ) {
      const interval = Math.max(
        MIN_REFRESH_INTERVAL_MS,
        opts.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS,
      );
      this.refreshTimer = setInterval(() => {
        void this.sync();
      }, interval);
      // Don't keep the process alive solely for the secret refresh.
      this.refreshTimer.unref?.();
    }

    if (this.booting) {
      this.booting = false;
    }
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** Returns the secret value, falling back to `process.env[key]`. */
  get(key: string): string | undefined {
    return this.cache[key] ?? process.env[key];
  }

  /** Returns `true` if the key was sourced from the configured provider. */
  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.cache, key);
  }

  /** Diagnostic accessor — the active provider kind. */
  get providerKind(): SecretProviderKind {
    return this.provider.kind;
  }

  /**
   * Force a refresh. Public for tests; production code should rely on
   * the polling interval.
   */
  async refresh(): Promise<void> {
    await this.sync();
  }

  private async sync(): Promise<void> {
    try {
      const next = await this.provider.fetch();
      this.cache = next;
      if (this.booting === false) {
        this.logger.debug(
          `Synced ${Object.keys(next).length} secrets from '${this.provider.kind}'`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Secret sync failed against '${this.provider.kind}', keeping previous cache: ${message}`,
      );
    }
  }
}

@Global()
@Module({
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
