import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PUBLIC } from '../../auth/decorators/public.decorator';

const CSRF_COOKIE_NAME = 'csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    if (STATE_CHANGING_METHODS.has(method)) {
      const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
      const headerToken = request.headers[CSRF_HEADER_NAME];

      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    }

    return true;
  }
}
