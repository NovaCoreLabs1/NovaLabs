import { CsrfGuard } from './csrf.guard';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC } from '../../auth/decorators/public.decorator';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let reflector: jest.Mocked<Reflector>;

  function createContext(
    method: string,
    cookies: Record<string, string> | undefined,
    headers: Record<string, string>,
    isPublic = false,
  ): any {
    const request = {
      method,
      cookies,
      headers,
    };

    reflector.getAllAndOverride.mockReturnValue(isPublic);

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    guard = new CsrfGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('allows public routes without CSRF check', () => {
      const context = createContext('POST', undefined, {}, true);
      expect(guard.canActivate(context)).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('allows GET requests without CSRF check', () => {
      const context = createContext('GET', undefined, {});
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows OPTIONS requests without CSRF check', () => {
      const context = createContext('OPTIONS', undefined, {});
      expect(guard.canActivate(context)).toBe(true);
    });

    it('throws ForbiddenException when CSRF cookie is missing on POST', () => {
      const context = createContext('POST', undefined, { 'x-csrf-token': 'token123' });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when CSRF header is missing on POST', () => {
      const context = createContext('POST', { csrf: 'token123' }, {});
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when CSRF tokens mismatch', () => {
      const context = createContext('POST', { csrf: 'cookie-token' }, { 'x-csrf-token': 'header-token' });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('allows state-changing method when CSRF tokens match', () => {
      const context = createContext('POST', { csrf: 'matching-token' }, { 'x-csrf-token': 'matching-token' });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows PUT with matching CSRF tokens', () => {
      const context = createContext('PUT', { csrf: 'token' }, { 'x-csrf-token': 'token' });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows PATCH with matching CSRF tokens', () => {
      const context = createContext('PATCH', { csrf: 'token' }, { 'x-csrf-token': 'token' });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows DELETE with matching CSRF tokens', () => {
      const context = createContext('DELETE', { csrf: 'token' }, { 'x-csrf-token': 'token' });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('throws ForbiddenException with proper error message', () => {
      const context = createContext('POST', { csrf: 'a' }, { 'x-csrf-token': 'b' });
      expect(() => guard.canActivate(context)).toThrow('Invalid CSRF token');
    });
  });
});
