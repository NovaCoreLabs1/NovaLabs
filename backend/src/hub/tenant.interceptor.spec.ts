import { ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { TenantInterceptor } from './tenant.interceptor';
import { tenantContext } from './tenant.context';

describe('TenantInterceptor resolution branches (issue #225)', () => {
  let interceptor: TenantInterceptor;
  let auditLogService: { create: jest.Mock };
  const DEFAULT_HUB = '00000000-0000-0000-0000-0000000000d1';

  /**
   * Drives the interceptor and reports the tenant value as seen from inside
   * the request pipeline (`handle()` executes within the AsyncLocalStorage
   * scope, so this is the value downstream services would observe).
   */
  const resolveTenant = (
    request: Record<string, any>,
  ): { req: Record<string, any>; hubInContext: string | undefined } => {
    let hubInContext: string | undefined;
    const context: any = {
      switchToHttp: () => ({ getRequest: () => request }),
    };
    interceptor
      .intercept(context, {
        handle: () => {
          hubInContext = tenantContext.getHubId();
          return of('ok');
        },
      })
      .subscribe(() => undefined);
    return { req: request, hubInContext };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogService = { create: jest.fn().mockResolvedValue(undefined) };
    interceptor = new TenantInterceptor(
      { defaultHubId: DEFAULT_HUB } as any,
      auditLogService as any,
    );
  });

  it('uses the JWT hubId claim for an authenticated user', () => {
    const req: any = {
      user: {
        id: 'u1',
        email: 'a@b.c',
        role: 'user',
        hubId: '00000000-0000-0000-0000-00000000beef',
      },
      headers: {},
    };

    const { hubInContext } = resolveTenant(req);

    expect(req.hubId).toBe('00000000-0000-0000-0000-00000000beef');
    expect(hubInContext).toBe('00000000-0000-0000-0000-00000000beef');
  });

  it('lets an ADMIN switch hubs via x-hub-id and audits the switch', async () => {
    const req: any = {
      user: {
        id: 'admin1',
        email: 'admin@x.y',
        role: 'admin',
        hubId: '00000000-0000-0000-0000-00000000beef',
      },
      headers: { 'x-hub-id': '00000000-0000-0000-0000-000000000abc' },
      ip: '10.0.0.1',
      get: () => 'jest-agent',
    };

    const { hubInContext } = resolveTenant(req);

    expect(req.hubId).toBe('00000000-0000-0000-0000-000000000abc');
    expect(hubInContext).toBe('00000000-0000-0000-0000-000000000abc');

    // The audit write is fire-and-forget; flush microtasks before asserting.
    await Promise.resolve();
    await Promise.resolve();
    expect(auditLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin1',
        action: 'hub.switch',
        targetType: 'hub',
        targetId: '00000000-0000-0000-0000-000000000abc',
      }),
    );
  });

  it('403s a non-admin whose JWT carries a different x-hub-id', () => {
    const req: any = {
      user: {
        id: 'u1',
        role: 'user',
        hubId: '00000000-0000-0000-0000-00000000beef',
      },
      headers: { 'x-hub-id': '00000000-0000-0000-0000-000000000abc' },
    };

    expect(() => resolveTenant(req)).toThrow(ForbiddenException);
  });

  it('403s a non-admin with NO JWT claim who sends x-hub-id (the previously always-taken branch)', () => {
    // Regression for the pre-#225 hole: userHubId was always undefined, so
    // this exact request silently resolved the header as tenant.
    const req: any = {
      user: { id: 'u1', role: 'user', hubId: undefined },
      headers: { 'x-hub-id': '00000000-0000-0000-0000-000000000abc' },
    };

    expect(() => resolveTenant(req)).toThrow(ForbiddenException);
  });

  it('403s unauthenticated traffic that sends x-hub-id', () => {
    const req: any = {
      user: undefined,
      headers: { 'x-hub-id': '00000000-0000-0000-0000-000000000abc' },
    };

    expect(() => resolveTenant(req)).toThrow(ForbiddenException);
    expect(req.hubId).toBeUndefined();
  });

  it('resolves the default hub UUID when no claim and no header exist', () => {
    const req: any = { user: undefined, headers: {} };

    const { hubInContext } = resolveTenant(req);

    expect(req.hubId).toBe(DEFAULT_HUB);
    expect(hubInContext).toBe(DEFAULT_HUB);
  });

  it('treats a header restating the caller hub as a no-op, not a switch', async () => {
    const req: any = {
      user: {
        id: 'u1',
        role: 'user',
        hubId: '00000000-0000-0000-0000-00000000beef',
      },
      headers: { 'x-hub-id': '00000000-0000-0000-0000-00000000beef' },
    };

    const { hubInContext } = resolveTenant(req);

    expect(req.hubId).toBe('00000000-0000-0000-0000-00000000beef');
    await Promise.resolve();
    await Promise.resolve();
    expect(auditLogService.create).not.toHaveBeenCalled();
    void hubInContext;
  });
});
