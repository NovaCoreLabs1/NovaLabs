import { UnauthorizedException } from '@nestjs/common';
import { VerifyTotpProvider } from './verify-totp.provider';
import { JwtHelper } from '../helper/jwt-helper';
import * as otplib from 'otplib';
import * as bcrypt from 'bcrypt';

jest.mock('otplib');
jest.mock('bcrypt');

describe('VerifyTotpProvider', () => {
  let provider: VerifyTotpProvider;
  let usersRepository: any;
  let jwtHelper: jest.Mocked<Partial<JwtHelper>>;

  beforeEach(() => {
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    jwtHelper = {
      verifyTempToken: jest.fn(),
      generateTokens: jest.fn(),
    };
    provider = new VerifyTotpProvider(
      usersRepository,
      jwtHelper as any,
    );
  });

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'user',
    totpSecret: 'MOCK_SECRET',
    totpBackupCodes: ['$2b$10$code1', '$2b$10$code2'],
  };

  describe('verifyTotpLogin', () => {
    it('verifies TOTP code and returns tokens', async () => {
      jwtHelper.verifyTempToken.mockReturnValue({ sub: 'user-1', type: '2fa_pending' });
      usersRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(otplib, 'verifySync').mockReturnValue({ valid: true } as any);
      jwtHelper.generateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await provider.verifyTotpLogin({
        tempToken: 'temp-token',
        token: '123456',
      });

      expect(jwtHelper.verifyTempToken).toHaveBeenCalledWith('temp-token');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
      });
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      jwtHelper.verifyTempToken.mockReturnValue({ sub: 'user-1', type: '2fa_pending' });
      usersRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(otplib, 'verifySync').mockReturnValue({ valid: false } as any);

      await expect(
        provider.verifyTotpLogin({ tempToken: 'temp-token', token: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      jwtHelper.verifyTempToken.mockReturnValue({ sub: 'user-1', type: '2fa_pending' });
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.verifyTotpLogin({ tempToken: 'temp-token', token: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyBackupCode', () => {
    it('verifies a backup code and removes it', async () => {
      jwtHelper.verifyTempToken.mockReturnValue({ sub: 'user-1', type: '2fa_pending' });
      usersRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      jwtHelper.generateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await provider.verifyBackupCode({
        tempToken: 'temp-token',
        backupCode: 'valid-code',
      });

      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('access-token');
      expect(result.backupCodesRemaining).toBe(1);
    });

    it('throws UnauthorizedException when no backup codes match', async () => {
      jwtHelper.verifyTempToken.mockReturnValue({ sub: 'user-1', type: '2fa_pending' });
      usersRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        provider.verifyBackupCode({
          tempToken: 'temp-token',
          backupCode: 'invalid-code',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user has no backup codes', async () => {
      jwtHelper.verifyTempToken.mockReturnValue({ sub: 'user-1', type: '2fa_pending' });
      usersRepository.findOne.mockResolvedValue({
        ...mockUser,
        totpBackupCodes: null,
      });

      await expect(
        provider.verifyBackupCode({
          tempToken: 'temp-token',
          backupCode: 'code',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
