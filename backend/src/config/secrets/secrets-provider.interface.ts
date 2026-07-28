/**
 * Vendor-neutral interface for loading application secrets at runtime.
 *
 * Implement this interface for each secrets backend (Env, Vault, Doppler, AWS)
 * and switch between them with the `SECRETS_PROVIDER` environment variable.
 * All providers surface the same `getSecret(key)` contract so the rest of the
 * application is decoupled from the underlying secrets store.
 */
export interface SecretsProvider {
  /**
   * Fetch the value for the given secret key.
   *
   * @param key  - The canonical secret name (e.g. `'DATABASE_PASSWORD'`).
   * @returns    The secret value as a plain string.
   * @throws     If the key is not found or the provider call fails.
   */
  getSecret(key: string): Promise<string>;
}
