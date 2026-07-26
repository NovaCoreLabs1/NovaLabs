import axios, { AxiosInstance } from 'axios';
import { SecretsService } from './secrets.module';
import {
  buildSecretProvider,
  EnvSecretProvider,
  DopplerSecretProvider,
  VaultSecretProvider,
} from './secret-providers';
import {
  SecretProvider,
  SecretProviderOptions,
} from './secret-provider.interface';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const SECRET_KEYS_TO_CLEAN = [
  'PAYSTACK_SECRET_KEY',
  'OTHER_KEY',
  'NOFOO_TEST_SECRET',
];

/**
 * Build a minimal AxiosInstance-shaped mock that resolves `.get(url)` with
 * the supplied payload. Injected into providers via their constructor so
 * tests bypass `axios.create` and don't require a network round-trip.
 */
function fakeHttp(payload: unknown): jest.Mocked<AxiosInstance> {
  const get = jest.fn().mockResolvedValue({ data: payload });
  return { get } as unknown as jest.Mocked<AxiosInstance>;
}

describe('Secret providers (issue #121)', () => {
  describe('EnvSecretProvider', () => {
    it('returns the current process environment as a flat string map', async () => {
      process.env.NOFOO_TEST_SECRET = 'hello';
      try {
        const provider = new EnvSecretProvider();
        const out = await provider.fetch();
        expect(out.NOFOO_TEST_SECRET).toBe('hello');
      } finally {
        delete process.env.NOFOO_TEST_SECRET;
      }
    });
  });

  describe('DopplerSecretProvider', () => {
    it('flattens secrets.raw into a flat map', async () => {
      const http = fakeHttp({
        secrets: { DB_PASSWORD: { raw: 'p' }, JWT_SECRET: { raw: 's' } },
      });
      const provider = new DopplerSecretProvider({ token: 'dp.st.X' }, http);
      const out = await provider.fetch();
      expect(http.get).toHaveBeenCalledWith('/v3/configs/config/secrets', {
        params: {},
        headers: { Authorization: 'Bearer dp.st.X' },
      });
      expect(out).toEqual({ DB_PASSWORD: 'p', JWT_SECRET: 's' });
    });

    it('honours project + config query parameters', async () => {
      const http = fakeHttp({ secrets: {} });
      const provider = new DopplerSecretProvider(
        { token: 'dp.st.X', project: 'backend', config: 'production' },
        http,
      );
      await provider.fetch();
      expect(http.get).toHaveBeenCalledWith('/v3/configs/config/secrets', {
        params: { project: 'backend', config: 'production' },
        headers: { Authorization: 'Bearer dp.st.X' },
      });
    });
  });

  describe('VaultSecretProvider', () => {
    it('flattens data.data.data into a flat string map', async () => {
      // Vault KV v2 returns `{ data: { data: {<kvs...>} } }`. axios
      // wraps that in `{ data: <payload> }`. The provider takes three
      // `.data` hops, so the test mock shape matches that depth.
      const http = fakeHttp({
        data: { data: { DB_PASSWORD: 'p', JWT_SECRET: 's' } },
      });
      const provider = new VaultSecretProvider(
        { address: 'https://vault.example.com/', token: 'hvs.x' },
        http,
      );
      const out = await provider.fetch();
      expect(http.get).toHaveBeenCalledWith('/v1/secret/data/novalabs', {
        headers: { 'X-Vault-Token': 'hvs.x' },
      });
      expect(out).toEqual({ DB_PASSWORD: 'p', JWT_SECRET: 's' });
    });

    it('honours VAULT_MOUNT and VAULT_PATH', async () => {
      const http = fakeHttp({ data: { data: {} } });
      const provider = new VaultSecretProvider(
        {
          address: 'https://vault.example.com',
          token: 'hvs.x',
          mount: 'kv',
          path: 'novalabs/prod',
        },
        http,
      );
      await provider.fetch();
      expect(http.get).toHaveBeenCalledWith('/v1/kv/data/novalabs/prod', {
        headers: { 'X-Vault-Token': 'hvs.x' },
      });
    });

    it('drops non-string values silently', async () => {
      const http = fakeHttp({
        data: { data: { OK: '1', NUM: 42, ARR: ['x'], OBJ: { a: 1 } } },
      });
      const provider = new VaultSecretProvider(
        { address: 'https://vault.example.com', token: 'hvs.x' },
        http,
      );
      const out = await provider.fetch();
      expect(out).toEqual({ OK: '1' });
    });
  });

  describe('buildSecretProvider', () => {
    it('returns env provider when kind is env', () => {
      const p = buildSecretProvider('env', {} as SecretProviderOptions);
      expect(p).toBeInstanceOf(EnvSecretProvider);
    });

    it('returns doppler provider when creds are present', () => {
      const p = buildSecretProvider('doppler', {
        doppler: { token: 'dp.st.X' },
      } as SecretProviderOptions);
      expect(p).toBeInstanceOf(DopplerSecretProvider);
    });

    it('throws when doppler is requested without a token', () => {
      expect(() =>
        buildSecretProvider('doppler', {} as SecretProviderOptions),
      ).toThrow(/DOPPLER_TOKEN/);
    });

    it('returns vault provider when creds are present', () => {
      const p = buildSecretProvider('vault', {
        vault: { address: 'https://v', token: 'hvs.x' },
      } as SecretProviderOptions);
      expect(p).toBeInstanceOf(VaultSecretProvider);
    });

    it('throws when vault is requested without address+token', () => {
      expect(() =>
        buildSecretProvider('vault', {} as SecretProviderOptions),
      ).toThrow(/VAULT_ADDR/);
    });
  });
});

describe('SecretsService (issue #121)', () => {
  beforeEach(async () => {
    delete process.env.SECRETS_PROVIDER;
    delete process.env.SECRETS_PROVIDER_CONFIG;
    delete process.env.DOPPLER_TOKEN;
    delete process.env.DOPPLER_PROJECT;
    delete process.env.DOPPLER_CONFIG;
    delete process.env.VAULT_ADDR;
    delete process.env.VAULT_TOKEN;
    delete process.env.VAULT_MOUNT;
    delete process.env.VAULT_PATH;
    for (const k of SECRET_KEYS_TO_CLEAN) delete process.env[k];
    // Reset axios mock implementations so leaked state from a prior
    // test (e.g. axios.create mockReturnValue) does not bleed in.
    (mockedAxios.create as unknown as jest.Mock).mockReset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.SECRETS_PROVIDER;
    delete process.env.SECRETS_PROVIDER_CONFIG;
    delete process.env.DOPPLER_TOKEN;
    delete process.env.DOPPLER_PROJECT;
    delete process.env.DOPPLER_CONFIG;
    delete process.env.VAULT_ADDR;
    delete process.env.VAULT_TOKEN;
    delete process.env.VAULT_MOUNT;
    delete process.env.VAULT_PATH;
    for (const k of SECRET_KEYS_TO_CLEAN) delete process.env[k];
  });

  async function bootstrap(service: SecretsService) {
    await service.onModuleInit();
  }

  it('falls back to process.env when SECRETS_PROVIDER is unset', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'fallback-from-env';
    const service = new SecretsService();
    await bootstrap(service);
    expect(service.get('PAYSTACK_SECRET_KEY')).toBe('fallback-from-env');
    expect(service.providerKind).toBe('env');
    // Env provider fills the cache with the whole process.env; use a
    // key not in this test's process.env to assert the env fallback.
    expect(service.get('UNRELATED_KEY_ALWAYS_MISSES')).toBeUndefined();
  });

  it('logs a warning when SECRETS_PROVIDER is unknown', async () => {
    process.env.SECRETS_PROVIDER = 'Dopler';
    const service = new SecretsService();
    const logger = (service as unknown as {
      logger: { warn: jest.Mock; error: jest.Mock };
    }).logger;
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    await bootstrap(service);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Dopler'));
    expect(service.providerKind).toBe('env');
  });

  it('logs a warning when SECRETS_PROVIDER_CONFIG is malformed', async () => {
    process.env.SECRETS_PROVIDER_CONFIG = '{this-is-not-json';
    const service = new SecretsService();
    const logger = (service as unknown as {
      logger: { warn: jest.Mock; error: jest.Mock };
    }).logger;
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    await bootstrap(service);
    expect(service.providerKind).toBe('env');
    // Boot must not throw and must surface the parse error to logs.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('SECRETS_PROVIDER_CONFIG is not valid JSON'),
    );
  });

  it('uses Doppler when SECRETS_PROVIDER=doppler + DOPPLER_TOKEN are set', async () => {
    process.env.SECRETS_PROVIDER = 'doppler';
    process.env.DOPPLER_TOKEN = 'dp.st.X';

    const http = fakeHttp({
      secrets: { PAYSTACK_SECRET_KEY: { raw: 'from-doppler' } },
    });
    // Override the auto-mocked axios.create so the live
    // DopplerSecretProvider constructor (no injected http) uses our
    // fakeHttp instance.
    (mockedAxios.create as unknown as jest.Mock).mockReturnValue(http);

    const service = new SecretsService();
    await bootstrap(service);
    expect(service.has('PAYSTACK_SECRET_KEY')).toBe(true);
    expect(service.get('PAYSTACK_SECRET_KEY')).toBe('from-doppler');
    expect(service.providerKind).toBe('doppler');
  });

  it('uses Vault when SECRETS_PROVIDER=vault + VAULT_* are set', async () => {
    process.env.SECRETS_PROVIDER = 'vault';
    process.env.VAULT_ADDR = 'https://vault.example.com';
    process.env.VAULT_TOKEN = 'hvs.x';

    const http = fakeHttp({
      data: { data: { PAYSTACK_SECRET_KEY: 'from-vault' } },
    });
    (mockedAxios.create as unknown as jest.Mock).mockReturnValue(http);

    const service = new SecretsService();
    await bootstrap(service);
    expect(service.has('PAYSTACK_SECRET_KEY')).toBe(true);
    expect(service.get('PAYSTACK_SECRET_KEY')).toBe('from-vault');
    expect(service.providerKind).toBe('vault');
  });

  it('returns process.env value when key is not in the provider cache', async () => {
    process.env.SECRETS_PROVIDER = 'doppler';
    process.env.DOPPLER_TOKEN = 'dp.st.X';
    const http = fakeHttp({ secrets: { SOMETHING_ELSE: { raw: 'x' } } });
    (mockedAxios.create as unknown as jest.Mock).mockReturnValue(http);
    process.env.OTHER_KEY = 'from-process-env';

    const service = new SecretsService();
    await bootstrap(service);
    expect(service.get('OTHER_KEY')).toBe('from-process-env');
  });

  it('falls back to env provider when doppler construction fails', async () => {
    process.env.SECRETS_PROVIDER = 'doppler';
    process.env.PAYSTACK_SECRET_KEY = 'fallback-from-env';
    // No DOPPLER_TOKEN → buildSecretProvider throws; service falls back.
    const service = new SecretsService();
    const logger = (service as unknown as {
      logger: { warn: jest.Mock; error: jest.Mock };
    }).logger;
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    await bootstrap(service);
    expect(service.providerKind).toBe('env');
    expect(errSpy).toHaveBeenCalled();
    expect(service.get('PAYSTACK_SECRET_KEY')).toBe('fallback-from-env');
  });

  it('keeps the previous cache when a refresh fails (graceful degradation)', async () => {
    process.env.SECRETS_PROVIDER = 'doppler';
    process.env.DOPPLER_TOKEN = 'dp.st.X';
    const http = fakeHttp({
      secrets: { PAYSTACK_SECRET_KEY: { raw: 'fresh' } },
    });
    (mockedAxios.create as unknown as jest.Mock).mockReturnValue(http);
    const service = new SecretsService();
    await bootstrap(service);
    expect(service.get('PAYSTACK_SECRET_KEY')).toBe('fresh');

    http.get.mockRejectedValueOnce(new Error('network down'));
    await service.refresh();

    expect(service.get('PAYSTACK_SECRET_KEY')).toBe('fresh');
  });

  it('refresh() picks up a rotated secret on call', async () => {
    process.env.SECRETS_PROVIDER = 'doppler';
    process.env.DOPPLER_TOKEN = 'dp.st.X';
    const http = fakeHttp({
      secrets: { PAYSTACK_SECRET_KEY: { raw: 'first' } },
    });
    (mockedAxios.create as unknown as jest.Mock).mockReturnValue(http);
    const service = new SecretsService();
    await bootstrap(service);
    expect(service.get('PAYSTACK_SECRET_KEY')).toBe('first');

    http.get.mockResolvedValueOnce({
      data: { secrets: { PAYSTACK_SECRET_KEY: { raw: 'rotated' } } },
    });
    await service.refresh();

    expect(http.get).toHaveBeenCalledTimes(2);
    expect(service.get('PAYSTACK_SECRET_KEY')).toBe('rotated');
  });

  it('does not poll when SECRETS_PROVIDER is unset (env provider)', async () => {
    const service = new SecretsService();
    await bootstrap(service);
    expect((service as unknown as { refreshTimer: NodeJS.Timeout | null })
      .refreshTimer).toBeNull();
  });

  it('does not boot with a timer when refreshIntervalMs is 0', async () => {
    process.env.SECRETS_PROVIDER = 'doppler';
    process.env.DOPPLER_TOKEN = 'dp.st.X';
    process.env.SECRETS_PROVIDER_CONFIG = JSON.stringify({
      refreshIntervalMs: 0,
    });
    (mockedAxios.create as unknown as jest.Mock).mockReturnValue(fakeHttp({ secrets: {} }));
    const service = new SecretsService();
    await bootstrap(service);
    expect((service as unknown as { refreshTimer: NodeJS.Timeout | null })
      .refreshTimer).toBeNull();
  });

  it('clears the timer on destroy so jest can exit', async () => {
    process.env.SECRETS_PROVIDER = 'doppler';
    process.env.DOPPLER_TOKEN = 'dp.st.X';
    (mockedAxios.create as unknown as jest.Mock).mockReturnValue(fakeHttp({ secrets: {} }));
    const service = new SecretsService();
    await bootstrap(service);
    expect((service as unknown as { refreshTimer: NodeJS.Timeout | null })
      .refreshTimer).not.toBeNull();
    service.onModuleDestroy();
    expect((service as unknown as { refreshTimer: NodeJS.Timeout | null })
      .refreshTimer).toBeNull();
  });
});

describe('SecretProvider contract', () => {
  it('every concrete provider exposes kind and fetch', () => {
    const providers: SecretProvider[] = [
      new EnvSecretProvider(),
      new DopplerSecretProvider({ token: 'dp.st.X' }),
      new VaultSecretProvider({ address: 'https://v', token: 'hvs.x' }),
    ];
    expect(providers.length).toBe(3);
    for (const p of providers) {
      expect(['env', 'doppler', 'vault']).toContain(p.kind);
      expect(typeof p.fetch).toBe('function');
    }
  });
});
