/**
 * Concrete `SecretProvider` implementations: env (default),
 * Doppler, and HashiCorp Vault KV v2. Each provider is a small
 * object that exposes `kind` and `fetch()`.
 *
 * All three providers accept an optional `axios`-shaped HTTP client
 * as their second constructor argument. Production callers omit it
 * (a default `axios.create(...)` instance is built); tests pass in a
 * mock so the provider does not need a network round-trip.
 */
import axios, { AxiosInstance } from 'axios';
import {
  SecretProvider,
  SecretProviderOptions,
} from './secret-provider.interface';

/**
 * Default provider. Returns the current process environment as a
 * plain string map. Effectively a typed wrapper over `process.env`
 * so callers can code against `SecretsService.get('FOO')` and have
 * it work even when no external provider is configured.
 */
export class EnvSecretProvider implements SecretProvider {
  readonly kind = 'env' as const;

  async fetch(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  }
}

/**
 * Doppler secrets provider. Uses the Doppler REST API
 * (`GET /v3/configs/config/secrets`). Requires a service token
 * (`DOPPLER_TOKEN` / `dp.st.*` in the provider options).
 */
export class DopplerSecretProvider implements SecretProvider {
  readonly kind = 'doppler' as const;

  constructor(
    private readonly opts: NonNullable<SecretProviderOptions['doppler']>,
    http?: AxiosInstance,
  ) {
    this.http =
      http ??
      axios.create({
        baseURL: 'https://api.doppler.com',
        timeout: 5_000,
      });
  }

  private readonly http: AxiosInstance;

  async fetch(): Promise<Record<string, string>> {
    const params: Record<string, string> = {};
    if (this.opts.project) params.project = this.opts.project;
    if (this.opts.config) params.config = this.opts.config;

    const response = await this.http.get('/v3/configs/config/secrets', {
      params,
      headers: { Authorization: `Bearer ${this.opts.token}` },
    });

    // Doppler returns `{ secrets: { NAME: { raw: 'value' }, ... } }`.
    const secrets = (response.data?.secrets ?? {}) as Record<
      string,
      { raw?: string }
    >;
    const out: Record<string, string> = {};
    for (const [name, value] of Object.entries(secrets)) {
      if (typeof value?.raw === 'string') out[name] = value.raw;
    }
    return out;
  }
}

/**
 * HashiCorp Vault KV v2 provider. Reads
 * `GET {address}/v1/{mount}/data/{path}` and flattens the
 * `data.data` object into a flat key/value map. Requires
 * `VAULT_ADDR` and `VAULT_TOKEN`.
 */
export class VaultSecretProvider implements SecretProvider {
  readonly kind = 'vault' as const;

  private readonly mount: string;
  private readonly path: string;

  constructor(
    private readonly opts: NonNullable<SecretProviderOptions['vault']>,
    http?: AxiosInstance,
  ) {
    this.mount = opts.mount ?? 'secret';
    this.path = opts.path ?? 'novalabs';
    this.http =
      http ??
      axios.create({
        baseURL: opts.address.replace(/\/+$/, ''),
        timeout: opts.timeoutMs ?? 5_000,
      });
  }

  private readonly http: AxiosInstance;

  async fetch(): Promise<Record<string, string>> {
    const response = await this.http.get(
      `/v1/${this.mount}/data/${this.path}`,
      {
        headers: { 'X-Vault-Token': this.opts.token },
      },
    );

    const inner = (response.data?.data?.data ?? {}) as Record<
      string,
      unknown
    >;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(inner)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  }
}

/**
 * Factory: pick the right provider based on the validated options
 * block. Throws when the requested provider is missing required
 * credentials — the caller is expected to have validated first.
 */
export function buildSecretProvider(
  kind: 'env' | 'doppler' | 'vault',
  opts: SecretProviderOptions,
): SecretProvider {
  switch (kind) {
    case 'env':
      return new EnvSecretProvider();
    case 'doppler': {
      if (!opts.doppler?.token) {
        throw new Error(
          'SECRETS_PROVIDER=doppler requires DOPPLER_TOKEN (or doppler.token in options)',
        );
      }
      return new DopplerSecretProvider(opts.doppler);
    }
    case 'vault': {
      if (!opts.vault?.address || !opts.vault?.token) {
        throw new Error(
          'SECRETS_PROVIDER=vault requires VAULT_ADDR + VAULT_TOKEN',
        );
      }
      return new VaultSecretProvider(opts.vault);
    }
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = kind;
      throw new Error(`Unknown secret provider: ${String(_exhaustive)}`);
    }
  }
}
