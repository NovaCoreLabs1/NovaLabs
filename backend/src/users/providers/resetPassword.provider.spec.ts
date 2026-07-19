import { Test, TestingModule } from '@nestjs/testing';
import { ResetPasswordProvider } from './resetPassword.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { HashingProvider } from '../../auth/providers/hashing.provider';
import { RefreshTokenRepositoryOperations } from '../../auth/providers/refreshToken.repository';
import { EmailService } from '../../email/email.service';
import { createHash } from 'crypto';

describe('ResetPasswordProvider', () => {
  let provider: ResetPasswordProvider;
  let usersRepository: any;
  let hashingProvider: any;
  let refreshTokenRepositoryOperations: any;
  let emailService: any;

  const rawToken = 'valid-raw-token-123';
  const hashedToken = createHash('sha256').update(rawToken).digest('hex');
  const newPassword = 'NewSecurePass123!';

  const mockUser = {
    id: 'user-1',
    email: 'alice@example.com',
    firstname: 'Alice',
    lastname: 'Smith',
    password: 'old-hashed-password',
    passwordResetToken: hashedToken,
    passwordResetExpiresIn: new Date(Date.now() + 300000), // 5 minutes in future
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    hashingProvider = {
      hash: jest.fn(),
    };
    refreshTokenRepositoryOperations = {
      revokeAllRefreshTokens: jest.fn(),
    };
    emailService = {
      sendPasswordResetSuccessEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: HashingProvider, useValue: hashingProvider },
        {
          provide: RefreshTokenRepositoryOperations,
          useValue: refreshTokenRepositoryOperations,
        },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    provider = module.get<ResetPasswordProvider>(ResetPasswordProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('execute', () => {
    it('resets password successfully', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);
      hashingProvider.hash.mockResolvedValue('new-hashed-password');
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        password: 'new-hashed-password',
        passwordResetToken: null,
        passwordResetExpiresIn: null,
      });
      refreshTokenRepositoryOperations.revokeAllRefreshTokens.mockResolvedValue(
        undefined,
      );
      emailService.sendPasswordResetSuccessEmail.mockResolvedValue(true);

      const result = await provider.execute(rawToken, newPassword);

      expect(result).toEqual({ message: 'Password reset successful' });
      expect(hashingProvider.hash).toHaveBeenCalledWith(newPassword);
      expect(
        refreshTokenRepositoryOperations.revokeAllRefreshTokens,
      ).toHaveBeenCalledWith('user-1');
      expect(emailService.sendPasswordResetSuccessEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'Alice Smith',
      );
    });

    it('throws UnauthorizedException when token is invalid', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.execute('invalid-token', newPassword),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when token has expired', async () => {
      const expiredUser = {
        ...mockUser,
        passwordResetExpiresIn: new Date(Date.now() - 3600000), // 1 hour ago
      };
      usersRepository.findOne.mockResolvedValue(expiredUser);

      await expect(provider.execute(rawToken, newPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when success email fails to send', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);
      hashingProvider.hash.mockResolvedValue('new-hashed-password');
      usersRepository.save.mockResolvedValue(mockUser);
      refreshTokenRepositoryOperations.revokeAllRefreshTokens.mockResolvedValue(
        undefined,
      );
      emailService.sendPasswordResetSuccessEmail.mockResolvedValue(false);

      await expect(provider.execute(rawToken, newPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(provider.execute(rawToken, newPassword)).rejects.toThrow(
        'Failed to reset password: Internal server error',
      );
    });
  });
});
