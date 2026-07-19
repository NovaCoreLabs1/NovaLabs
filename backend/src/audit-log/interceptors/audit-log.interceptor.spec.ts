import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogService } from '../providers/audit-log.service';
import { of } from 'rxjs';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let auditLogService: jest.Mocked<Partial<AuditLogService>>;

  beforeEach(() => {
    auditLogService = { create: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AuditLogInterceptor(auditLogService as any);
  });

  function createContext(method: string, overrides: any = {}) {
    const request = {
      method,
      originalUrl: overrides.url ?? '/api/users',
      url: overrides.url ?? '/api/users',
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('Chrome/120'),
      params: { id: 'target-1' },
      body: { email: 'test@example.com' },
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        role: 'admin',
      },
      ...overrides,
    };

    const response = { statusCode: 200 };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => ({ name: 'createUser' }),
      getClass: () => ({ name: 'UsersController' }),
    } as any;
  }

  it('skips logging for GET requests', (done) => {
    const context = createContext('GET');
    const next = { handle: () => of('data') };

    interceptor.intercept(context, next).subscribe({
      next: (result) => {
        expect(result).toBe('data');
        expect(auditLogService.create).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('logs audit entry on successful mutating request', (done) => {
    const context = createContext('POST');
    const next = { handle: () => of('created') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(auditLogService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            actorId: 'user-1',
            action: expect.stringContaining('create'),
            targetType: 'user',
            targetId: 'target-1',
          }),
        );
        done();
      },
    });
  });

  it('logs audit entry on error', (done) => {
    const context = createContext('DELETE');
    const { Subject } = require('rxjs');
    const subject = new Subject();
    const next = { handle: () => subject };

    interceptor.intercept(context, next).subscribe({
      error: (err: Error) => {
        expect(err.message).toBe('Delete failed');
        expect(auditLogService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.stringContaining('delete'),
            metadata: expect.objectContaining({
              error: 'Delete failed',
            }),
          }),
        );
        done();
      },
    });

    // Trigger error after microtask so async tap callback completes
    setTimeout(() => subject.error(new Error('Delete failed')), 10);
  });

  it('sanitizes sensitive fields from request body', (done) => {
    const context = createContext('PATCH', {
      body: {
        password: 'secret123',
        email: 'user@example.com',
        token: 'abc',
        nested: { password: 'nested-secret' },
      },
    });
    const next = { handle: () => of('updated') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(auditLogService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              password: '[REDACTED]',
              token: '[REDACTED]',
              email: 'user@example.com',
              nested: { password: '[REDACTED]' },
            }),
          }),
        );
        done();
      },
    });
  });

  it('extracts targetType from URL', (done) => {
    const context = createContext('POST', { url: '/api/workspaces/123/book' });
    const next = { handle: () => of('done') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(auditLogService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            targetType: 'workspace',
          }),
        );
        done();
      },
    });
  });

  it('handles missing user gracefully', (done) => {
    const context = createContext('POST', {
      user: undefined,
    });
    const next = { handle: () => of('created') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(auditLogService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            actorId: undefined,
            actorEmail: undefined,
            actorRole: undefined,
          }),
        );
        done();
      },
    });
  });
});
