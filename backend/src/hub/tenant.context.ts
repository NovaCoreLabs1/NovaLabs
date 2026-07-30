import { AsyncLocalStorage } from 'async_hooks';

/**
 * Lightweight tenant context backed by Node.js `AsyncLocalStorage`.
 *
 * This store is populated once per request by `TenantMiddleware` and
 * provides the active `hubId` to every downstream service, guard, or
 * interceptor **without** threading a tenant parameter through every
 * function signature.
 *
 * Usage:
 * ```ts
 * const hubId = tenantContext.getHubId(); // string | undefined
 * ```
 *
 * NOTE: This replaces older patterns like `cls-hooked` / `nestjs-cls`.
 *       `AsyncLocalStorage` is stable since Node.js 16 and requires no
 *       additional dependencies.
 */
class TenantContext {
  private readonly storage = new AsyncLocalStorage<{ hubId: string }>();

  /**
   * Run the given callback with the supplied tenant context.
   * Called by the middleware for every incoming request.
   */
  run(hubId: string, callback: () => unknown): void {
    this.storage.run({ hubId }, callback);
  }

  /** Retrieve the hubId for the current asynchronous context. */
  getHubId(): string | undefined {
    return this.storage.getStore()?.hubId;
  }
}

export const tenantContext = new TenantContext();
