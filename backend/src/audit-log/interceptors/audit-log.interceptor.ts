import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../providers/audit-log.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    const url = request.originalUrl || request.url;
    const user = request.user;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const targetId = this.extractIdFromParams(request.params);
    const targetType = this.inferTargetType(url);
    const action = this.inferAction(method, targetType);

    const metadata = this.sanitizeBody(request.body);

    const handler = context.getHandler();
    const controller = context.getClass();
    const handlerName = handler.name;
    const controllerName = controller.name.replace('Controller', '');

    return next.handle().pipe(
      tap({
        next: async () => {
          await this.auditLogService.create({
            actorId: user?.id,
            actorEmail: user?.email,
            actorRole: user?.role,
            action: `${controllerName.toLowerCase()}.${action}`,
            targetType: targetType,
            targetId: targetId,
            ipAddress: request.ip,
            userAgent: request.get('user-agent') || null,
            metadata: {
              ...metadata,
              handler: handlerName,
              statusCode: response.statusCode,
            },
          });
        },
        error: async (err) => {
          await this.auditLogService.create({
            actorId: user?.id,
            actorEmail: user?.email,
            actorRole: user?.role,
            action: `${controllerName.toLowerCase()}.${action}`,
            targetType: targetType,
            targetId: targetId,
            ipAddress: request.ip,
            userAgent: request.get('user-agent') || null,
            metadata: {
              ...metadata,
              handler: handlerName,
              error: err.message,
            },
          });
          throw err;
        },
      }),
    );
  }

  private extractIdFromParams(params: Record<string, any>): string | undefined {
    const id = params['id'];
    if (id && typeof id === 'string') {
      return id;
    }
    return undefined;
  }

  private inferTargetType(url: string): string | undefined {
    const parts = url.split('/').filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === 'api' && parts[i + 1]) {
        return parts[i + 1].replace(/s$/, '');
      }
    }
    return undefined;
  }

  private inferAction(method: string, targetType?: string): string {
    switch (method) {
      case 'POST':
        return 'create';
      case 'PUT':
        return 'update';
      case 'PATCH':
        return 'update';
      case 'DELETE':
        return 'delete';
      default:
        return method.toLowerCase();
    }
  }

  private sanitizeBody(body: any): Record<string, any> {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const sensitiveKeys = new Set([
      'password',
      'passwordResetToken',
      'verificationToken',
      'verificationCode',
      'passwordResetCode',
      'totpSecret',
      'accessToken',
      'refreshToken',
      'secret',
      'token',
      'rawBody',
    ]);

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
      if (sensitiveKeys.has(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (
        value &&
        typeof value === 'object' &&
        !Buffer.isBuffer(value)
      ) {
        sanitized[key] = this.sanitizeBody(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
