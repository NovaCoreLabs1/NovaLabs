/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SecretsProvider } from './secrets-provider';
import { EnvSecretsProvider } from './env-secrets.provider';
import { DopplerSecretsProvider } from './doppler-secrets.provider';
import { VaultSecretsProvider } from './vault-secrets.provider';
import { AwsSecretsProvider } from './aws-secrets.provider';
import { SecretsModule } from './secrets.module';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Shared mutable reference so tests can configure aws-sdk mocks.
const awsMock = { send: jest.fn() };
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({
    send: awsMock.send,
  })),
  GetSecretValueCommand: jest.fn((args: unknown) => args),
}));

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function mockConfigService(
  overrides: Record<string, unknown> = {},
): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        EXISTING_KEY: 'hello',
        EXISTING_NUM: '42',
        DOPPLER_TOKEN: 'dp.pt.mock-token',
        DOPPLER_SERVICE_TOKEN: '',
        DOPPLER_API_BASE: 'https://api.doppler.com/v3',
        DOPPLER_CACHE_TTL_MS: 300_000,
        VAULT_ADDR: 'https://vault.example.com:8200',
        VAULT_ADDRESS: '',
        VAULT_TOKEN: 'hvs.mock-token',
        VAULT_KV_PATH: 'secret/data/nova-labs',
        VAULT_SECRET_PATH: '',
        VAULT_NAMESPACE: '',
        VAULT_CACHE_TTL_MS: 300_000,
        AWS_REGION: 'us-east-1',
        AWS_DEFAULT_REGION: '',
        AWS_SECRETS_MANAGER_ARN:
          'arn:aws:secretsmanager:us-east-1:123:secret:my-secret',
        AWS_SECRETS_MANAGER_SECRET_ID: '',
        AWS_SECRETS_CACHE_TTL_MS: 300_000,
        ...overrides,
      };
      return (config as Record<string, unknown>)[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;
}

// ---------------------------------------------------------------------------
// EnvSecretsProvider
// ---------------------------------------------------------------------------

describe('EnvSecretsProvider', () => {
  let provider: EnvSecretsProvider;
  let configService: ConfigService;

  beforeEach(() => {
    configService = mockConfigService();
    provider = new EnvSecretsProvider(configService);
  });

  describe('get', () => {
    it('returns the value when the key exists', async () => {
      await expect(provider.get('EXISTING_KEY')).resolves.toBe('hello');
    });

    it('returns undefined when the key does not exist', async () => {
      await expect(provider.get('NONEXISTENT')).resolves.toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    it('returns the value when the key exists', async () => {
      await expect(provider.getOrThrow('EXISTING_KEY')).resolves.toBe('hello');
    });

    it('throws when the key does not exist', async () => {
      await expect(provider.getOrThrow('MISSING')).rejects.toThrow(
        /Missing required secret: "MISSING"/,
      );
    });
  });

  describe('getMany', () => {
    it('returns a map of key -> value for existing keys', async () => {
      const result = await provider.getMany(['EXISTING_KEY', 'EXISTING_NUM']);
      expect(result).toEqual({ EXISTING_KEY: 'hello', EXISTING_NUM: '42' });
    });

    it('returns undefined for missing keys', async () => {
      const result = await provider.getMany(['EXISTING_KEY', 'GHOST']);
      expect(result).toEqual({ EXISTING_KEY: 'hello', GHOST: undefined });
    });

    it('returns an empty object for an empty key list', async () => {
      await expect(provider.getMany([])).resolves.toEqual({});
    });
  });
});

// ---------------------------------------------------------------------------
// DopplerSecretsProvider
// ---------------------------------------------------------------------------

describe('DopplerSecretsProvider', () => {
  let provider: DopplerSecretsProvider;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('reads DOPPLER_TOKEN from config', () => {
      const cfg = mockConfigService({ DOPPLER_TOKEN: 'dp.pt.main' });
      provider = new DopplerSecretsProvider(cfg);
      expect(provider).toBeDefined();
    });

    it('falls back to DOPPLER_SERVICE_TOKEN when DOPPLER_TOKEN is absent', () => {
      const cfg = mockConfigService({
        DOPPLER_TOKEN: '',
        DOPPLER_SERVICE_TOKEN: 'dp.st.fallback',
      });
      provider = new DopplerSecretsProvider(cfg);
      expect(provider).toBeDefined();
    });
  });

  describe('get', () => {
    it('returns the secret when Doppler API responds', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { secrets: { API_KEY: { raw: 'sk-abc123' } } },
      });
      provider = new DopplerSecretsProvider(mockConfigService());
      await expect(provider.get('API_KEY')).resolves.toBe('sk-abc123');
    });

    it('falls back to process.env when the Doppler API call fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      const originalEnv = process.env.FALLBACK_KEY;
      process.env.FALLBACK_KEY = 'fallback-val';
      provider = new DopplerSecretsProvider(mockConfigService());
      await expect(provider.get('FALLBACK_KEY')).resolves.toBe('fallback-val');
      process.env.FALLBACK_KEY = originalEnv;
    });

    it('returns undefined when both Doppler and process.env are missing', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      provider = new DopplerSecretsProvider(mockConfigService());
      await expect(provider.get('NOT_ANYWHERE')).resolves.toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    it('returns the value from Doppler', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { secrets: { DB_PASS: { raw: 's3cret' } } },
      });
      provider = new DopplerSecretsProvider(mockConfigService());
      await expect(provider.getOrThrow('DB_PASS')).resolves.toBe('s3cret');
    });

    it('throws when the key is nowhere to be found', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));
      provider = new DopplerSecretsProvider(mockConfigService());
      await expect(provider.getOrThrow('NOWHERE')).rejects.toThrow(
        /Missing required secret: "NOWHERE"/,
      );
    });
  });

  describe('getMany', () => {
    it('returns a batch of secrets from Doppler', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          secrets: {
            KEY_A: { raw: 'val-a' },
            KEY_B: { raw: 'val-b' },
          },
        },
      });
      provider = new DopplerSecretsProvider(mockConfigService());
      await expect(provider.getMany(['KEY_A', 'KEY_B'])).resolves.toEqual({
        KEY_A: 'val-a',
        KEY_B: 'val-b',
      });
    });
  });

  describe('caching', () => {
    it('caches secrets and avoids repeated API calls within TTL', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { secrets: { CACHED: { raw: 'cached-val' } } },
      });
      provider = new DopplerSecretsProvider(mockConfigService());
      await provider.get('CACHED');
      await provider.get('CACHED');
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after cache expiry', async () => {
      const startTime = Date.now();
      jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(startTime) // first fetch: set cacheExpiresAt
        .mockReturnValueOnce(startTime + 500_000); // second fetch: past TTL

      provider = new DopplerSecretsProvider(
        mockConfigService({ DOPPLER_CACHE_TTL_MS: 300_000 }),
      );
      mockedAxios.get.mockResolvedValue({
        data: { secrets: { KEY: { raw: 'value' } } },
      });
      await provider.get('KEY');
      await provider.get('KEY');
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      jest.restoreAllMocks();
    });
  });

  describe('without token', () => {
    it('falls back to env on get when no token is configured', async () => {
      const cfg = mockConfigService({
        DOPPLER_TOKEN: '',
        DOPPLER_SERVICE_TOKEN: '',
      });
      provider = new DopplerSecretsProvider(cfg);
      // fetchSecrets throws, get() catches and falls back to process.env
      await expect(provider.get('ANY')).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// VaultSecretsProvider
// ---------------------------------------------------------------------------

describe('VaultSecretsProvider', () => {
  let provider: VaultSecretsProvider;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('reads VAULT_ADDR and falls back to VAULT_ADDRESS', () => {
      const cfg = mockConfigService({
        VAULT_ADDR: '',
        VAULT_ADDRESS: 'https://vault-alt.example.com',
        VAULT_TOKEN: 'hvs.tok',
        VAULT_KV_PATH: 'secret/data/app',
      });
      provider = new VaultSecretsProvider(cfg);
      expect(provider).toBeDefined();
    });
  });

  describe('get', () => {
    it('returns the secret when Vault responds', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { data: { STRIPE_KEY: 'sk_test_xyz' } } },
      });
      provider = new VaultSecretsProvider(mockConfigService());
      await expect(provider.get('STRIPE_KEY')).resolves.toBe('sk_test_xyz');
    });

    it('falls back to process.env when Vault API fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Vault unavailable'));
      const originalEnv = process.env.FALLBACK_VAULT;
      process.env.FALLBACK_VAULT = 'vault-fallback';
      provider = new VaultSecretsProvider(mockConfigService());
      await expect(provider.get('FALLBACK_VAULT')).resolves.toBe(
        'vault-fallback',
      );
      process.env.FALLBACK_VAULT = originalEnv;
    });

    it('returns undefined when both Vault and process.env are missing', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Vault down'));
      provider = new VaultSecretsProvider(mockConfigService());
      await expect(provider.get('NOWHERE_VAULT')).resolves.toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    it('returns the value from Vault', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { data: { JWT_SECRET: 'jwt-val' } } },
      });
      provider = new VaultSecretsProvider(mockConfigService());
      await expect(provider.getOrThrow('JWT_SECRET')).resolves.toBe('jwt-val');
    });
  });

  describe('getMany', () => {
    it('returns a batch from Vault', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { data: { A: 'a', B: 'b' } } },
      });
      provider = new VaultSecretsProvider(mockConfigService());
      await expect(provider.getMany(['A', 'B'])).resolves.toEqual({
        A: 'a',
        B: 'b',
      });
    });
  });

  describe('missing config', () => {
    it('falls back to env on get when VAULT_ADDR is missing', async () => {
      provider = new VaultSecretsProvider(
        mockConfigService({ VAULT_ADDR: '', VAULT_ADDRESS: '' }),
      );
      await expect(provider.get('X')).resolves.toBeUndefined();
    });
  });

  describe('caching', () => {
    it('caches secrets to avoid repeated Vault API calls', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { data: { KEY: 'val' } } },
      });
      provider = new VaultSecretsProvider(mockConfigService());
      await provider.get('KEY');
      await provider.get('KEY');
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// AwsSecretsProvider
// ---------------------------------------------------------------------------

describe('AwsSecretsProvider', () => {
  let provider: AwsSecretsProvider;

  beforeEach(() => {
    awsMock.send.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('returns a key from the parsed JSON secret', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ DB_URL: 'postgres://...' }),
      });
      provider = new AwsSecretsProvider(mockConfigService());
      await expect(provider.get('DB_URL')).resolves.toBe('postgres://...');
    });

    it('handles plain-text (non-JSON) secrets by wrapping under the last path segment', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: 'plain-api-key',
      });
      // ARN with a /path to test .split('/').pop() behavior
      provider = new AwsSecretsProvider(
        mockConfigService({
          AWS_SECRETS_MANAGER_ARN:
            'arn:aws:secretsmanager:us-east-1:123:secret:/prod/api-key',
        }),
      );
      // The last path segment of the ARN is 'api-key'
      await expect(provider.get('api-key')).resolves.toBe('plain-api-key');
    });

    it('falls back to process.env when AWS call fails', async () => {
      awsMock.send.mockRejectedValueOnce(new Error('AWS error'));
      const originalEnv = process.env.AWS_FALLBACK_KEY;
      process.env.AWS_FALLBACK_KEY = 'aws-fallback';
      provider = new AwsSecretsProvider(mockConfigService());
      await expect(provider.get('AWS_FALLBACK_KEY')).resolves.toBe(
        'aws-fallback',
      );
      process.env.AWS_FALLBACK_KEY = originalEnv;
    });

    it('returns undefined when both AWS and process.env are missing', async () => {
      awsMock.send.mockRejectedValueOnce(new Error('AWS error'));
      provider = new AwsSecretsProvider(mockConfigService());
      await expect(provider.get('NOWHERE_AWS')).resolves.toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    it('returns the value from AWS', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ API_KEY: 'ak-123' }),
      });
      provider = new AwsSecretsProvider(mockConfigService());
      await expect(provider.getOrThrow('API_KEY')).resolves.toBe('ak-123');
    });
  });

  describe('getMany', () => {
    it('returns a batch from AWS', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ KEY1: 'v1', KEY2: 'v2' }),
      });
      provider = new AwsSecretsProvider(mockConfigService());
      await expect(provider.getMany(['KEY1', 'KEY2'])).resolves.toEqual({
        KEY1: 'v1',
        KEY2: 'v2',
      });
    });
  });

  describe('BinarySecret', () => {
    it('decodes binary secrets when SecretString is absent', async () => {
      const secretValue = JSON.stringify({ BIN_KEY: 'bin-val' });
      // AWS SDK returns SecretBinary as a Uint8Array. Buffer.from(Uint8Array).toString()
      // yields the decoded UTF-8 string.
      awsMock.send.mockResolvedValueOnce({
        SecretString: undefined,
        SecretBinary: Buffer.from(secretValue, 'utf-8'),
      });
      provider = new AwsSecretsProvider(mockConfigService());
      await expect(provider.get('BIN_KEY')).resolves.toBe('bin-val');
    });
  });

  describe('caching', () => {
    it('caches secrets to avoid repeated AWS API calls', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ CACHED_AWS: 'cached' }),
      });
      provider = new AwsSecretsProvider(mockConfigService());
      await provider.get('CACHED_AWS');
      await provider.get('CACHED_AWS');
      expect(awsMock.send).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// SecretsModule
// ---------------------------------------------------------------------------

describe('SecretsModule', () => {
  describe('forRoot', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('uses EnvSecretsProvider by default', () => {
      delete process.env.SECRETS_PROVIDER;
      const mod = SecretsModule.forRoot();
      const provider = (mod.providers ?? []).find(
        (p: any) => p.provide === SecretsProvider,
      )!;
      expect((provider as any).useClass).toBe(EnvSecretsProvider);
    });

    it('uses DopplerSecretsProvider when SECRETS_PROVIDER=doppler', () => {
      process.env.SECRETS_PROVIDER = 'doppler';
      const mod = SecretsModule.forRoot();
      const provider = (mod.providers ?? []).find(
        (p: any) => p.provide === SecretsProvider,
      )!;
      expect((provider as any).useClass).toBe(DopplerSecretsProvider);
    });

    it('uses VaultSecretsProvider when SECRETS_PROVIDER=vault', () => {
      process.env.SECRETS_PROVIDER = 'vault';
      const mod = SecretsModule.forRoot();
      const provider = (mod.providers ?? []).find(
        (p: any) => p.provide === SecretsProvider,
      )!;
      expect((provider as any).useClass).toBe(VaultSecretsProvider);
    });

    it('uses AwsSecretsProvider when SECRETS_PROVIDER=aws', () => {
      process.env.SECRETS_PROVIDER = 'aws';
      const mod = SecretsModule.forRoot();
      const provider = (mod.providers ?? []).find(
        (p: any) => p.provide === SecretsProvider,
      )!;
      expect((provider as any).useClass).toBe(AwsSecretsProvider);
    });

    it('is case-insensitive for SECRETS_PROVIDER value', () => {
      process.env.SECRETS_PROVIDER = 'VAULT';
      const mod = SecretsModule.forRoot();
      const provider = (mod.providers ?? []).find(
        (p: any) => p.provide === SecretsProvider,
      )!;
      expect((provider as any).useClass).toBe(VaultSecretsProvider);
    });

    it('falls back to env for unknown SECRETS_PROVIDER values', () => {
      process.env.SECRETS_PROVIDER = 'unknown-vendor';
      const mod = SecretsModule.forRoot();
      const provider = (mod.providers ?? []).find(
        (p: any) => p.provide === SecretsProvider,
      )!;
      expect((provider as any).useClass).toBe(EnvSecretsProvider);
    });

    it('exports the SECRETS_PROVIDER_TYPE token', () => {
      process.env.SECRETS_PROVIDER = 'aws';
      const mod = SecretsModule.forRoot();
      const typeProvider = (mod.providers ?? []).find(
        (p: any) => p.provide === 'SECRETS_PROVIDER_TYPE',
      )!;
      expect((typeProvider as any).useValue).toBe('aws');
    });
  });

  describe('forTest', () => {
    it('provides the given SecretsProvider instance', async () => {
      const fakeProvider = { get: jest.fn() } as unknown as SecretsProvider;
      const mod = SecretsModule.forTest(fakeProvider);
      const provider = (mod.providers ?? []).find(
        (p: any) => p.provide === SecretsProvider,
      )!;
      expect((provider as any).useValue).toBe(fakeProvider);
    });
  });

  describe('integration with NestJS DI', () => {
    it('resolves EnvSecretsProvider from the module', async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [SecretsModule.forRoot()],
      }).compile();

      const resolved = moduleRef.get<SecretsProvider>(SecretsProvider);
      expect(resolved).toBeInstanceOf(EnvSecretsProvider);
    });

    it('resolves a forTest provider correctly', async () => {
      const stub: SecretsProvider = {
        get: jest.fn().mockResolvedValue('stub'),
        getOrThrow: jest.fn().mockResolvedValue('stub'),
        getMany: jest.fn().mockResolvedValue({}),
      };

      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [SecretsModule.forTest(stub)],
      }).compile();

      const resolved = moduleRef.get<SecretsProvider>(SecretsProvider);
      expect(await resolved.get('any')).toBe('stub');
    });
  });
});

// ---------------------------------------------------------------------------
// SecretsProvider abstract class — derived class invariants
// ---------------------------------------------------------------------------

describe('SecretsProvider (abstract class contract)', () => {
  class TestProvider extends SecretsProvider {
    async get(key: string): Promise<string | undefined> {
      return key === 'exists' ? 'found' : undefined;
    }
    async getOrThrow(key: string): Promise<string> {
      const val = await this.get(key);
      if (!val) throw new Error(`Test: missing "${key}"`);
      return val;
    }
    async getMany(keys: string[]): Promise<Record<string, string | undefined>> {
      const result: Record<string, string | undefined> = {};
      for (const k of keys) result[k] = await this.get(k);
      return result;
    }
  }

  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider();
  });

  it('get returns the value for an existing key', async () => {
    await expect(provider.get('exists')).resolves.toBe('found');
  });

  it('get returns undefined for a missing key', async () => {
    await expect(provider.get('missing')).resolves.toBeUndefined();
  });

  it('getOrThrow throws for a missing key', async () => {
    await expect(provider.getOrThrow('ghost')).rejects.toThrow(
      /missing "ghost"/,
    );
  });

  it('getMany returns mixed results', async () => {
    await expect(provider.getMany(['exists', 'ghost'])).resolves.toEqual({
      exists: 'found',
      ghost: undefined,
    });
  });
});
