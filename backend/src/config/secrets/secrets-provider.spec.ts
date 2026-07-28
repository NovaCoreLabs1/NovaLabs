/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { EnvSecretsProvider } from './env-secrets.provider';
import { DopplerSecretsProvider } from './doppler-secrets.provider';
import { VaultSecretsProvider } from './vault-secrets.provider';
import { AwsSecretsProvider } from './aws-secrets.provider';
import { SecretsModule, SECRETS_PROVIDER } from './secrets.module';
import { SecretsProvider } from './secrets-provider.interface';
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
// EnvSecretsProvider
// ---------------------------------------------------------------------------

describe('EnvSecretsProvider', () => {
  let provider: EnvSecretsProvider;

  beforeEach(() => {
    provider = new EnvSecretsProvider();
  });

  describe('getSecret', () => {
    it('returns the value when the key exists in process.env', async () => {
      process.env.TEST_KEY = 'hello';
      await expect(provider.getSecret('TEST_KEY')).resolves.toBe('hello');
      delete process.env.TEST_KEY;
    });

    it('throws NotFoundException when the key does not exist', async () => {
      await expect(provider.getSecret('NONEXISTENT')).rejects.toThrow(
        /Secret "NONEXISTENT" is not defined/,
      );
    });

    it('throws NotFoundException when the key is an empty string', async () => {
      process.env.EMPTY_KEY = '';
      await expect(provider.getSecret('EMPTY_KEY')).rejects.toThrow(
        /Secret "EMPTY_KEY" is not defined/,
      );
      delete process.env.EMPTY_KEY;
    });
  });
});

// ---------------------------------------------------------------------------
// DopplerSecretsProvider
// ---------------------------------------------------------------------------

describe('DopplerSecretsProvider', () => {
  let provider: DopplerSecretsProvider;

  beforeEach(() => {
    process.env.DOPPLER_TOKEN = 'dp.pt.mock-token';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.DOPPLER_TOKEN;
  });

  describe('getSecret', () => {
    it('returns the secret when Doppler API responds', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { API_KEY: 'sk-abc123' },
      });
      provider = new DopplerSecretsProvider();
      await expect(provider.getSecret('API_KEY')).resolves.toBe('sk-abc123');
    });

    it('throws NotFoundException when the key is not in Doppler response', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { OTHER_KEY: 'val' },
      });
      provider = new DopplerSecretsProvider();
      await expect(provider.getSecret('MISSING_KEY')).rejects.toThrow(
        /Secret "MISSING_KEY" not found in Doppler/,
      );
    });

    it('caches secrets and avoids repeated API calls', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { CACHED: 'cached-val' },
      });
      provider = new DopplerSecretsProvider();
      await provider.getSecret('CACHED');
      await provider.getSecret('CACHED');
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('without token', () => {
    it('throws when DOPPLER_TOKEN is not set', async () => {
      delete process.env.DOPPLER_TOKEN;
      provider = new DopplerSecretsProvider();
      await expect(provider.getSecret('ANY')).rejects.toThrow(
        'DOPPLER_TOKEN environment variable is not set',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// VaultSecretsProvider
// ---------------------------------------------------------------------------

describe('VaultSecretsProvider', () => {
  let provider: VaultSecretsProvider;

  beforeEach(() => {
    process.env.VAULT_TOKEN = 'hvs.mock-token';
    process.env.VAULT_ADDR = 'https://vault.example.com:8200';
    process.env.VAULT_MOUNT = 'secret';
    process.env.VAULT_SECRET_PATH = 'novalabs';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.VAULT_TOKEN;
    delete process.env.VAULT_ADDR;
    delete process.env.VAULT_MOUNT;
    delete process.env.VAULT_SECRET_PATH;
  });

  describe('getSecret', () => {
    it('returns the secret when Vault responds', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { data: { STRIPE_KEY: 'sk_test_xyz' } } },
      });
      provider = new VaultSecretsProvider();
      await expect(provider.getSecret('STRIPE_KEY')).resolves.toBe('sk_test_xyz');
    });

    it('throws NotFoundException when the key is not in Vault response', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { data: { OTHER: 'val' } } },
      });
      provider = new VaultSecretsProvider();
      await expect(provider.getSecret('MISSING')).rejects.toThrow(
        /Secret "MISSING" not found in Vault/,
      );
    });

    it('caches secrets to avoid repeated Vault API calls', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { data: { KEY: 'val' } } },
      });
      provider = new VaultSecretsProvider();
      await provider.getSecret('KEY');
      await provider.getSecret('KEY');
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('uses defaults when optional env vars are unset', async () => {
      delete process.env.VAULT_ADDR;
      delete process.env.VAULT_MOUNT;
      delete process.env.VAULT_SECRET_PATH;
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { data: { X: 'y' } } },
      });
      provider = new VaultSecretsProvider();
      await expect(provider.getSecret('X')).resolves.toBe('y');
    });
  });

  describe('without token', () => {
    it('throws when VAULT_TOKEN is not set', async () => {
      delete process.env.VAULT_TOKEN;
      provider = new VaultSecretsProvider();
      await expect(provider.getSecret('ANY')).rejects.toThrow(
        'VAULT_TOKEN environment variable is not set',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// AwsSecretsProvider
// ---------------------------------------------------------------------------

describe('AwsSecretsProvider', () => {
  let provider: AwsSecretsProvider;

  beforeEach(() => {
    process.env.AWS_SECRETS_NAME = 'my-secret';
    process.env.AWS_REGION = 'us-east-1';
    awsMock.send.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.AWS_SECRETS_NAME;
    delete process.env.AWS_REGION;
  });

  describe('getSecret', () => {
    it('returns a key from the parsed JSON secret', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ DB_URL: 'postgres://...' }),
      });
      provider = new AwsSecretsProvider();
      await expect(provider.getSecret('DB_URL')).resolves.toBe('postgres://...');
    });

    it('throws NotFoundException when the key is not in the AWS secret', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ OTHER: 'val' }),
      });
      provider = new AwsSecretsProvider();
      await expect(provider.getSecret('MISSING')).rejects.toThrow(
        /Secret "MISSING" not found in AWS Secrets Manager/,
      );
    });

    it('caches secrets to avoid repeated AWS API calls', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: JSON.stringify({ CACHED_AWS: 'cached' }),
      });
      provider = new AwsSecretsProvider();
      await provider.getSecret('CACHED_AWS');
      await provider.getSecret('CACHED_AWS');
      expect(awsMock.send).toHaveBeenCalledTimes(1);
    });

    it('throws when SecretString is not valid JSON', async () => {
      awsMock.send.mockResolvedValueOnce({
        SecretString: 'not-json',
      });
      provider = new AwsSecretsProvider();
      await expect(provider.getSecret('ANY')).rejects.toThrow(
        /not valid JSON/,
      );
    });
  });

  describe('without secret name', () => {
    it('throws when AWS_SECRETS_NAME is not set', async () => {
      delete process.env.AWS_SECRETS_NAME;
      provider = new AwsSecretsProvider();
      await expect(provider.getSecret('ANY')).rejects.toThrow(
        'AWS_SECRETS_NAME environment variable is not set',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// SecretsModule — DI integration
// ---------------------------------------------------------------------------

describe('SecretsModule', () => {
  it('resolves EnvSecretsProvider by default (env provider)', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SecretsModule],
    }).compile();

    const resolved = moduleRef.get<SecretsProvider>(SECRETS_PROVIDER);
    expect(resolved).toBeInstanceOf(EnvSecretsProvider);
  });

  it('resolves DopplerSecretsProvider when SECRETS_PROVIDER=doppler', async () => {
    process.env.DOPPLER_TOKEN = 'dp.pt.mock';
    process.env.SECRETS_PROVIDER = 'doppler';
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SecretsModule],
    }).compile();

    const resolved = moduleRef.get<SecretsProvider>(SECRETS_PROVIDER);
    expect(resolved).toBeInstanceOf(DopplerSecretsProvider);
    delete process.env.SECRETS_PROVIDER;
    delete process.env.DOPPLER_TOKEN;
  });

  it('resolves VaultSecretsProvider when SECRETS_PROVIDER=vault', async () => {
    process.env.VAULT_TOKEN = 'hvs.tok';
    process.env.SECRETS_PROVIDER = 'vault';
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SecretsModule],
    }).compile();

    const resolved = moduleRef.get<SecretsProvider>(SECRETS_PROVIDER);
    expect(resolved).toBeInstanceOf(VaultSecretsProvider);
    delete process.env.SECRETS_PROVIDER;
    delete process.env.VAULT_TOKEN;
  });

  it('resolves AwsSecretsProvider when SECRETS_PROVIDER=aws', async () => {
    process.env.AWS_SECRETS_NAME = 'test';
    process.env.SECRETS_PROVIDER = 'aws';
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SecretsModule],
    }).compile();

    const resolved = moduleRef.get<SecretsProvider>(SECRETS_PROVIDER);
    expect(resolved).toBeInstanceOf(AwsSecretsProvider);
    delete process.env.SECRETS_PROVIDER;
    delete process.env.AWS_SECRETS_NAME;
  });

  it('falls back to env for unknown SECRETS_PROVIDER values', async () => {
    process.env.SECRETS_PROVIDER = 'unknown-vendor';
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SecretsModule],
    }).compile();

    const resolved = moduleRef.get<SecretsProvider>(SECRETS_PROVIDER);
    expect(resolved).toBeInstanceOf(EnvSecretsProvider);
    delete process.env.SECRETS_PROVIDER;
  });
});
