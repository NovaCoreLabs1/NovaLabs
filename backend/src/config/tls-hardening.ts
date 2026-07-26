/**
 * PCI DSS — outbound TLS hardening.
 *
 * Programmatic enforcement of:
 *   - TLS >= 1.2 on every outbound TLS connection (`tls.DEFAULT_MIN_VERSION`)
 *   - `minVersion: 'TLSv1.2'` and `requestCert: true` on every `https.request`
 *     call, including those that pass a custom `https.Agent` (Axios, AWS SDK,
 *     Stellar SDK, etc.).
 *
 * Mirrors the `NODE_OPTIONS=--use-openssl-ca` recommendation from the
 * ops runbook: certificates must come from the system trust store, not
 * whatever the Node binary was bundled with. That flag has to be set at
 * process boot — see `package.json`'s `start:prod` script — so this
 * module complements (does not replace) it.
 *
 * Idempotent: safe to call multiple times. Exposed as a function so
 * tests can verify the side-effects without spinning up the full app.
 */
import * as tls from 'tls';
import * as https from 'https';
import type * as http from 'http';

const REQUIRED_MIN_VERSION: tls.SecureVersion = 'TLSv1.2';

function isStringOrUrl(value: unknown): value is string | URL {
  return typeof value === 'string' || value instanceof URL;
}

function hardenRequestOptions(options: unknown): Record<string, unknown> {
  const base: Record<string, unknown> =
    options && typeof options === 'object' ? { ...(options as object) } : {};
  base.minVersion = REQUIRED_MIN_VERSION;
  base.requestCert = true;
  return base;
}

/**
 * Monkey-patch `https.request` so every outbound call refuses TLS < 1.2
 * and requests the peer certificate, even when callers pass a custom
 * `https.Agent` (which would otherwise override the global defaults).
 *
 * Two layers of hardening are necessary because Node consults an
 * explicit `https.Agent`'s own `.options` (not the request-level
 * options) when establishing the TLS socket:
 *
 *   1. The request-level options (`minVersion`, `requestCert`).
 *   2. The agent's own `.options` (`args.agent.options.minVersion`,
 *      `args.agent.options.requestCert`) when a custom agent is passed.
 *
 * Without (2), a caller passing `agent: new https.Agent({ minVersion:
 * 'TLSv1', maxVersion: 'TLSv1' })` would still handshake at TLS 1.0 and
 * bypass the PCI DSS guarantee.
 *
 * The patch is idempotent — calling `applyTlsHardening()` twice is a no-op.
 */
export function applyTlsHardening(): void {
  // Sentinel check FIRST. This avoids re-capturing a previously-patched
  // `https.request` as the "original" if the function is re-entered in a
  // long-lived process (e.g. Nest testing module factories bootstrapping
  // the app multiple times).
  const anyHttps = https as unknown as { __novalabsTlsPatched?: boolean };
  if (anyHttps.__novalabsTlsPatched) {
    return;
  }

  // Pin global TLS defaults. `tls.DEFAULT_MIN_VERSION` is typed
  // `readonly` in `@types/node ≥ 20` but the runtime makes it writable;
  // cast so the typecheck is happy and our override sticks even if a
  // downstream package restored the default.
  (tls as unknown as { DEFAULT_MIN_VERSION: tls.SecureVersion }).DEFAULT_MIN_VERSION =
    REQUIRED_MIN_VERSION;

  const globalAgent = https.globalAgent as https.Agent | undefined;
  if (globalAgent?.options) {
    globalAgent.options.minVersion = REQUIRED_MIN_VERSION;
    globalAgent.options.requestCert = true;
  }

  const originalRequest = https.request.bind(https) as (
    ...args: unknown[]
  ) => http.ClientRequest;

  function patchedRequest(...args: unknown[]): http.ClientRequest {
    const hasUrl = args.length > 0 && isStringOrUrl(args[0]);
    const optionsIndex = hasUrl ? 1 : 0;
    const optionsObj: Record<string, unknown> =
      (args[optionsIndex] as Record<string, unknown> | undefined) ?? {};
    args[optionsIndex] = hardenRequestOptions(optionsObj);
    // Also override the custom agent's own options so a caller passing
    // `https.Agent({ minVersion: 'TLSv1' })` still negotiates >= TLSv1.2.
    // NOTE: this mutates the caller's `agent.options` in place. Agents
    // are typically long-lived and shared across requests, so making
    // the override persistent is intentional — subsequent requests
    // through the same agent also refuse TLS < 1.2.
    const agent = optionsObj.agent as { options?: Record<string, unknown> } | undefined;
    if (agent?.options && typeof agent.options === 'object') {
      agent.options.minVersion = REQUIRED_MIN_VERSION;
      agent.options.requestCert = true;
    }
    return originalRequest(...args);
  }

  (https as unknown as { request: typeof patchedRequest }).request =
    patchedRequest as unknown as typeof https.request;
  anyHttps.__novalabsTlsPatched = true;
}
