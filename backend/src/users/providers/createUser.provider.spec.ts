import { Test, TestingModule } from '@nestjs/testing';
import { CreateUserProvider } from './createUser.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';

import { ConflictException } from '@nestjs/common';
import { HashingProvider } from '../../auth/providers/hashing.provider';
import { ConfigService } from '@nestjs/config';
import { GenerateTokensProvider } from '../../auth/providers/generateTokens.provider';
import { RefreshTokenRepositoryOperations } from '../../auth/providers/refreshToken.repository';
import { EmailService } from '../../email/email.service';
import { UserRole } from '../enums/userRoles.enum';

describe('CreateUserProvider', () => {
  let provider: CreateUserProvider;
  let userRepository: any;
  let hashingProvider: any;
  let configService: any;
  let generateTokensProvider: any;
  let refreshTokenRepositoryOperations: any;
  let emailService: any;

  const mockResponse: any = {
    cookie: jest.fn(),
  };

  const createUserDto = {
    firstname: 'Alice',
    lastname: 'Smith',
    email: 'alice@example.com',
    password: 'SecurePass123!',
  };

  const mockUser = {
    id: 'user-1',
    ...createUserDto,
    password: 'hashed-password',
    role: UserRole.USER,
    isVerified: false,
    verificationToken: 'some-verification-token',
    verificationTokenExpiry: new Date('2025-01-01'),
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    hashingProvider = {
      hash: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };
    generateTokensProvider = {
      generateBothTokens: jest.fn(),
    };
    refreshTokenRepositoryOperations = {
      saveRefreshToken: jest.fn(),
    };
    emailService = {
      sendVerificationLinkEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUserProvider,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: HashingProvider, useValue: hashingProvider },
        { provide: ConfigService, useValue: configService },
        { provide: GenerateTokensProvider, useValue: generateTokensProvider },
        {
          provide: RefreshTokenRepositoryOperations,
          useValue: refreshTokenRepositoryOperations,
        },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    provider = module.get<CreateUserProvider>(CreateUserProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('createUser', () => {
    it('creates user successfully and returns tokens', async () => {
      userRepository.findOne.mockResolvedValue(null); // no existing user
      hashingProvider.hash.mockResolvedValue('hashed-password');
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      generateTokensProvider.generateBothTokens.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      });
      refreshTokenRepositoryOperations.saveRefreshToken.mockResolvedValue(
        undefined,
      );
      configService.get.mockReturnValue('604800000'); // 7 days in ms
      emailService.sendVerificationLinkEmail.mockResolvedValue(true);

      const result = await provider.createUser(
        createUserDto as any,
        mockResponse,
      );

      expect(result).toEqual({
        user: mockUser,
        accessToken: 'access-token-123',
      });
      expect(hashingProvider.hash).toHaveBeenCalledWith('SecurePass123!');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createUserDto,
          password: 'hashed-password',
          role: UserRole.USER,
          isVerified: false,
          verificationToken: expect.any(String),
          verificationTokenExpiry: expect.any(Date),
        }),
      );
      expect(mockResponse.cookie).toHaveBeenCalled();
      expect(emailService.sendVerificationLinkEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.any(String),
        'Alice Smith',
      );
    });

    it('throws ConflictException when user already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        provider.createUser(createUserDto as any, mockResponse),
      ).rejects.toThrow(ConflictException);
    });

    it('handles email sending failure gracefully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      hashingProvider.hash.mockResolvedValue('hashed-password');
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      generateTokensProvider.generateBothTokens.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      });
      refreshTokenRepositoryOperations.saveRefreshToken.mockResolvedValue(
        undefined,
      );
      configService.get.mockReturnValue('604800000');
      emailService.sendVerificationLinkEmail.mockResolvedValue(false);

      const result = await provider.createUser(
        createUserDto as any,
        mockResponse,
      );

      // User should still be created successfully even if email fails
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
    });

    it('throws InternalServerErrorException when repository fails', async () => {
      userRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        provider.createUser(createUserDto as any, mockResponse),
      ).rejects.toThrow('Failed to create user: Internal server error');
    });
  });
});
