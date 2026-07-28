/**
 * CORS configuration helpers.
 *
 * Extracted from `main.ts` so the parsing logic is unit-testable in isolation
 * and so both the HTTP API (Nest `enableCors`) and the WebSocket gateway
 * (`@WebSocketGateway cors`) consume a single source of truth.
 *
 * Production policy (resolves issue #110):
 * - `CORS_ORIGINS` is REQUIRED when `NODE_ENV === "production"`.
 * - When set, its value is parsed as a comma-separated list of origins.
 * - When unset in production, callers must throw to fail fast at boot.
 *
 * Development policy:
 * - When `CORS_ORIGINS` is unset, requests from any origin are allowed
 *   (the previous static dev-host list is retained as an explicit fallback
 *   so existing developer workflows keep working).
 */
export interface ResolvedCorsConfig {
  /**
   * The value to pass to NestJS / Socket.IO as `origin`.
   *
   *  - `true`  → allow any origin (development fallback).
   *  - `[]`    → no origins allowed (production fail-fast guard).
   *  - `[..]`  → explicit allow-list shared with the `credentials: true`
   *              option. Never use a literal `'*'` here in production
   *              because credentials require an explicit allow-list.
   */
  origin: string[] | boolean;
}

/**
 * Parse a comma-separated `CORS_ORIGINS` env value into a clean allow-list.
 *
 * - Trims whitespace.
 * - Drops empty entries.
 * - De-duplicates while preserving the original order.
 * - **Rejects wildcard `"*"` and `null` origins** that would otherwise be
 *   placed into the allow-list. Browsers refuse credentials-cookies with a
 *   wildcard CORS origin, so silently accepting it would only surface the
 *   failure in production. Failing here at boot is safer.
 */
export function parseCorsOrigins(
  corsOriginsCsv: string | undefined | null,
): string[] {
  if (!corsOriginsCsv) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of corsOriginsCsv.split(',')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed === '*' || trimmed.toLowerCase() === 'null') {
      throw new Error(
        `[CORS] Wildcard origin "${trimmed}" is not permitted in CORS_ORIGINS (would break credentials-cookie requests). Set explicit origins instead.`,
      );
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * A defensive wrapper around {@link resolveWsCorsConfig} that is safe to
 * evaluate at @WebSocketGateway decorator time (module load). In production
 * a misconfigured environment still throws — but outside of production we
 * degrade to an empty allow-list while logging loudly, so unit tests that
 * import the gateway module don't need to pre-set `CORS_ORIGINS`.
 */
export function resolveWsCorsConfigSafe(
  nodeEnv: string | undefined,
  corsOriginsCsv: string | undefined | null,
): { origin: string[] | string } {
  try {
    return resolveWsCorsConfig(nodeEnv, corsOriginsCsv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (nodeEnv === 'production') {
      // Production must crash — the HTTP layer will surface the same root
      // cause anyway, and we want a noisy stack trace for the operator.
      throw err;
    }
    // Non-production: log and return a deny-all default so tests/scripts
    // can import the module without crashing.
    // eslint-disable-next-line no-console
    console.warn(
      `[CORS] WebSocket gateway CORS misconfigured; defaulting to deny-all in this environment. ${message}`,
    );
    return { origin: [] };
  }
}

/**
 * The dev-host fallback list. Kept narrow and explicit: anything outside this
 * list (or `CORS_ORIGINS`) during development must surface as a CORS error.
 */
export const DEV_FALLBACK_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

/**
 * Resolve the CORS configuration for `app.enableCors`.
 *
 * Throws when running in production with an empty allow-list — failing fast
 * is preferable to silently shipping a permissive API.
 */
export function resolveCorsConfig(
  nodeEnv: string | undefined,
  corsOriginsCsv: string | undefined | null,
): ResolvedCorsConfig {
  const isProduction = nodeEnv === 'production';
  const parsed = parseCorsOrigins(corsOriginsCsv);

  if (isProduction) {
    if (parsed.length === 0) {
      throw new Error(
        '[CORS] CORS_ORIGINS environment variable is required and must be non-empty when NODE_ENV=production. ' +
          'Set it to a comma-separated list of allowed origins, e.g. "https://novalabs.app,https://www.novalabs.app".',
      );
    }
    return { origin: parsed };
  }

  if (parsed.length > 0) {
    return { origin: parsed };
  }
  return { origin: DEV_FALLBACK_ORIGINS as string[] };
}

/**
 * Resolve the CORS configuration for the Socket.IO WebSocket gateway.
 *
 * The HTTP API must use an explicit allow-list (because `credentials: true`
 * with `'*'` is rejected by browsers), but the WebSocket gateway can safely
 * fall back to `'*'` in development because socket JWTs are independently
 * validated on `handleConnection`.
 *
 * In production we mirror the strict HTTP allow-list to keep behaviour
 * consistent across transports — a mis-deployed preview running on a
 * non-allowed origin will not be able to subscribe either.
 */
export function resolveWsCorsConfig(
  nodeEnv: string | undefined,
  corsOriginsCsv: string | undefined | null,
): { origin: string[] | string } {
  const isProduction = nodeEnv === 'production';
  const parsed = parseCorsOrigins(corsOriginsCsv);

  if (isProduction) {
    // Production must fail closed — empty allow-list here would have already
    // thrown at HTTP layer, but defend-in-depth so a future code path that
    // only configures WS cannot accidentally ship open CORS.
    if (parsed.length === 0) {
      throw new Error(
        '[CORS] CORS_ORIGINS environment variable is required for the WebSocket gateway when NODE_ENV=production.',
      );
    }
    return { origin: parsed };
  }

  return { origin: parsed.length > 0 ? parsed : '*' };
}
