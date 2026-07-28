# Secrets Provider

A vendor-neutral secrets abstraction for the NovaLabs backend. Supports multiple backends through a common `SecretsProvider` interface.

## Usage

### 1. Register the module

In your `AppModule`, import `SecretsModule.forRoot()`:

```typescript
import { SecretsModule } from './config/secrets';

@Module({
  imports: [
    SecretsModule.forRoot(),
    // ... other modules
  ],
})
export class AppModule {}
```

### 2. Inject the provider

```typescript
import { SecretsProvider } from '../config/secrets';

@Injectable()
export class SomeService {
  constructor(private readonly secrets: SecretsProvider) {}

  async doSomething() {
    const apiKey = await this.secrets.getOrThrow('API_KEY');
    const dbPassword = await this.secrets.get('DB_PASSWORD');
  }
}
```

## Configuration

Set the `SECRETS_PROVIDER` environment variable to choose the backend:

| Value      | Provider               | Required Environment Variables        |
|------------|------------------------|---------------------------------------|
| `env`      | EnvSecretsProvider     | (none — uses process.env/ConfigService) |
| `doppler`  | DopplerSecretsProvider | `DOPPLER_TOKEN`                       |
| `vault`    | VaultSecretsProvider   | `VAULT_ADDR`, `VAULT_TOKEN`, `VAULT_KV_PATH` |
| `aws`      | AwsSecretsProvider     | `AWS_REGION`, `AWS_SECRETS_MANAGER_ARN` |

> **Default:** `env` (reads from environment variables).

## Providers

### EnvSecretsProvider (default)

Wraps NestJS `ConfigService`. Requires no additional infrastructure.

### DopplerSecretsProvider

Fetches all secrets from the [Doppler API v3](https://docs.doppler.com/reference/api) on first access. Secrets are cached in-memory for 5 minutes by default (configurable via `DOPPLER_CACHE_TTL_MS`).

### VaultSecretsProvider

Fetches all secrets from [HashiCorp Vault KV v2 engine](https://developer.hashicorp.com/vault/docs/secrets/kv/kv-v2) on first access. Secrets are cached in-memory for 5 minutes by default (configurable via `VAULT_CACHE_TTL_MS`).

Supports Vault Enterprise namespaces via the `VAULT_NAMESPACE` environment variable.

### AwsSecretsProvider

Fetches the secret from [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) and parses the JSON. Expects the secret value to be a JSON object of key-value pairs. Secrets are cached in-memory for 5 minutes by default (configurable via `AWS_SECRETS_CACHE_TTL_MS`).

> **Note:** Requires `@aws-sdk/client-secrets-manager` to be installed:
> ```bash
> npm install @aws-sdk/client-secrets-manager
> ```

## Fallback

All remote providers (Doppler, Vault, AWS) fall back to environment variables in `getOrThrow()` before throwing, enabling hybrid setups where some secrets are local and some are remote.
