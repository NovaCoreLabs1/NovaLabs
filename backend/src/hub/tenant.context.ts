import { AsyncLocalStorage } from 'async_hooks';

/**
 * Lightweight tenant context backed by Node.js `AsyncLocalStorage`.
 *
 * The store is populated **once per request by `TenantInterceptor`**
 * (`backend/src/hub/tenant.interceptor.ts`, registered globally in
 * `main.ts`). A former `TenantMiddleware` that used to do this was removed
 * in commit 4de6adc; it no longer exists.
 *
 * Resolution precedence applied by the interceptor (issue #225):
 *
 * 1. Authenticated caller — the JWT `hubId` claim is authoritative.
 * 2. ADMIN / SUPER_ADMIN may switch tenants via the `x-hub-id` header
 *    (audited); any other caller sending the header receives 403.
 * 3. Otherwise the deployment default-hub UUID resolves via
 *    `DefaultHubService`, so the store holds a real hub UUID or — before
 *    boot-time resolution completed — `undefined`.
 *
 * It provides the active `hubId` to every downstream service, guard, or
 * interceptor **without** threading a tenant parameter through every
 * function signature:
 *
 * ```ts
 * const hubId = tenantContext.getHubId(); // string | undefined
 * ```
 */
class TenantContext {
  private readonly storage = new AsyncLocalStorage<{
    hubId: string | undefined;
  }>();

  /**
   * Run the given callback with the supplied tenant context.
   * Called by the interceptor for every incoming request; `undefined`
   * means "resolved before boot-time default-hub lookup finished" and is
   * a distinct state from holding a real hub UUID.
   */
  run(hubId: string | undefined, callback: () => unknown): void {
    this.storage.run({ hubId }, callback);
  }

  /** Retrieve the hubId for the current asynchronous context. */
  getHubId(): string | undefined {
    return this.storage.getStore()?.hubId;
  }
}

export const tenantContext = new TenantContext();
