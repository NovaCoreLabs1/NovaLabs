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

/**
 * Unit tests for AuthService focused on the forgot-password / password-reset
 * resend flow. These tests pin down the behavioural regression where the
 * `emailService.sendPasswordResetEmail(...)` call inside
 * `resendResetPasswordVerificationOtp` was commented out — leaving users who
 * clicked "resend OTP" on the forgot-password screen with a "code sent"
 * response but no email actually delivered (the new OTP overwrote the old
 * one in the database, so the prior code stopped working too).
 */ describe('AuthService.resendResetPasswordVerificationOtp', () => {
  let service: AuthService;
  // Tracks the order of side-effects. We rely on `save` happening before
  // `sendPasswordResetEmail`: if a future refactor flips them, a DB save
  // error would overwrite the in-memory OTP and the new code would never
  // reach the user.
  const callOrder: string[] = [];

  const baseUser: Partial<User> = {
    id: 'user-123',
    email: 'jane@example.com',
    firstname: 'Jane',
    lastname: 'Doe',
    passwordResetCode: null,
    passwordResetCodeExpiresAt: null,
  };

  const mockUserRepository: Partial<Record<keyof Repository<User>, jest.Mock>> =
    {
      findOne: jest.fn(),
      save: jest.fn(),
    };

  const mockUserHelper = {
    generateVerificationCode: jest.fn(() => '1234'),
  };

  const mockEmailService = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  };

  // These collaborators of AuthService are unused inside the resend-OTP flow;
  // an empty stub satisfies Nest's DI without exercising their internals.
  const unusedProvider = {};

  beforeEach(async () => {
    callOrder.length = 0;
    (mockUserRepository.save as jest.Mock).mockImplementation(
      (entity: User) => {
        callOrder.push('save');
        return Promise.resolve(entity);
      },
    );
    (mockEmailService.sendPasswordResetEmail as jest.Mock).mockImplementation(
      () => {
        callOrder.push('email');
        return Promise.resolve(true);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        { provide: UserHelper, useValue: mockUserHelper },
        { provide: JwtHelper, useValue: unusedProvider },
        { provide: EmailService, useValue: mockEmailService },
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

    service = module.get<AuthService>(AuthService);
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

    // Public response stays the same — same UX as the original implementation.
    expect(result).toEqual({ message: UserMessages.OTP_SENT });

    // A fresh OTP was generated and the user row was persisted with it.
    expect(mockUserHelper.generateVerificationCode).toHaveBeenCalledTimes(1);
    expect(mockUserRepository.save).toHaveBeenCalledTimes(1);

    const savedUser = (mockUserRepository.save as jest.Mock).mock.calls[0][0];
    expect(savedUser.passwordResetCode).toBe('1234');
    // OTP must expire roughly 10 minutes from now (the implementation uses
    // `moment().add(10, 'minutes').toDate()`); allow a 5s slop for clock skew.
    const expiresAtMs = savedUser.passwordResetCodeExpiresAt?.getTime() ?? 0;
    expect(Math.abs(expiresAtMs - Date.now() - 10 * 60 * 1000)).toBeLessThan(
      5000,
    );

    // The previously commented-out email send is invoked with the new OTP and
    // the user's full name (firstname + lastname), mirroring the sibling
    // `requestResetPasswordOtp` flow.
    expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const [emailArg, otpArg, fullNameArg] = (
      mockEmailService.sendPasswordResetEmail as jest.Mock
    ).mock.calls[0];
    expect(emailArg).toBe('jane@example.com');
    expect(otpArg).toBe('1234');
    expect(fullNameArg).toBe('Jane Doe');

    // Critical ordering: persist before notify. If a future refactor swaps
    // these, a DB failure could leave the user with an in-memory code
    // rotation they never receive by email.
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
    expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('throws BadRequestException and short-circuits before any I/O when email is missing', async () => {
    await expect(
      service.resendResetPasswordVerificationOtp({ email: '' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    expect(mockUserRepository.save).not.toHaveBeenCalled();
    expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
