import { SetMetadata } from '@nestjs/common';
import { ApiKeyScope } from '../entities/api-key.entity';

export const SCOPES_KEY = 'required_scopes';

/**
 * Attach required scopes to a route handler or controller.
 *
 * @example
 * @RequiredScopes('write:invoices')
 * @Post('generate')
 * generateInvoice() { ... }
 */
export const RequiredScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata(SCOPES_KEY, scopes);