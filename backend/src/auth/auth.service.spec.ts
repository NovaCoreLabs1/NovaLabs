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
  create: jest.fn(),
};

const mockUserHelper = {
  generateVerificationCode: jest.fn(() => '1234'),
  isValidPassword: jest.fn(() => true),
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  formatUserResponse: jest.fn((u: Partial<User>) => ({
    id: u.id ?? 'response-id',
    email: u.email,
    firstname: u.firstname,
    lastname: u.lastname,
    role: u.role,
    isActive: u.isActive ?? true,
    isSuspended: u.isSuspended ?? false,
    isDeleted: u.isDeleted ?? false,
  })),
};

// JwtHelper is invoked by `persistNewUser` (Issue #14 refactor) to mint
// the access token returned to the controller. The existing resend-OTP
// specs do not need this and previously relied on an empty stub being
// ignored; the new specs require a no-op mock that returns a non-empty
// string so `expect.objectContaining({ accessToken: expect.anything() })`
// succeeds.
const mockJwtHelper = {
  generateAccessToken: jest.fn(() => 'mock-access-token'),
  generateTokens: jest.fn(() => ({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  })),
  generateTempToken: jest.fn(() => 'mock-temp-token'),
  validateRefreshToken: jest.fn(() => 'user-123'),
};

const mockPasswordResetEmailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
};

const mockSignupEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
};

// Collaborators of AuthService unused by either resend-OTP flow. An empty
// stub satisfies Nest's DI without exercising their internals. The
// mockPasswordBreachService is ALSO a stub but its `checkPassword` is
// invoked by `persistNewUser` (Issue #14 / ADR 0008 refactor) so we
// provide a no-op mock that resolves cheaply.
const unusedProvider = {};

const mockPasswordBreachService = {
  checkPassword: jest.fn().mockResolvedValue(undefined),
};

/** Builds a TestingModule with the shared mocks + a caller-supplied EmailService. */
async function buildAuthServiceModule(
  emailServiceMock: Partial<EmailService>,
): Promise<AuthService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: mockUserRepository },
      { provide: UserHelper, useValue: mockUserHelper },
      { provide: JwtHelper, useValue: mockJwtHelper },
      { provide: EmailService, useValue: emailServiceMock },
      { provide: SetupTotpProvider, useValue: unusedProvider },
      { provide: VerifyTotpProvider, useValue: unusedProvider },
      { provide: ManageTotpProvider, useValue: unusedProvider },
      {
        provide: RefreshTokenRepositoryOperations,
        useValue: unusedProvider,
      },
      { provide: AuditLogService, useValue: unusedProvider },
      { provide: PasswordBreachService, useValue: mockPasswordBreachService },
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
 * Behavioural tests for the `createUser` / `createAdminUser` refactor
 * (Issue #14, ADR 0008). Asserts:
 *   1. `createUser` dispatches the verification email.
 *   2. `createUser` writes `isVerified = false` + a fresh OTP + expiry.
 *   3. `createAdminUser` deliberately does NOT send the verification email
 *      and does NOT generate an OTP — this is the intentional behaviour
 *      documented in ADR 0008.
 *   4. Save-before-notify ordering for the verification path (a DB save
 *      failure must not silently rewrite an OTP that no one can claim).
 *   5. Both branches reject duplicate emails.
 */
describe('AuthService.createUser / createAdminUser (refactor)', () => {
  let service: AuthService;
  const callOrder: string[] = [];

  beforeEach(async () => {
    callOrder.length = 0;
    (mockUserRepository.save as jest.Mock).mockImplementation(
      (entity: User) => {
        callOrder.push('save');
        return Promise.resolve(entity);
      },
    );
    (mockUserRepository.create as jest.Mock).mockImplementation(
      (entity: Partial<User>) => {
        return { id: 'new-user-id', ...entity } as User;
      },
    );
    (
      mockSignupEmailService.sendVerificationEmail as jest.Mock
    ).mockImplementation(() => {
      callOrder.push('email');
      return Promise.resolve(true);
    });
    service = await buildAuthServiceModule(
      mockSignupEmailService as unknown as EmailService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('createUser: persists an unverified USER with OTP and sends verification email', async () => {
    (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

    const result = await service.createUser({
      email: 'joe@example.com',
      firstname: 'Joe',
      lastname: 'Bloggs',
      password: 'StrongPass1!',
    } as any);

    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    const savedUser = (mockUserRepository.save as jest.Mock).mock.calls[0][0];
    expect(savedUser.role).toBe('user');
    expect(savedUser.isVerified).toBe(false);
    expect(savedUser.verificationCode).toBe('1234');
    const expiresMs = savedUser.verificationCodeExpiresAt?.getTime() ?? 0;
    expect(Math.abs(expiresMs - Date.now() - 10 * 60 * 1000)).toBeLessThan(
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

    expect(callOrder).toEqual(['save', 'email']);
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: expect.anything(),
        user: expect.objectContaining({
          email: 'joe@example.com',
        }),
      }),
    );
  });

  it('createAdminUser: persists an ADMIN without OTP and does NOT send verification email', async () => {
    (mockUserRepository.findOne as jest.Mock).mockResolvedValue(null);

    const result = await service.createAdminUser({
      email: 'staff@example.com',
      firstname: 'Staff',
      lastname: 'Member',
      password: 'StrongPass1!',
    } as any);

    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    const savedUser = (mockUserRepository.save as jest.Mock).mock.calls[0][0];
    // The admin path deliberately skips OTP generation and isVerified flipping.
    // See ADR 0008 — admin accounts are minted by an already-authenticated
    // ADMIN and verified out-of-band (currently = never).
    expect(savedUser.role).toBe('admin');
    expect(savedUser.verificationCode).toBeUndefined();
    expect(savedUser.verificationCodeExpiresAt).toBeUndefined();
    expect('isVerified' in savedUser ? savedUser.isVerified : undefined).toBe(
      undefined,
    );

    // The admin path must NOT dispatch a verification email.
    expect(mockSignupEmailService.sendVerificationEmail).not.toHaveBeenCalled();

    // No save-before-notify ordering applies because no email is sent.
    expect(callOrder).toEqual(['save']);

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: expect.anything(),
      }),
    );
  });

  it('createUser: throws ConflictException when email already exists and skips email', async () => {
    (mockUserRepository.findOne as jest.Mock).mockResolvedValue({
      ...baseSignupUser,
      email: 'joe@example.com',
    });

    await expect(
      service.createUser({
        email: 'joe@example.com',
        firstname: 'Joe',
        lastname: 'Bloggs',
        password: 'StrongPass1!',
      } as any),
    ).rejects.toThrow(/already/i);

    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockSignupEmailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('createAdminUser: throws ConflictException when email already exists and skips email', async () => {
    (mockUserRepository.findOne as jest.Mock).mockResolvedValue({
      ...baseSignupUser,
      email: 'staff@example.com',
      role: 'admin',
    });

    await expect(
      service.createAdminUser({
        email: 'staff@example.com',
        firstname: 'Staff',
        lastname: 'Member',
        password: 'StrongPass1!',
      } as any),
    ).rejects.toThrow(/already/i);

    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockSignupEmailService.sendVerificationEmail).not.toHaveBeenCalled();
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
