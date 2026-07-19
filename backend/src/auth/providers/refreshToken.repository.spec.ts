import { NotFoundException } from '@nestjs/common';
import { RefreshTokenRepositoryOperations } from './refreshToken.repository';
import { User } from '../../users/entities/user.entity';

describe('RefreshTokenRepositoryOperations', () => {
  let repo: RefreshTokenRepositoryOperations;
  let refreshTokenRepo: any;

  beforeEach(() => {
    refreshTokenRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    repo = new RefreshTokenRepositoryOperations(refreshTokenRepo);
  });

  const mockUser = { id: 'user-1' } as User;

  const mockToken = {
    id: 'rt-1',
    userId: 'user-1',
    token: 'some-token',
    familyId: 'fam_123',
    version: 1,
    expiresAt: new Date(Date.now() + 86400000),
    revoked: false,
    consumedAt: null,
    user: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('createRefreshToken', () => {
    afterEach(() => {
      delete process.env.JWT_REFRESH_EXPIRATION;
    });

    it('creates and saves a refresh token', async () => {
      refreshTokenRepo.create.mockReturnValue(mockToken);
      refreshTokenRepo.save.mockResolvedValue(mockToken);

      process.env.JWT_REFRESH_EXPIRATION = '604800000';
      const result = await repo.createRefreshToken(
        mockUser,
        'some-token',
        'fam_123',
        1,
      );

      expect(refreshTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          token: 'some-token',
          familyId: 'fam_123',
          version: 1,
          revoked: false,
          consumedAt: null,
        }),
      );
      expect(result).toEqual(mockToken);
    });
  });

  describe('saveRefreshToken', () => {
    it('generates a family ID and creates a refresh token', async () => {
      refreshTokenRepo.create.mockReturnValue(mockToken);
      refreshTokenRepo.save.mockResolvedValue(mockToken);

      const result = await repo.saveRefreshToken(mockUser, 'some-token');

      expect(refreshTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          token: 'some-token',
          version: 1,
          revoked: false,
        }),
      );
      expect(result).toEqual(mockToken);
    });
  });

  describe('findByToken', () => {
    it('finds a token by its value', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(mockToken);

      const result = await repo.findByToken('some-token');

      expect(refreshTokenRepo.findOne).toHaveBeenCalledWith({
        where: { token: 'some-token' },
      });
      expect(result).toEqual(mockToken);
    });

    it('returns null when token not found', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      const result = await repo.findByToken('unknown');

      expect(result).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('marks a token as revoked', async () => {
      await repo.revokeToken('some-token');

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { token: 'some-token' },
        { revoked: true },
      );
    });
  });

  describe('findValidToken', () => {
    it('returns token when valid', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(mockToken);

      const result = await repo.findValidToken('some-token');

      expect(result).toEqual(mockToken);
    });

    it('returns null when token is revoked', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        ...mockToken,
        revoked: true,
      });

      const result = await repo.findValidToken('some-token');

      expect(result).toBeNull();
    });

    it('returns null when token is consumed', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        ...mockToken,
        consumedAt: new Date(),
      });

      const result = await repo.findValidToken('some-token');

      expect(result).toBeNull();
    });

    it('returns null when token is expired', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        ...mockToken,
        expiresAt: new Date(Date.now() - 86400000),
      });

      const result = await repo.findValidToken('some-token');

      expect(result).toBeNull();
    });

    it('returns null when token not found', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      const result = await repo.findValidToken('unknown');

      expect(result).toBeNull();
    });
  });

  describe('markTokenConsumed', () => {
    it('sets consumedAt on the token', async () => {
      await repo.markTokenConsumed(mockToken);

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { id: 'rt-1' },
        { consumedAt: expect.any(Date) },
      );
    });
  });

  describe('revokeFamily', () => {
    it('revokes all non-revoked tokens in a family', async () => {
      await repo.revokeFamily('fam_123');

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { familyId: 'fam_123', revoked: false },
        { revoked: true, consumedAt: expect.any(Date) },
      );
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('revokes all tokens for a user', async () => {
      await repo.revokeAllRefreshTokens('user-1');

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1' },
        { revoked: true },
      );
    });
  });
});
