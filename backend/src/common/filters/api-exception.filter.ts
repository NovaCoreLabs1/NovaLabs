import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorDto } from '../dto/api-error.dto';

/**
 * Map of HTTP status codes to machine-readable error codes.
 * Used to populate `ApiErrorDto.code` from NestJS's numeric status.
 */
const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.GONE]: 'GONE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/**
 * Global exception filter that converts every thrown exception — whether a
 * NestJS `HttpException` or an unexpected runtime error — into the canonical
 * `ApiErrorDto` shape.
 *
 * Registration via `APP_FILTER` in `AppModule` ensures this filter runs for
 * every route, including those not explicitly annotated.
 *
 * ## Internal errors
 * For 5xx responses the `details` field is intentionally omitted to avoid
 * leaking stack traces or internal state to clients.  The full error is logged
 * server-side so it can be correlated via `requestId`.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Derive the HTTP status
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Derive the code
    const code = STATUS_CODE_MAP[status] ?? 'UNKNOWN_ERROR';

    // Derive the human-readable message and optional details
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        // NestJS validation pipe emits { statusCode, message: string[], error }
        message =
          typeof resp['message'] === 'string'
            ? resp['message']
            : exception.message;
        // Surface validation field errors only for 4xx
        if (status < 500 && resp['message'] !== undefined) {
          details = Array.isArray(resp['message']) ? resp['message'] : undefined;
        }
      }
    } else if (exception instanceof Error) {
      // Never expose raw error messages from unexpected runtime errors
      message = 'Internal server error';
    }

    // Build a request-scoped correlation ID
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ??
      `req_${Math.random().toString(36).slice(2, 10)}`;

    const body: ApiErrorDto = {
      code,
      status,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      ...(details !== undefined ? { details } : {}),
    };

    // Log 5xx errors server-side for observability
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }
}
