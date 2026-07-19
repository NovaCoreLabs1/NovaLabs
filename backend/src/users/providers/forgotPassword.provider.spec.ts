import { Test, TestingModule } from '@nestjs/testing';
import { ForgotPasswordProvider } from './forgotPassword.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { ConfigService } from '@nestjs/config';

describe('ForgotPasswordProvider', () => {
  let provider: ForgotPasswordProvider;
  let usersRepository: any;
  let emailService: any;
  let configService: any;

  const mockUser = {
    id: 'user-1',
    email: 'alice@example.com',
    firstname: 'Alice',
    lastname: 'Smith',
    passwordResetToken: null,
    passwordResetExpiresIn: null,
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    emailService = {
      sendPasswordResetLinkEmail: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForgotPasswordProvider,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    provider = module.get<ForgotPasswordProvider>(ForgotPasswordProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('execute', () => {
    it('sends password reset email successfully', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        passwordResetToken: expect.any(String),
        passwordResetExpiresIn: expect.any(Date),
      });
      configService.get.mockReturnValue('300000'); // 5 minutes
      emailService.sendPasswordResetLinkEmail.mockResolvedValue(true);

      const result = await provider.execute('alice@example.com');

      expect(result).toEqual({
        message: 'Password reset instructions sent to email',
      });
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
      expect(usersRepository.save).toHaveBeenCalled();
      expect(emailService.sendPasswordResetLinkEmail).toHaveBeenCalled();
    });

    it('throws NotFoundException when email is not registered', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.execute('unknown@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses custom frontend reset URL from config', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue(mockUser);
      configService.get
        .mockReturnValueOnce('600000') // PASSWORD_RESET_EXPIRATION_MS
        .mockReturnValueOnce(
          'https://custom-app.com/reset-password?token=',
        ); // FRONTEND_PASSWORD_RESET_URL
      emailService.sendPasswordResetLinkEmail.mockResolvedValue(true);

      await provider.execute('alice@example.com');

      const resetLink = emailService.sendPasswordResetLinkEmail.mock.calls[0][2];
      expect(resetLink).toContain('https://custom-app.com/reset-password?token=');
    });

    it('throws BadRequestException when email sending fails', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue(mockUser);
      configService.get.mockReturnValue('300000');
      emailService.sendPasswordResetLinkEmail.mockResolvedValue(false);

      await expect(
        provider.execute('alice@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      usersRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        provider.execute('alice@example.com'),
      ).rejects.toThrow(
        'Failed to initiate password reset: Internal server error',
      );
    });
  });
});
