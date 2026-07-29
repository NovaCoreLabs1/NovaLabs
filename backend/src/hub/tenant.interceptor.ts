import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantContext } from './tenant.context';

/**
 * Interceptor that resolves the active tenant (hub) for the current
 * request and stores it in the `TenantContext` (AsyncLocalStorage).
 *
 * Runs **after** the NestJS guard pipeline, so `req.user` (populated by
 * `JwtStrategy.validate()`) is already available for authenticated routes.
 *
 * Resolution order:
 * 1. Authenticated user's JWT `hubId` claim.
 * 2. `x-hub-id` request header (internal service-to-service calls).
 * 3. Falls back to `'default'`.
 *
 * Admin users may switch hubs via the `x-hub-id` header. Regular users
 * who attempt to override their assigned hub receive a 403 Forbidden.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const userHubId = user?.hubId;
    const headerHubId = req.headers['x-hub-id'] as string | undefined;
    const userRole = user?.role;

    let hubId: string | undefined;

    if (userHubId) {
      hubId = userHubId;

      // Non-admin users may not override their assigned hub.
      if (headerHubId && headerHubId !== userHubId && userRole !== 'admin') {
        throw new ForbiddenException(
          'You do not have permission to switch hubs.',
        );
      }

      // Admins may switch via header.
      if (headerHubId && userRole === 'admin') {
        hubId = headerHubId;
      }
    } else if (headerHubId) {
      // Service-to-service traffic identified by the header.
      hubId = headerHubId;
    }

    // Attach so controllers/guards can access without importing TenantContext.
    req.hubId = hubId;

    this.logger.debug(
      `Tenant resolved: hubId=${hubId ?? 'default'}, user=${user?.id ?? 'anon'}`,
    );

    return new Observable<unknown>((subscriber) => {
      tenantContext.run(hubId ?? 'default', () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
