import { Test, TestingModule } from '@nestjs/testing';
import { ValidateUserProvider } from './validateUser.provider';
import { FindOneUserByEmailProvider } from './findOneUserByEmail.provider';
import { HashingProvider } from '../../auth/providers/hashing.provider';
import { UnauthorizedException } from '@nestjs/common';

describe('ValidateUserProvider', () => {
  let provider: ValidateUserProvider;
  let findOneUserByEmail: any;
  let hashingProvider: any;

  const mockUser = {
    id: 'user-1',
    email: 'alice@example.com',
    password: 'hashed-password',
    passwordResetExpiresIn: null,
    passwordResetToken: null,
    refreshTokens: [],
    firstname: 'Alice',
    lastname: 'Smith',
    role: 'user',
  };

  beforeEach(async () => {
    findOneUserByEmail = { getUser: jest.fn() };
    hashingProvider = { compare: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateUserProvider,
        { provide: FindOneUserByEmailProvider, useValue: findOneUserByEmail },
        { provide: HashingProvider, useValue: hashingProvider },
      ],
    }).compile();

    provider = module.get<ValidateUserProvider>(ValidateUserProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('validateUser', () => {
    it('returns user without sensitive fields when credentials are valid', async () => {
      findOneUserByEmail.getUser.mockResolvedValue(mockUser);
      hashingProvider.compare.mockResolvedValue(true);

      const result = await provider.validateUser(
        'alice@example.com',
        'correct-password',
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('alice@example.com');
      expect((result as any).password).toBeUndefined();
      expect((result as any).passwordResetToken).toBeUndefined();
      expect((result as any).refreshTokens).toBeUndefined();
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      findOneUserByEmail.getUser.mockResolvedValue(mockUser);
      hashingProvider.compare.mockResolvedValue(false);

      await expect(
        provider.validateUser('alice@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when findOneUserByEmail throws', async () => {
      findOneUserByEmail.getUser.mockRejectedValue(
        new UnauthorizedException('Credentials are not valid'),
      );

      await expect(
        provider.validateUser('unknown@example.com', 'any-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws InternalServerErrorException when hashing fails', async () => {
      findOneUserByEmail.getUser.mockResolvedValue(mockUser);
      hashingProvider.compare.mockRejectedValue(new Error('Hash error'));

      await expect(
        provider.validateUser('alice@example.com', 'password'),
      ).rejects.toThrow('Error validating user: Internal server error');
    });
  });
});
