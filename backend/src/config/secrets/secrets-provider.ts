/**
 * Vendor-neutral secrets provider abstract class.
 *
 * All concrete providers (env, Doppler, Vault, AWS Secrets Manager) must
 * extend this class so that NestJS can use it as a DI token.
 *
 * Example:
 * ```typescript
 * @Injectable()
 * export class MyProvider extends SecretsProvider {
 *   async get(key: string): Promise<string | undefined> { ... }
 *   async getOrThrow(key: string): Promise<string> { ... }
 *   async getMany(keys: string[]): Promise<Record<string, string | undefined>> { ... }
 * }
 * ```
 */
export abstract class SecretsProvider {
  /**
   * Retrieve a single secret by key.
   * Returns `undefined` if the key does not exist.
   */
  abstract get(key: string): Promise<string | undefined>;

  /**
   * Retrieve a single secret by key, throwing if missing.
   */
  abstract getOrThrow(key: string): Promise<string>;

  /**
   * Retrieve multiple secrets at once.
   * Implementations should batch the request when the backend supports it
   * (Doppler, Vault) and fall back to sequential gets otherwise.
   */
  abstract getMany(keys: string[]): Promise<Record<string, string | undefined>>;
}
