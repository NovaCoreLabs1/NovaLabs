/**
 * Vendor-neutral secret reference layer.
 *
 * Three providers are implemented:
 *   - `EnvSecretProvider`     — reads from `process.env` (default, zero-config)
 *   - `DopplerSecretProvider` — fetches from Doppler REST API
 *   - `VaultSecretProvider`   — fetches from HashiCorp Vault KV v2
 *
 * A single `SecretsService` is registered globally and polls the
 * configured provider on an interval so a rotation does not require a
 * redeploy. When `SECRETS_PROVIDER` is unset (or set to `env`) the
 * service is effectively a typed wrapper over `process.env`, so the
 * default path is backward-compatible with every existing
 * `process.env.X` / `ConfigService.get('X')` lookup.
 */
export type SecretProviderKind = 'env' | 'doppler' | 'vault';

/**
 * Contract every secret provider must satisfy. Providers must fail
 * gracefully so a transient outage does not crash boot — `fetch()` may
 * throw and the caller will fall back to the previous cache (and,
 * finally, `process.env`).
 */
export interface SecretProvider {
  /** Lower-case identifier used in logs, e.g. `vault`, `doppler`. */
  readonly kind: SecretProviderKind;

  /**
   * Fetch the full secret map available from this provider. Must NOT
   * return `undefined` — an empty object is fine. Callers treat the
   * returned map as the source of truth for this sync cycle.
   */
  fetch(): Promise<Record<string, string>>;
}

/**
 * Validated shape of `SECRETS_PROVIDER_CONFIG` (JSON-encoded). Each
 * provider exposes a small, sharply-typed config block so misconfig is
 * caught at boot rather than on the first fetch.
 */
export interface SecretProviderOptions {
  /** Refresh interval (ms). Defaults to 60s. Set to 0 to disable polling. */
  refreshIntervalMs?: number;

  /** Doppler-specific. */
  doppler?: {
    token: string;
    /** Doppler project (defaults to 'backend'). */
    project?: string;
    /** Doppler config (defaults to the token's default config). */
    config?: string;
  };

  /** HashiCorp Vault KV v2 specific. */
  vault?: {
    address: string;
    token: string;
    /** Mount point, defaults to `secret`. */
    mount?: string;
    /** Secret path under the mount, defaults to `novalabs`. */
    path?: string;
    /** Static request timeout (ms), defaults to 5_000. */
    timeoutMs?: number;
  };
}
