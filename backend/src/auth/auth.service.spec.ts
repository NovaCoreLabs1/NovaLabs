import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import {
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { UserHelper } from './helper/user-helper';
import { JwtHelper } from './helper/jwt-helper';
import { EmailService } from '../email/email.service';
import { SetupTotpProvider } from './providers/setup-totp.provider';
import { VerifyTotpProvider } from './providers/verify-totp.provider';
import { ManageTotpProvider } from './providers/manage-totp.provider';
import { RefreshTokenRepositoryOperations } from './providers/refreshToken.repository';
import { AuditLogService } from '../audit-log/providers/audit-log.service';
import { UserRole } from '../users/enums/userRoles.enum';
import { MembershipStatus } from '../users/enums/membership-status.enum';
import * as moment from 'moment';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'mock-secret'),
  generateURI: jest.fn(() => 'otpauth://...'),
  verifySync: jest.fn(() => ({ valid: true })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Partial<Repository<User>>>;
  let userHelper: jest.Mocked<Partial<UserHelper>>;
  let jwtHelper: jest.Mocked<Partial<JwtHelper>>;
  let emailService: jest.Mocked<Partial<EmailService>>;
  let refreshTokenRepoOps: jest.Mocked<Partial<RefreshTokenRepositoryOperations>>;
  let auditLogService: jest.Mocked<Partial<AuditLogService>>;
  let setupTotpProvider: jest.Mocked<Partial<SetupTotpProvider>>;
  let verifyTotpProvider: jest.Mocked<Partial<VerifyTotpProvider>>;
  let manageTotpProvider: jest.Mocked<Partial<ManageTotpProvider>>;

  function makeUser(overrides: Partial<User> = {}): User {
    return {
      id: 'user-1',
      email: 'test@example.com',
      firstname: 'John',
      lastname: 'Doe',
      password: 'hashed-password',
      role: UserRole.USER,
      isVerified: false,
      isActive: true,
      isSuspended: false,
      isDeleted: false,
      twoFactorEnabled: false,
      totpSecret: null,
      totpBackupCodes: null,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      passwordResetCode: null,
      passwordResetCodeExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      profilePicture: null,
      phone: null,
      username: null,
      memberSince: null,
      profileCompleteness: 0,
      membershipStatus: MembershipStatus.INACTIVE,
      fullName: 'John Doe',
      refreshTokens: [],
      passwordResetToken: null,
      passwordResetExpiresIn: null,
      lastPasswordResetSentAt: null,
      verificationToken: null,
      verificationTokenExpiry: null,
      lastVerificationEmailSent: null,
      ...overrides,
    } as User;
  }

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    userHelper = {
      isValidPassword: jest.fn(),
      hashPassword: jest.fn(),
      generateVerificationCode: jest.fn(),
      formatUserResponse: jest.fn(),
      verifyPassword: jest.fn(),
    };

    jwtHelper = {
      generateAccessToken: jest.fn(),
      generateTokens: jest.fn(),
      generateTempToken: jest.fn(),
      validateRefreshToken: jest.fn(),
    };

    emailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
      sendRefreshTokenFamilyRevokedEmail: jest.fn().mockResolvedValue(true),
    };

    refreshTokenRepoOps = {
      saveRefreshToken: jest.fn(),
      findByToken: jest.fn(),
      markTokenConsumed: jest.fn(),
      revokeFamily: jest.fn(),
      createRefreshToken: jest.fn(),
    };

    auditLogService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    setupTotpProvider = {
      initiate2faSetup: jest.fn(),
      confirm2faSetup: jest.fn(),
    };

    verifyTotpProvider = {
      verifyTotpLogin: jest.fn(),
      verifyBackupCode: jest.fn(),
    };

    manageTotpProvider = {
      disable2fa: jest.fn(),
      get2faStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: UserHelper, useValue: userHelper },
        { provide: JwtHelper, useValue: jwtHelper },
        { provide: EmailService, useValue: emailService },
        { provide: SetupTotpProvider, useValue: setupTotpProvider },
        { provide: VerifyTotpProvider, useValue: verifyTotpProvider },
        { provide: ManageTotpProvider, useValue: manageTotpProvider },
        {
          provide: RefreshTokenRepositoryOperations,
          useValue: refreshTokenRepoOps,
        },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─────────────────────────────────────────────
  // createUser
  // ─────────────────────────────────────────────
  describe('createUser', () => {
    const dto = {
      email: 'new@example.com',
      password: 'ValidPass1',
      firstname: 'Jane',
      lastname: 'Doe',
    };

    it('creates a user and returns tokens', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userHelper.isValidPassword.mockReturnValue(true);
      userHelper.hashPassword.mockResolvedValue('hashed-pass');
      userHelper.generateVerificationCode.mockReturnValue('1234');
      userHelper.formatUserResponse.mockReturnValue({ id: 'new-id' } as any);
      userRepository.create.mockReturnValue(makeUser({ id: 'new-id' }));
      userRepository.save.mockResolvedValue(makeUser({ id: 'new-id' }));
      jwtHelper.generateAccessToken.mockReturnValue('access-token');

      const result = await service.createUser(dto);

      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result.user).toEqual({ id: 'new-id' });
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('throws ConflictException when email already exists', async () => {
      userRepository.findOne.mockResolvedValue(makeUser());
      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when password is invalid', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userHelper.isValidPassword.mockReturnValue(false);
      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // createAdminUser
  // ─────────────────────────────────────────────
  describe('createAdminUser', () => {
    const dto = {
      email: 'admin@example.com',
      password: 'AdminPass1',
      firstname: 'Admin',
      lastname: 'User',
    };

    it('creates an admin user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userHelper.isValidPassword.mockReturnValue(true);
      userHelper.hashPassword.mockResolvedValue('hashed');
      userHelper.formatUserResponse.mockReturnValue({ role: UserRole.ADMIN } as any);
      userRepository.create.mockReturnValue(makeUser({ role: UserRole.ADMIN }));
      userRepository.save.mockResolvedValue(makeUser({ role: UserRole.ADMIN }));
      jwtHelper.generateAccessToken.mockReturnValue('admin-token');

      const result = await service.createAdminUser(dto);
      expect(result.accessToken).toBe('admin-token');
    });

    it('throws ConflictException on duplicate email', async () => {
      userRepository.findOne.mockResolvedValue(makeUser());
      await expect(service.createAdminUser(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // verifyOtp
  // ─────────────────────────────────────────────
  describe('verifyOtp', () => {
    const dto = { email: 'test@example.com', otp: '1234' };

    it('verifies OTP and returns tokens', async () => {
      const user = makeUser({
        verificationCode: '1234',
        verificationCodeExpiresAt: moment().add(1, 'hour').toDate(),
      });
      userRepository.findOne.mockResolvedValue(user);
      userHelper.formatUserResponse.mockReturnValue({ id: user.id } as any);
      jwtHelper.generateTokens.mockReturnValue({
        accessToken: 'at',
        refreshToken: 'rt',
      });
      refreshTokenRepoOps.saveRefreshToken.mockResolvedValue(undefined);

      const result = await service.verifyOtp(dto);
      expect(result.message).toContain('verified');
      expect(result.tokens).toBeDefined();
    });

    it('throws BadRequestException when email missing', async () => {
      await expect(
        service.verifyOtp({ email: '', otp: '1234' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when OTP missing', async () => {
      await expect(
        service.verifyOtp({ email: 'a@b.com', otp: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.verifyOtp(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when OTP mismatches', async () => {
      userRepository.findOne.mockResolvedValue(
        makeUser({
          verificationCode: 'wrong',
          verificationCodeExpiresAt: moment().add(1, 'hour').toDate(),
        }),
      );
      await expect(service.verifyOtp(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when OTP expired', async () => {
      userRepository.findOne.mockResolvedValue(
        makeUser({
          verificationCode: '1234',
          verificationCodeExpiresAt: moment().subtract(1, 'hour').toDate(),
        }),
      );
      await expect(service.verifyOtp(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // login
  // ─────────────────────────────────────────────
  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'ValidPass1' };

    it('returns tokens on successful login', async () => {
      userRepository.findOne.mockResolvedValue(makeUser({ isVerified: true }));
      userHelper.verifyPassword.mockResolvedValue(true);
      jwtHelper.generateTokens.mockReturnValue({
        accessToken: 'at',
        refreshToken: 'rt',
      });

      const result = await service.login(dto);
      expect(result).toHaveProperty('accessToken');
    });

    it('throws on wrong credentials', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns unverified message for unverified user', async () => {
      userRepository.findOne.mockResolvedValue(makeUser());
      userHelper.verifyPassword.mockResolvedValue(true);
      userHelper.generateVerificationCode.mockReturnValue('1234');

      const result = await service.login(dto);
      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('accessToken');
    });

    it('returns requiresTwoFactor when 2FA enabled', async () => {
      userRepository.findOne.mockResolvedValue(
        makeUser({ isVerified: true, twoFactorEnabled: true }),
      );
      userHelper.verifyPassword.mockResolvedValue(true);
      jwtHelper.generateTempToken.mockReturnValue('temp-token');

      const result = await service.login(dto);
      expect(result.requiresTwoFactor).toBe(true);
      expect(result.tempToken).toBe('temp-token');
    });
  });

  // ─────────────────────────────────────────────
  // refreshToken
  // ─────────────────────────────────────────────
  describe('refreshToken', () => {
    it('returns new tokens for valid refresh token', async () => {
      jwtHelper.validateRefreshToken.mockReturnValue('user-1');
      userRepository.findOne.mockResolvedValue(makeUser());
      refreshTokenRepoOps.findByToken.mockResolvedValue({
        id: 'rt1',
        familyId: 'fam1',
        version: 1,
        revoked: false,
        consumedAt: null,
        expiresAt: moment().add(1, 'day').toDate(),
      } as any);
      jwtHelper.generateTokens.mockReturnValue({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
      });
      refreshTokenRepoOps.markTokenConsumed.mockResolvedValue(undefined);
      refreshTokenRepoOps.createRefreshToken.mockResolvedValue({} as any);

      const result = await service.refreshToken('valid-token');
      expect(result.accessToken).toBe('new-at');
      expect(result.refreshToken).toBe('new-rt');
    });

    it('throws when token is revoked (and audits family)', async () => {
      jwtHelper.validateRefreshToken.mockReturnValue('user-1');
      userRepository.findOne.mockResolvedValue(makeUser());
      refreshTokenRepoOps.findByToken.mockResolvedValue({
        id: 'rt1',
        familyId: 'fam1',
        version: 1,
        revoked: true,
        consumedAt: null,
        expiresAt: moment().add(1, 'day').toDate(),
      } as any);

      await expect(service.refreshToken('revoked')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(auditLogService.create).toHaveBeenCalled();
    });

    it('throws when token has expired', async () => {
      jwtHelper.validateRefreshToken.mockReturnValue('user-1');
      userRepository.findOne.mockResolvedValue(makeUser());
      refreshTokenRepoOps.findByToken.mockResolvedValue({
        id: 'rt1',
        familyId: 'fam1',
        version: 1,
        revoked: false,
        consumedAt: null,
        expiresAt: moment().subtract(1, 'day').toDate(),
      } as any);

      await expect(service.refreshToken('expired')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user not found', async () => {
      jwtHelper.validateRefreshToken.mockReturnValue('user-1');
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.refreshToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // resendVerificationOtp
  // ─────────────────────────────────────────────
  describe('resendVerificationOtp', () => {
    it('resends OTP for existing user', async () => {
      userRepository.findOne.mockResolvedValue(makeUser());
      userHelper.generateVerificationCode.mockReturnValue('5678');
      userRepository.save.mockResolvedValue(makeUser());

      const result = await service.resendVerificationOtp('test@example.com');
      expect(result.message).toContain('Otp');
    });

    it('throws NotFoundException for unknown email', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        service.resendVerificationOtp('unknown@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // requestResetPasswordOtp
  // ─────────────────────────────────────────────
  describe('requestResetPasswordOtp', () => {
    it('sends password reset OTP', async () => {
      userRepository.findOne.mockResolvedValue(makeUser());
      userHelper.generateVerificationCode.mockReturnValue('9999');

      const result = await service.requestResetPasswordOtp({
        email: 'test@example.com',
      });
      expect(result.message).toContain('Otp');
    });

    it('throws when email missing', async () => {
      await expect(
        service.requestResetPasswordOtp({ email: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        service.requestResetPasswordOtp({ email: 'no@user.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // resetPassword
  // ─────────────────────────────────────────────
  describe('resetPassword', () => {
    it('resets password successfully', async () => {
      userRepository.findOneBy.mockResolvedValue(
        makeUser({
          passwordResetCode: '1234',
          passwordResetCodeExpiresAt: moment().add(1, 'hour').toDate(),
        }),
      );
      userHelper.isValidPassword.mockReturnValue(true);
      userHelper.hashPassword.mockResolvedValue('new-hashed');

      const result = await service.resetPassword({
        otp: '1234',
        newPassword: 'NewPass1',
        confirmNewPassword: 'NewPass1',
      });
      expect(result.message).toContain('reset');
    });

    it('throws when OTP expired', async () => {
      userRepository.findOneBy.mockResolvedValue(
        makeUser({
          passwordResetCode: '1234',
          passwordResetCodeExpiresAt: moment().subtract(1, 'hour').toDate(),
        }),
      );
      await expect(
        service.resetPassword({
          otp: '1234',
          newPassword: 'NewPass1',
          confirmNewPassword: 'NewPass1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when passwords do not match', async () => {
      userRepository.findOneBy.mockResolvedValue(
        makeUser({
          passwordResetCode: '1234',
          passwordResetCodeExpiresAt: moment().add(1, 'hour').toDate(),
        }),
      );
      userHelper.isValidPassword.mockReturnValue(true);
      await expect(
        service.resetPassword({
          otp: '1234',
          newPassword: 'NewPass1',
          confirmNewPassword: 'Different1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // 2FA delegation methods
  // ─────────────────────────────────────────────
  describe('2FA delegation', () => {
    it('setup2fa delegates to SetupTotpProvider', () => {
      setupTotpProvider.initiate2faSetup.mockReturnValue({
        secret: 'secret',
        qrCodeDataUrl: 'data:image/png;base64,...',
      } as any);
      const result = service.setup2fa('user-1');
      expect(setupTotpProvider.initiate2faSetup).toHaveBeenCalledWith('user-1');
      expect(result).toHaveProperty('secret');
    });

    it('confirm2fa delegates to SetupTotpProvider', () => {
      const dto = { token: '123456' } as any;
      setupTotpProvider.confirm2faSetup.mockReturnValue({
        backupCodes: ['code1'],
      } as any);
      service.confirm2fa('user-1', dto);
      expect(setupTotpProvider.confirm2faSetup).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });

    it('disable2fa delegates to ManageTotpProvider', () => {
      const dto = { password: 'pass' } as any;
      manageTotpProvider.disable2fa.mockResolvedValue({
        message: '2FA disabled',
      } as any);
      service.disable2fa('user-1', dto);
      expect(manageTotpProvider.disable2fa).toHaveBeenCalledWith('user-1', dto);
    });

    it('get2faStatus delegates to ManageTotpProvider', () => {
      manageTotpProvider.get2faStatus.mockReturnValue({
        enabled: false,
        backupCodesRemaining: 0,
      } as any);
      service.get2faStatus('user-1');
      expect(manageTotpProvider.get2faStatus).toHaveBeenCalledWith('user-1');
    });

    it('verifyTotpLogin delegates to VerifyTotpProvider', () => {
      const dto = { tempToken: 't', token: '123456' } as any;
      verifyTotpProvider.verifyTotpLogin.mockResolvedValue({
        accessToken: 'at',
      } as any);
      service.verifyTotpLogin(dto);
      expect(verifyTotpProvider.verifyTotpLogin).toHaveBeenCalledWith(dto);
    });

    it('verifyBackupCode delegates to VerifyTotpProvider', () => {
      const dto = { tempToken: 't', backupCode: 'code' } as any;
      verifyTotpProvider.verifyBackupCode.mockResolvedValue({
        accessToken: 'at',
      } as any);
      service.verifyBackupCode(dto);
      expect(verifyTotpProvider.verifyBackupCode).toHaveBeenCalledWith(dto);
    });
  });
});
