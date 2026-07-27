import { Request, Response, NextFunction } from 'express';
import { Injectable, NestMiddleware } from '@nestjs/common';

/**
 * ContentTypeMiddleware — Issue #111
 *
 * Enforces strict `Content-Type: application/json` validation on all
 * state-changing requests (POST / PUT / PATCH) that carry a body.
 * Requests that omit or mismatch the content-type header receive a
 * 415 Unsupported Media Type response before reaching any controller.
 *
 * Requests with no body (GET, DELETE, HEAD, OPTIONS) and multipart
 * uploads are passed through unchanged.
 */
@Injectable()
export class ContentTypeMiddleware implements NestMiddleware {
  private static readonly MUTATING_METHODS = new Set([
    'POST',
    'PUT',
    'PATCH',
  ]);

  /** Methods / paths that are intentionally non-JSON (file uploads, etc.) */
  private isExempt(req: Request): boolean {
    const ct = req.headers['content-type'] ?? '';
    // Allow multipart/form-data (file uploads) and urlencoded forms
    if (ct.startsWith('multipart/form-data') || ct.startsWith('application/x-www-form-urlencoded')) {
      return true;
    }
    // No body sent — nothing to validate
    if (!req.headers['content-length'] && !req.headers['transfer-encoding']) {
      return true;
    }
    return false;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!ContentTypeMiddleware.MUTATING_METHODS.has(req.method)) {
      return next();
    }

    if (this.isExempt(req)) {
      return next();
    }

    const contentType = req.headers['content-type'] ?? '';

    if (!contentType.toLowerCase().startsWith('application/json')) {
      res.status(415).json({
        statusCode: 415,
        error: 'Unsupported Media Type',
        message:
          'Content-Type must be application/json for this endpoint.',
      });
      return;
    }

    next();
  }
}
