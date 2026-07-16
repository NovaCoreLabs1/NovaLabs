import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';
import * as crypto from 'crypto';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      catchError((error) => {
        // Only capture if Sentry is initialized
        if (process.env.SENTRY_DSN) {
          Sentry.withScope((scope) => {
            // Add request context
            scope.setTag('route', request.route?.path || request.url);
            scope.setTag('method', request.method);

            // Add user context with hashed email for privacy
            if (request.user) {
              const hashedEmail = request.user.email
                ? crypto
                    .createHash('sha256')
                    .update(request.user.email)
                    .digest('hex')
                    .substring(0, 16)
                : undefined;

              scope.setUser({
                id: request.user.id,
                email_hash: hashedEmail,
              });
            }

            // Add request body (excluding sensitive fields)
            const sanitizedBody = this.sanitizeBody(request.body);
            scope.setExtra('requestBody', sanitizedBody);

            // Capture the exception
            Sentry.captureException(error);
          });
        }

        return throwError(() => error);
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = [
      'password',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      'creditCard',
      'cardNumber',
      'cvv',
      'ssn',
    ];

    const sanitized = { ...body };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
