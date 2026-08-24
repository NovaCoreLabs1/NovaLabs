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
import { DefaultHubService } from './default-hub.service';
import { AuditLogService } from '../audit-log/providers/audit-log.service';

/**
 * Interceptor that resolves the active tenant (hub) for the current
 * request and stores it in the `TenantContext` (AsyncLocalStorage).
 *
 * Runs **after** the NestJS guard pipeline, so `req.user` (populated by
 * `JwtStrategy.validate()`) is already available for authenticated routes.
 *
 * Resolution precedence (issue #225):
 *
 * 1. Authenticated caller: the JWT `hubId` claim is authoritative. A
 *    matching `x-hub-id` header is a no-op.
 * 2. ADMIN / SUPER_ADMIN callers may *switch* hubs via `x-hub-id`; every
 *    accepted switch is written to the audit log (`hub.switch`).
 * 3. Any other caller presenting `x-hub-id` — authenticated non-admin or
 *    completely unauthenticated traffic — receives **403**. Before #225 the
 *    header was silently honoured for everyone, implying scoping that no
 *    service ever performed; the header is now a privileged control.
 * 4. Otherwise the cached default-hub UUID (see `DefaultHubService`)
 *    resolves as the tenant so the context never carries the non-UUID
 *    `'default'` placeholder. Until boot-time resolution has completed the
 *    store is left undefined and consumers must treat that as "no scope".
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  constructor(
    private readonly defaultHubService: DefaultHubService,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const userHubId: string | undefined = user?.hubId;
    const headerHubId = req.headers['x-hub-id'] as string | undefined;
    const userRole: string | undefined = user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    let hubId: string | undefined;

    if (!headerHubId || headerHubId === userHubId) {
      // No header, or the header merely restates the caller's own tenant.
      hubId = userHubId ?? this.defaultHubService.defaultHubId;
    } else if (isAdmin) {
      // Privileged hub switch — audited so cross-tenant reads are traceable.
      hubId = headerHubId;
      void this.auditLogService.create({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: userRole,
        action: 'hub.switch',
        targetType: 'hub',
        targetId: headerHubId,
        ipAddress: req.ip,
        userAgent:
          typeof req.get === 'function' ? req.get('user-agent') : undefined,
      });
    } else {
      throw new ForbiddenException(
        'You do not have permission to switch hubs.',
      );
    }

    // Attach so controllers/guards can access without importing TenantContext.
    req.hubId = hubId;

    this.logger.debug(
      `Tenant resolved: hubId=${hubId ?? 'unresolved'}, user=${user?.id ?? 'anon'}`,
    );

    return new Observable<unknown>((subscriber) => {
      tenantContext.run(hubId, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
