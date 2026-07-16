import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyEntity, ApiKeyScope } from '../entities/api-key.entity';
import { ApiKeyAuditLogEntity } from '../entities/api-key-audit.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RAW_KEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const PREFIX = RAW_KEY.substring(0, 8); // 'abcdef12'

async function makeHash(raw: string) {
  return bcrypt.hash(raw, 12);
}

function makeContext(headers: Record<string, string> = {}, method = 'POST', path = '/webhooks/test'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        method,
        path,
        ip: '127.0.0.1',
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeyRepo: { findOne: jest.Mock };
  let auditRepo: { save: jest.Mock; create: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    apiKeyRepo = { findOne: jest.fn() };
    auditRepo = {
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((data) => data),
    };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: Reflector, useValue: reflector },
        { provide: getRepositoryToken(ApiKeyEntity), useValue: apiKeyRepo },
        { provide: getRepositoryToken(ApiKeyAuditLogEntity), useValue: auditRepo },
      ],
    }).compile();

    guard = module.get(ApiKeyGuard);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Missing header ────────────────────────────────────────────────────────

  it('throws UnauthorizedException when X-API-Key header is missing', async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ─── Unknown prefix ────────────────────────────────────────────────────────

  it('throws UnauthorizedException when prefix is not found in DB', async () => {
    apiKeyRepo.findOne.mockResolvedValue(null);
    const ctx = makeContext({ 'x-api-key': RAW_KEY });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ─── Wrong key (bad hash) ─────────────────────────────────────────────────

  it('throws UnauthorizedException when key does not match hash', async () => {
    const hash = await makeHash('different-key-entirely');
    apiKeyRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      prefix: PREFIX,
      hash,
      scopes: [ApiKeyScope.READ_PAYMENTS],
      revoked: false,
      expiresAt: null,
      isExpired: false,
      isActive: true,
    } as ApiKeyEntity);

    const ctx = makeContext({ 'x-api-key': RAW_KEY });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ─── Revoked key ──────────────────────────────────────────────────────────

  it('throws UnauthorizedException when key is revoked', async () => {
    const hash = await makeHash(RAW_KEY);
    apiKeyRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      prefix: PREFIX,
      hash,
      scopes: [ApiKeyScope.READ_PAYMENTS],
      revoked: true,
      expiresAt: null,
      isExpired: false,
      isActive: false,
    } as ApiKeyEntity);

    const ctx = makeContext({ 'x-api-key': RAW_KEY });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ─── Expired key ──────────────────────────────────────────────────────────

  it('throws UnauthorizedException when key is expired', async () => {
    const hash = await makeHash(RAW_KEY);
    const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    apiKeyRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      prefix: PREFIX,
      hash,
      scopes: [ApiKeyScope.READ_PAYMENTS],
      revoked: false,
      expiresAt: pastDate,
      isExpired: true,
      isActive: false,
    } as ApiKeyEntity);

    const ctx = makeContext({ 'x-api-key': RAW_KEY });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ─── Insufficient scopes ──────────────────────────────────────────────────

  it('throws ForbiddenException when key lacks required scopes', async () => {
    const hash = await makeHash(RAW_KEY);
    apiKeyRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      prefix: PREFIX,
      hash,
      scopes: [ApiKeyScope.READ_PAYMENTS], // only read:payments
      revoked: false,
      expiresAt: null,
      isExpired: false,
      isActive: true,
    } as ApiKeyEntity);

    // Handler requires write:invoices
    reflector.getAllAndOverride.mockReturnValue([ApiKeyScope.WRITE_INVOICES]);

    const ctx = makeContext({ 'x-api-key': RAW_KEY });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ─── Valid key, no scope requirement ──────────────────────────────────────

  it('returns true for a valid, active key with no required scopes', async () => {
    const hash = await makeHash(RAW_KEY);
    apiKeyRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      prefix: PREFIX,
      hash,
      scopes: [ApiKeyScope.READ_PAYMENTS],
      revoked: false,
      expiresAt: null,
      isExpired: false,
      isActive: true,
    } as ApiKeyEntity);

    reflector.getAllAndOverride.mockReturnValue(null);

    const ctx = makeContext({ 'x-api-key': RAW_KEY });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // ─── Valid key, matching scopes ───────────────────────────────────────────

  it('returns true when key has all required scopes', async () => {
    const hash = await makeHash(RAW_KEY);
    apiKeyRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      prefix: PREFIX,
      hash,
      scopes: [ApiKeyScope.READ_PAYMENTS, ApiKeyScope.WRITE_INVOICES],
      revoked: false,
      expiresAt: null,
      isExpired: false,
      isActive: true,
    } as ApiKeyEntity);

    reflector.getAllAndOverride.mockReturnValue([ApiKeyScope.WRITE_INVOICES]);

    const ctx = makeContext({ 'x-api-key': RAW_KEY });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // ─── Audit log ────────────────────────────────────────────────────────────

  it('writes an audit log entry on successful authentication', async () => {
    const hash = await makeHash(RAW_KEY);
    apiKeyRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      prefix: PREFIX,
      hash,
      scopes: [ApiKeyScope.READ_PAYMENTS],
      revoked: false,
      expiresAt: null,
      isExpired: false,
      isActive: true,
    } as ApiKeyEntity);

    reflector.getAllAndOverride.mockReturnValue(null);

    const ctx = makeContext({ 'x-api-key': RAW_KEY }, 'POST', '/webhooks/payment');
    await guard.canActivate(ctx);

    // Allow the fire-and-forget audit write to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(auditRepo.save).toHaveBeenCalledTimes(1);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        keyId: 'uuid-1',
        endpoint: 'POST /webhooks/payment',
      }),
    );
  });
});