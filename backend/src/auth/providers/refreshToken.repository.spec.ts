/// <reference types="jest" />
import { Repository } from 'typeorm';
import { RefreshTokenRepositoryOperations } from './refreshToken.repository';
import { RefreshToken } from '../entities/refreshToken.entity';
import { User } from '../../users/entities/user.entity';
import { hashRefreshToken } from '../helper/refresh-token-hash';

/**
 * Issue #237: refresh tokens must be hashed at rest. The repository is the
 * single boundary that converts a raw JWT to its stored hash, so every one of
 * these assertions pins that boundary — a regression that writes or queries a
 * raw token here is what re-opens the vulnerability.
 */
describe('RefreshTokenRepositoryOperations — hashing at rest', () => {
  let repo: jest.Mocked<
    Pick<Repository<RefreshToken>, 'create' | 'save' | 'findOne' | 'update'>
  >;
  let ops: RefreshTokenRepositoryOperations;

  // Representative refresh JWT (three dot-separated segments).
  const rawToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.c2lnbmF0dXJl';
  const hashed = hashRefreshToken(rawToken);
  const user = { id: 'user-123' } as User;

  beforeEach(() => {
    repo = {
      create: jest.fn((obj: Partial<RefreshToken>) => obj as RefreshToken),
      save: jest.fn(async (obj: RefreshToken) => obj),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as typeof repo;
    ops = new RefreshTokenRepositoryOperations(
      repo as unknown as Repository<RefreshToken>,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('createRefreshToken persists the hash, never the minted token', async () => {
    await ops.createRefreshToken(user, rawToken, 'fam_1', 1);

    const created = repo.create.mock.calls[0][0] as RefreshToken;
    expect(created.token).toBe(hashed);
    expect(created.token).not.toBe(rawToken);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ token: hashed }),
    );
  });

  it('saveRefreshToken hashes and opens a fresh family at version 1', async () => {
    await ops.saveRefreshToken(user, rawToken);

    const created = repo.create.mock.calls[0][0] as RefreshToken;
    expect(created.token).toBe(hashed);
    expect(created.token).not.toBe(rawToken);
    expect(created.version).toBe(1);
    expect(created.familyId).toMatch(/^fam_/);
  });

  it('findByToken looks up by the hash of the presented token', async () => {
    repo.findOne.mockResolvedValue(null);

    await ops.findByToken(rawToken);

    expect(repo.findOne).toHaveBeenCalledWith({ where: { token: hashed } });
    // The raw token must never appear in a query.
    const whereArg = repo.findOne.mock.calls[0][0] as {
      where: { token: string };
    };
    expect(whereArg.where.token).not.toBe(rawToken);
  });

  it('revokeToken targets the hashed value', async () => {
    await ops.revokeToken(rawToken);

    expect(repo.update).toHaveBeenCalledWith(
      { token: hashed },
      { revoked: true },
    );
  });

  it('markTokenConsumed keys off the row id and never touches the raw token', async () => {
    await ops.markTokenConsumed({ id: 'rt-9' } as RefreshToken);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'rt-9' },
      expect.objectContaining({ consumedAt: expect.any(Date) }),
    );
  });

  it('a token stored as a hash is still found by presenting the raw token (post-migration refresh works once)', async () => {
    // Simulates the hash-in-place migration outcome: the row holds sha256(raw),
    // and the client presents the original raw JWT on its next refresh.
    const storedRow = {
      id: 'rt-1',
      userId: user.id,
      token: hashed,
      familyId: 'fam_1',
      version: 1,
      revoked: false,
      consumedAt: null,
      expiresAt: undefined,
    } as unknown as RefreshToken;
    repo.findOne.mockImplementation(async (opts) => {
      const token = (opts as { where: { token: string } }).where.token;
      return token === hashed ? storedRow : null;
    });

    await expect(ops.findValidToken(rawToken)).resolves.toBe(storedRow);
  });

  it('findValidToken rejects revoked, consumed, and expired rows', async () => {
    const base = { id: 'rt', token: hashed, familyId: 'f', version: 1 };

    repo.findOne.mockResolvedValueOnce({
      ...base,
      revoked: true,
    } as RefreshToken);
    expect(await ops.findValidToken(rawToken)).toBeNull();

    repo.findOne.mockResolvedValueOnce({
      ...base,
      revoked: false,
      consumedAt: new Date(),
    } as RefreshToken);
    expect(await ops.findValidToken(rawToken)).toBeNull();

    repo.findOne.mockResolvedValueOnce({
      ...base,
      revoked: false,
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    } as unknown as RefreshToken);
    expect(await ops.findValidToken(rawToken)).toBeNull();
  });
});
