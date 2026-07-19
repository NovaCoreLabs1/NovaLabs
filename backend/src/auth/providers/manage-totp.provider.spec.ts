import { UnauthorizedException } from '@nestjs/common';
import { ManageTotpProvider } from './manage-totp.provider';
import { HashingProvider } from './hashing.provider';

describe('ManageTotpProvider', () => {
  let provider: ManageTotpProvider;
  let usersRepository: any;
  let hashingProvider: jest.Mocked<Partial<HashingProvider>>;

  beforeEach(() => {
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    hashingProvider = { compare: jest.fn() };
    provider = new ManageTotpProvider(
      usersRepository,
      hashingProvider as HashingProvider,
    );
  });

  describe('disable2fa', () => {
    it('disables 2FA when correct password is provided', async () => {
      const user = {
        id: 'user-1',
        password: '$2b$10$hashed',
        twoFactorEnabled: true,
        totpSecret: 'MOCK_SECRET',
        totpBackupCodes: ['code1', 'code2'],
      };
      usersRepository.findOne.mockResolvedValue(user);
      hashingProvider.compare.mockResolvedValue(true);

      const result = await provider.disable2fa('user-1', {
        password: 'correct-password',
      });

      expect(hashingProvider.compare).toHaveBeenCalledWith(
        'correct-password',
        user.password,
      );
      expect(user.twoFactorEnabled).toBe(false);
      expect(user.totpSecret).toBeNull();
      expect(user.totpBackupCodes).toBeNull();
      expect(usersRepository.save).toHaveBeenCalledWith(user);
      expect(result.message).toBe('2FA has been disabled');
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      const user = {
        id: 'user-1',
        password: '$2b$10$hashed',
      };
      usersRepository.findOne.mockResolvedValue(user);
      hashingProvider.compare.mockResolvedValue(false);

      await expect(
        provider.disable2fa('user-1', { password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.disable2fa('unknown', { password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('get2faStatus', () => {
    it('returns 2FA status for a user with 2FA enabled', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'user-1',
        twoFactorEnabled: true,
        totpBackupCodes: ['code1', 'code2', 'code3'],
      });

      const result = await provider.get2faStatus('user-1');

      expect(result.enabled).toBe(true);
      expect(result.backupCodesRemaining).toBe(3);
    });

    it('returns 2FA status for a user without 2FA', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'user-1',
        twoFactorEnabled: false,
        totpBackupCodes: null,
      });

      const result = await provider.get2faStatus('user-1');

      expect(result.enabled).toBe(false);
      expect(result.backupCodesRemaining).toBe(0);
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.get2faStatus('unknown'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
