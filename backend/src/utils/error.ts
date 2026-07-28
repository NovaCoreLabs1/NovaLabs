import { HttpException, InternalServerErrorException } from '@nestjs/common';

/**
 * Utility function for uniform error handling across service providers.
 *
 * - Re-throws NestJS `HttpException` instances as-is so their status codes
 *   and messages are preserved and shaped by the global `ApiExceptionFilter`.
 * - Wraps all other unexpected errors in `InternalServerErrorException` with a
 *   **generic** message (`code: 'INTERNAL_ERROR'`) to avoid leaking
 *   implementation details.  The `context` label is passed as an option so it
 *   appears in server-side logs without reaching the client.
 *
 * @param error   - The caught error object.
 * @param context - A short label that identifies where the error originated
 *                  (e.g. `'CreateBooking'`).  Used only for server-side logging.
 * @throws `HttpException` | `InternalServerErrorException`
 */
export function ErrorCatch(error: unknown, context: string): never {
  if (error instanceof HttpException) {
    throw error;
  }

  // Log the raw error server-side so it can be investigated while keeping
  // the public-facing message generic.
  // eslint-disable-next-line no-console
  console.error(`[${context}] Unexpected error:`, error);

  throw new InternalServerErrorException('Internal server error');
}
