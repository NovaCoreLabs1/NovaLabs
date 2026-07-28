import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Canonical API error response shape (RFC 7807-inspired).
 *
 * Every error emitted by the NovaLabs API is wrapped in this DTO so that
 * frontend clients and API consumers can rely on a single, predictable shape.
 *
 * Shape:
 * ```json
 * {
 *   "code":      "VALIDATION_ERROR",
 *   "status":    400,
 *   "message":   "Request validation failed",
 *   "details":   [...],
 *   "requestId": "req_abc123",
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 * ```
 */
export class ApiErrorDto {
  /** Machine-readable error code (e.g. VALIDATION_ERROR, NOT_FOUND). */
  @ApiProperty({
    example: 'VALIDATION_ERROR',
    description: 'Machine-readable error code',
  })
  code: string;

  /** HTTP status code mirrored in the body for convenience. */
  @ApiProperty({ example: 400, description: 'HTTP status code' })
  status: number;

  /** Human-readable summary of what went wrong. */
  @ApiProperty({
    example: 'Request validation failed',
    description: 'Human-readable error summary',
  })
  message: string;

  /**
   * Optional structured details (e.g. validation messages per field).
   * Omitted for 5xx errors to avoid leaking internals.
   */
  @ApiPropertyOptional({
    description: 'Structured error details (validation messages, etc.)',
  })
  details?: unknown;

  /**
   * Unique request identifier for correlating with server-side logs.
   * Populated from the `x-request-id` header when present, otherwise
   * generated as a short random string.
   */
  @ApiProperty({
    example: 'req_7f3a2b1c',
    description: 'Unique request identifier for log correlation',
  })
  requestId: string;

  /** ISO-8601 timestamp of when the error occurred. */
  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'ISO-8601 timestamp of the error',
  })
  timestamp: string;
}
