import * as tls from 'tls';
import * as https from 'https';
import { applyTlsHardening } from './tls-hardening';

describe('TLS hardening (PCI DSS — issue #122)', () => {
  const ORIGINAL_REQUEST = https.request;
  const ORIGINAL_DEFAULT_MIN = tls.DEFAULT_MIN_VERSION;

  function resetTlsState(): void {
    delete (https as unknown as { __novalabsTlsPatched?: boolean })
      .__novalabsTlsPatched;
    (https as unknown as { request: typeof ORIGINAL_REQUEST }).request =
      ORIGINAL_REQUEST;
    (tls as unknown as { DEFAULT_MIN_VERSION: tls.SecureVersion }).DEFAULT_MIN_VERSION =
      ORIGINAL_DEFAULT_MIN;
    if (https.globalAgent?.options) {
      https.globalAgent.options.minVersion = ORIGINAL_DEFAULT_MIN;
      https.globalAgent.options.requestCert = false;
    }
  }

  beforeEach(() => {
    resetTlsState();
  });

  afterAll(() => {
    resetTlsState();
  });

  it('sets tls.DEFAULT_MIN_VERSION to TLSv1.2', () => {
    applyTlsHardening();
    expect(tls.DEFAULT_MIN_VERSION).toBe('TLSv1.2');
  });

  it('pins minVersion and requestCert on the global https agent', () => {
    applyTlsHardening();
    expect(https.globalAgent.options.minVersion).toBe('TLSv1.2');
    expect(https.globalAgent.options.requestCert).toBe(true);
  });

  it('overrides caller-supplied downgrades (TLSv1 must become TLSv1.2)', () => {
    // Replace https.request with a no-op spy BEFORE applying the patch so
    // the patch captures the spy as its `originalRequest`. The spy only
    // RECORDS calls — it does NOT execute the real https.request (which
    // would attempt an actual socket and make the test network-dependent).
    const spy = jest.fn();
    (https as unknown as { request: typeof ORIGINAL_REQUEST }).request =
      spy as unknown as typeof ORIGINAL_REQUEST;

    applyTlsHardening();

    https.request(
      'https://example.com',
      { minVersion: 'TLSv1' as tls.SecureVersion },
      () => undefined,
    );

    expect(spy).toHaveBeenCalledTimes(1);
    // The patch mutates args[1] in place to { minVersion: 'TLSv1.2',
    // requestCert: true, ...incoming options }, so spy.calls[0][1]
    // reflects the post-hardening options.
    const captured = spy.mock.calls[0] as unknown[];
    const options = (captured[1] ?? {}) as Record<string, unknown>;
    expect(options.minVersion).toBe('TLSv1.2');
    expect(options.requestCert).toBe(true);
  });

  it('overrides caller-supplied downgrades when no URL is given', () => {
    const spy = jest.fn();
    (https as unknown as { request: typeof ORIGINAL_REQUEST }).request =
      spy as unknown as typeof ORIGINAL_REQUEST;

    applyTlsHardening();

    https.request({ host: 'example.com', path: '/' }, () => undefined);

    expect(spy).toHaveBeenCalledTimes(1);
    const captured = spy.mock.calls[0] as unknown[];
    const options = (captured[0] ?? {}) as Record<string, unknown>;
    expect(options.minVersion).toBe('TLSv1.2');
    expect(options.requestCert).toBe(true);
  });

  it('always sets minVersion and requestCert even when caller omits them', () => {
    const spy = jest.fn();
    (https as unknown as { request: typeof ORIGINAL_REQUEST }).request =
      spy as unknown as typeof ORIGINAL_REQUEST;

    applyTlsHardening();

    // No options object passed at all.
    https.request('https://example.com', () => undefined);

    expect(spy).toHaveBeenCalledTimes(1);
    // patchedRequest inserted a hardened empty options object between
    // the URL and the callback, so [1] is that object (not the cb).
    const captured = spy.mock.calls[0] as unknown[];
    const options = (captured[1] ?? {}) as Record<string, unknown>;
    expect(options.minVersion).toBe('TLSv1.2');
    expect(options.requestCert).toBe(true);
  });

  it('overrides a custom https.Agent.options.minVersion as well', () => {
    // Pass-4 reviewer caught this gap: a caller (or a misconfigured
    // Axios / AWS SDK / Stellar SDK) that supplies its own
    // `https.Agent({ minVersion: 'TLSv1' })` would otherwise bypass
    // the request-level patch because Node consults agent.options
    // (not the request-level options) at TLS handshake time. The
    // patch must mutate the agent's options in place.
    const spy = jest.fn();
    (https as unknown as { request: typeof ORIGINAL_REQUEST }).request =
      spy as unknown as typeof ORIGINAL_REQUEST;

    applyTlsHardening();

    const customAgent = new https.Agent({
      minVersion: 'TLSv1',
      maxVersion: 'TLSv1',
    });

    https.request(
      'https://example.com',
      { agent: customAgent },
      () => undefined,
    );

    expect(customAgent.options.minVersion).toBe('TLSv1.2');
    expect(customAgent.options.requestCert).toBe(true);
    // And the request-level options were also hardened, so the spy
    // received options that survive even if the agent is dropped.
    const captured = spy.mock.calls[0] as unknown[];
    const requestOptions = (captured[1] ?? {}) as Record<string, unknown>;
    expect(requestOptions.minVersion).toBe('TLSv1.2');
    expect(requestOptions.requestCert).toBe(true);
  });

  it('does not regress under concurrent calls (idempotent)', () => {
    applyTlsHardening();
    const first = (https as unknown as { request: unknown }).request;
    applyTlsHardening();
    applyTlsHardening();
    const after = (https as unknown as { request: unknown }).request;
    expect(first).toBe(after);
  });

  it('does not crash when called repeatedly', () => {
    expect(() => {
      applyTlsHardening();
      applyTlsHardening();
      applyTlsHardening();
    }).not.toThrow();
  });
});

describe('TLS hardening — acceptance: TLS 1.0 endpoint must fail', () => {
  // Network-only acceptance test. Skipped when CI runs offline. The
  // `NOVALABS_CI_OFFLINE` prefix avoids colliding with the generic
  // `CI_OFFLINE` flag some runners set for unrelated reasons.
  const offline = process.env.NOVALABS_CI_OFFLINE === 'true';
  const url = 'https://tls-v1-0.badssl.com:1010/';

  (offline ? it.skip : it)(
    'refuses badssl.com TLS 1.0 endpoint when minVersion=TLSv1.2',
    async () => {
      applyTlsHardening();
      await expect(
        new Promise<number>((resolve, reject) => {
          const req = https.get(url, (res) => {
            resolve(res.statusCode ?? 0);
            res.resume();
          });
          req.on('error', reject);
          req.setTimeout(5_000, () => req.destroy(new Error('timeout')));
        }),
      ).rejects.toThrow();
    },
    10_000,
  );
});
