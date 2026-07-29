import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key consumed by the composite-rate-limit guard
 * (see CompositeRateLimitGuard).
 */
export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Configuration shape for per-endpoint composite rate limiting.
 *
 * Both `perUser` and `perIp` limits apply simultaneously.  An incoming
 * request must pass **both** buckets before it is allowed.
 */
export interface RateLimitConfig {
  /** Maximum requests per window tied to the authenticated user id. */
  perUser: number;
  /** Maximum requests per window tied to the client IP address. */
  perIp: number;
  /** Sliding-window duration (e.g. '1m', '30s', '1h'). */
  window: string;
}

/**
 * Decorator that applies composite (per-user + per-IP) rate limiting to a
 * controller or route handler.
 *
 * Usage:
 * ```ts
 * @RateLimit({ perUser: 20, perIp: 100, window: '1m' })
 * @Post('sensitive')
 * async sensitiveEndpoint() { … }
 * ```
 *
 * Requires `CompositeRateLimitGuard` to be registered (either globally or
 * on the owning module/controller).
 */
export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);
