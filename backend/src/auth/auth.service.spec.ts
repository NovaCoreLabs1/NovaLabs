/// <reference types="jest" />

// `otplib` is ESM-only. Mocking it here short-circuits the transitive
// `@scure/base` import chain that the TOTP providers pull in, which
// ts-jest (configured for CommonJS) cannot parse.
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verifySync: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { UserHelper } from './helper/user-helper';
import { JwtHelper } from './helper/jwt-helper';
import { EmailService } from '../email/email.service';
import { SetupTotpProvider } from './providers/setup-totp.provider';
import { VerifyTotpProvider } from './providers/verify-totp.provider';
import { ManageTotpProvider } from './providers/manage-totp.provider';
import { RefreshTokenRepositoryOperations } from './providers/refreshToken.repository';
import { AuditLogService } from '../audit-log/providers/audit-log.service';
import { PasswordBreachService } from './providers/password-breach.service';
import { UserMessages } from './helper/user-messages';

// ---------------------------------------------------------------------------
// Shared test fixtures (module scope so both describe blocks can use them).
// ---------------------------------------------------------------------------

const baseUser: Partial<User> = {
  id: 'user-123',
  email: 'jane@example.com',
  firstname: 'Jane',
  lastname: 'Doe',
  passwordResetCode: null,
  passwordResetCodeExpiresAt: null,
  verificationCode: null,
  verificationCodeExpiresAt: null,
};

const baseSignupUser: Partial<User> = {
  id: 'user-456',
  email: 'joe@example.com',
  firstname: 'Joe',
  lastname: 'Bloggs',
  isVerified: false,
  verificationCode: null,
  verificationCodeExpiresAt: null,
};

const mockUserRepository: Partial<Record<keyof Repository<User>, jest.Mock>> = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockUserHelper = {
  generateVerificationCode: jest.fn(() => '1234'),
};

const mockPasswordResetEmailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
};

const mockSignupEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
};

// Collaborators of AuthService unused by either resend-OTP flow. An empty
// stub satisfies Nest's DI without exercising their internals.
const unusedProvider = {};

/** Builds a TestingModule with the shared mocks + a caller-supplied EmailService. */
async function buildAuthServiceModule(
  emailServiceMock: Partial<EmailService>,
): Promise<AuthService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: mockUserRepository },
      { provide: UserHelper, useValue: mockUserHelper },
      { provide: JwtHelper, useValue: unusedProvider },
      { provide: EmailService, useValue: emailServiceMock },
      { provide: SetupTotpProvider, useValue: unusedProvider },
      { provide: VerifyTotpProvider, useValue: unusedProvider },
      { provide: ManageTotpProvider, useValue: unusedProvider },
      {
        provide: RefreshTokenRepositoryOperations,
        useValue: unusedProvider,
      },
      { provide: AuditLogService, useValue: unusedProvider },
      { provide: PasswordBreachService, useValue: unusedProvider },
    ],
  }).compile();

  return moduleRef.get<AuthService>(AuthService);
}

/**
 * Regression tests for `resendResetPasswordVerificationOtp` (forgot-password
 * "resend OTP" flow). Pins the bug where the email-send was previously
 * commented out AND locks the safe "save before notify" ordering and the
 * absence of the buggy `try/catch → InternalServerErrorException` wrapper.
 */
describe('AuthService.resendResetPasswordVerificationOtp', () => {
  let service: AuthService;
  // Tracks the order of side-effects. `save` must precede the email; if a
  // future refactor flips them, a DB save failure would silently rewrite
  // the OTP without the user ever receiving an email.
  const callOrder: string[] = [];

  beforeEach(async () => {
    callOrder.length = 0;
    (mockUserRepository.save as jest.Mock).mockImplementation(
      (entity: User) => {
        callOrder.push('save');
        return Promise.resolve(entity);
      },
    );
    (
      mockPasswordResetEmailService.sendPasswordResetEmail as jest.Mock
    ).mockImplementation(() => {
      callOrder.push('email');
      return Promise.resolve(true);
    });
    service = await buildAuthServiceModule(mockPasswordResetEmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('generates a fresh OTP, persists it, AND dispatches the reset email', async () => {
    (mockUserRepository.findOne as jest.Mock).mockResolvedValue({
      ...baseUser,
    });

    const result = await service.resendResetPasswordVerificationOtp({
      email: 'jane@example.com',
    });

    expect(result).toEqual({ message: UserMessages.OTP_SENT });

    expect(mockUserHelper.generateVerificationCode).toHaveBeenCalledTimes(1);
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);

    const savedUser = (mockUserRepository.save as jest.Mock).mock.calls[0][0];
    expect(savedUser.passwordResetCode).toBe('1234');
    const expiresAtMs = savedUser.passwordResetCodeExpiresAt?.getTime() ?? 0;
    expect(Math.abs(expiresAtMs - Date.now() - 10 * 60 * 1000)).toBeLessThan(
      5000,
    );

    expect(
      mockPasswordResetEmailService.sendPasswordResetEmail,
    ).toHaveBeenCalledTimes(1);
    const [emailArg, otpArg, fullNameArg] = (
      mockPasswordResetEmailService.sendPasswordResetEmail as jest.Mock
    ).mock.calls[0];
    expect(emailArg).toBe('jane@example.com');
    expect(otpArg).toBe('1234');
    expect(fullNameArg).toBe('Jane Doe');

    expect(callOrder).toEqual(['save', 'email']);
  });

  it('throws NotFoundException and does not email when the user cannot be found', async () => {
    (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.resendResetPasswordVerificationOtp({
        email: 'nobody@example.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(
      mockPasswordResetEmailService.sendPasswordResetEmail,
    ).not.toHaveBeenCalled();
  });

  it('throws BadRequestException and short-circuits before any I/O when email is missing', async () => {
    await expect(
      service.resendResetPasswordVerificationOtp({ email: '' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(
      mockPasswordResetEmailService.sendPasswordResetEmail,
    ).not.toHaveBeenCalled();
  });
});

/**
 * Sibling regression tests for `resendVerificationOtp` (signup email OTP
 * resend). Mirrors the password-reset spec but exercises the signup flow
 * (different email method, different user fields). Same three concerns:
 * email actually sent, save-before-notify ordering, no
 * HttpException-to-InternalServerErrorException masking.
 */
describe('AuthService.resendVerificationOtp', () => {
  let service: AuthService;
  const signupCallOrder: string[] = [];

  beforeEach(async () => {
    signupCallOrder.length = 0;
    (mockUserRepository.save as jest.Mock).mockImplementation(
      (entity: User) => {
        signupCallOrder.push('save');
        return Promise.resolve(entity);
      },
    );
    (
      mockSignupEmailService.sendVerificationEmail as jest.Mock
    ).mockImplementation(() => {
      signupCallOrder.push('email');
      return Promise.resolve(true);
    });
    service = await buildAuthServiceModule(
      // Cast satisfies TS structural typing of `EmailService` (only
      // `sendVerificationEmail` is exercised in this describe block).
      mockSignupEmailService as unknown as EmailService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('generates a fresh signup verification OTP, persists it, AND emails it', async () => {
    (mockUserRepository.findOne as jest.Mock).mockResolvedValue({
      ...baseSignupUser,
    });

    const result = await service.resendVerificationOtp('joe@example.com');

    expect(result).toEqual({ message: UserMessages.OTP_SENT });

    expect(mockUserHelper.generateVerificationCode).toHaveBeenCalledTimes(1);
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);

    const savedUser = (mockUserRepository.save as jest.Mock).mock.calls[0][0];
    expect(savedUser.verificationCode).toBe('1234');
    const expiresAtMs = savedUser.verificationCodeExpiresAt?.getTime() ?? 0;
    expect(Math.abs(expiresAtMs - Date.now() - 10 * 60 * 1000)).toBeLessThan(
      5000,
    );

    expect(mockSignupEmailService.sendVerificationEmail).toHaveBeenCalledTimes(
      1,
    );
    const [emailArg, otpArg, fullNameArg] = (
      mockSignupEmailService.sendVerificationEmail as jest.Mock
    ).mock.calls[0];
    expect(emailArg).toBe('joe@example.com');
    expect(otpArg).toBe('1234');
    expect(fullNameArg).toBe('Joe Bloggs');

    expect(signupCallOrder).toEqual(['save', 'email']);
  });

  it('throws NotFoundException and does not email when the user cannot be found', async () => {
    (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.resendVerificationOtp('nobody@example.com'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockSignupEmailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('throws BadRequestException and short-circuits before any I/O when email is missing', async () => {
    await expect(service.resendVerificationOtp('')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockSignupEmailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
