import { UnauthorizedException } from '@nestjs/common';
import { SetupTotpProvider } from './setup-totp.provider';
import * as otplib from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('otplib');
jest.mock('qrcode');
jest.mock('bcrypt');

describe('SetupTotpProvider', () => {
  let provider: SetupTotpProvider;
  let usersRepository: any;

  beforeEach(() => {
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    provider = new SetupTotpProvider(usersRepository);

    jest.spyOn(otplib, 'generateSecret').mockReturnValue('MOCK_SECRET');
    jest
      .spyOn(otplib, 'generateURI')
      .mockReturnValue(
        'otpauth://totp/NovaLabs:user@test.com?secret=MOCK_SECRET',
      );
    (QRCode.toDataURL as jest.Mock).mockResolvedValue(
      'data:image/png;base64,qrcode',
    );
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');
  });

  describe('initiate2faSetup', () => {
    it('generates secret, saves to user, and returns QR code', async () => {
      const user = {
        id: 'user-1',
        email: 'user@test.com',
        totpSecret: null,
      };
      usersRepository.findOne.mockResolvedValue(user);
      usersRepository.save.mockResolvedValue({
        ...user,
        totpSecret: 'MOCK_SECRET',
      });

      const result = await provider.initiate2faSetup('user-1');

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(user.totpSecret).toBe('MOCK_SECRET');
      expect(usersRepository.save).toHaveBeenCalledWith(user);
      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        'otpauth://totp/NovaLabs:user@test.com?secret=MOCK_SECRET',
      );
      expect(result.secret).toBe('MOCK_SECRET');
      expect(result.qrCodeDataUrl).toBe('data:image/png;base64,qrcode');
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(provider.initiate2faSetup('unknown')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('confirm2faSetup', () => {
    it('verifies TOTP code and generates backup codes', async () => {
      const user = {
        id: 'user-1',
        email: 'user@test.com',
        totpSecret: 'MOCK_SECRET',
        twoFactorEnabled: false,
        totpBackupCodes: null,
      };
      usersRepository.findOne.mockResolvedValue(user);

      jest.spyOn(otplib, 'verifySync').mockReturnValue({ valid: true } as any);
      // crypto.randomBytes runs for real — it's a Node.js built-in

      const result = await provider.confirm2faSetup('user-1', {
        token: '123456',
      });

      expect(otplib.verifySync).toHaveBeenCalledWith({
        token: '123456',
        secret: 'MOCK_SECRET',
      });
      expect(user.twoFactorEnabled).toBe(true);
      expect(user.totpBackupCodes).toBeDefined();
      expect(user.totpBackupCodes).toHaveLength(8);
      expect(bcrypt.hash).toHaveBeenCalledTimes(8);
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes).toHaveLength(8);
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      const user = {
        id: 'user-1',
        totpSecret: 'MOCK_SECRET',
      };
      usersRepository.findOne.mockResolvedValue(user);

      jest.spyOn(otplib, 'verifySync').mockReturnValue({ valid: false } as any);

      await expect(
        provider.confirm2faSetup('user-1', { token: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when 2FA setup not initiated', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'user-1',
        totpSecret: null,
      });

      await expect(
        provider.confirm2faSetup('user-1', { token: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.confirm2faSetup('unknown', { token: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
