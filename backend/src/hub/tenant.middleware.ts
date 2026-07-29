import {
  Injectable,
  NestMiddleware,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from './tenant.context';

/**
 * Middleware that resolves the active tenant (hub) for the current
 * request and makes it available through the `TenantContext` service.
 *
 * Resolution order:
 * 1. Authenticated user's JWT `hubId` claim (if present).
 * 2. `x-hub-id` request header (for internal service-to-service calls).
 * 3. Falls back to `undefined` — tenant-aware guards/services can then
 *    decide whether to allow, deny, or default.
 *
 * Admin users may switch their active hub by sending a different
 * `x-hub-id` header.  Regular users are denied if they attempt to
 * override their assigned hub.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    const user = (req as any).user;
    const userHubId = user?.hubId;
    const headerHubId = req.headers['x-hub-id'] as string | undefined;
    const userRole = user?.role;

    // Determine the effective hubId for this request.
    let hubId: string | undefined;

    if (userHubId) {
      // Authenticated user — their JWT carries a hubId claim.
      hubId = userHubId;

      // If the user is NOT an admin and tries to override their hub via
      // the header, reject the request.
      if (headerHubId && headerHubId !== userHubId && userRole !== 'admin') {
        throw new ForbiddenException(
          'You do not have permission to switch hubs.',
        );
      }

      // Admins may override their hub via the header.
      if (headerHubId && userRole === 'admin') {
        hubId = headerHubId;
      }
    } else if (headerHubId) {
      // Service-to-service request identified by the x-hub-id header.
      hubId = headerHubId;
    }

    // Inject the resolved hubId into the request object so controllers
    // and guards can also access it without importing TenantContext.
    (req as any).hubId = hubId;

    tenantContext.run(hubId ?? 'default', () => next());
  }
}
