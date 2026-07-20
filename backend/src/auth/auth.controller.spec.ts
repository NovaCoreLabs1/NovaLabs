import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '../users/enums/userRoles.enum';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'mock-secret'),
  generateURI: jest.fn(() => 'otpauth://...'),
  verifySync: jest.fn(() => ({ valid: true })),
}));

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(async () => {
    authService = {
      createUser: jest.fn(),
      createAdminUser: jest.fn(),
      login: jest.fn(),
      verifyOtp: jest.fn(),
      resendVerificationOtp: jest.fn(),
      refreshToken: jest.fn(),
      requestResetPasswordOtp: jest.fn(),
      resendResetPasswordVerificationOtp: jest.fn(),
      verifyResetPasswordOtp: jest.fn(),
      resetPassword: jest.fn(),
      setup2fa: jest.fn(),
      confirm2fa: jest.fn(),
      verifyTotpLogin: jest.fn(),
      verifyBackupCode: jest.fn(),
      disable2fa: jest.fn(),
      get2faStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/register', () => {
    it('calls authService.createUser', async () => {
      const dto = {
        email: 'a@b.com',
        password: 'Valid1',
        firstname: 'A',
        lastname: 'B',
      };
      authService.createUser.mockResolvedValue({ accessToken: 'at' } as any);
      const result = await controller.create(dto);
      expect(authService.createUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ accessToken: 'at' });
    });
  });

  describe('POST /auth/login', () => {
    it('calls authService.login', async () => {
      const dto = { email: 'a@b.com', password: 'pass' };
      authService.login.mockResolvedValue({ accessToken: 'at' } as any);
      const result = await controller.login(dto);
      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('POST /auth/verify-otp', () => {
    it('calls authService.verifyOtp', async () => {
      const dto = { email: 'a@b.com', otp: '1234' };
      authService.verifyOtp.mockResolvedValue({ message: 'verified' } as any);
      const result = await controller.verifyOtp(dto);
      expect(authService.verifyOtp).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('verified');
    });
  });

  describe('POST /auth/resend-verification-otp', () => {
    it('calls authService.resendVerificationOtp', async () => {
      const dto = { email: 'a@b.com' };
      authService.resendVerificationOtp.mockResolvedValue({
        message: 'sent',
      } as any);
      const result = await controller.resendVerificationOtp(dto);
      expect(authService.resendVerificationOtp).toHaveBeenCalledWith('a@b.com');
      expect(result.message).toBe('sent');
    });
  });

  describe('POST /auth/register-admin', () => {
    it('calls authService.createAdminUser', async () => {
      const dto = {
        email: 'admin@x.com',
        password: 'Admin1',
        firstname: 'A',
        lastname: 'B',
      };
      authService.createAdminUser.mockResolvedValue({
        accessToken: 'admin-token',
      } as any);
      const result = await controller.createAdmin(dto);
      expect(authService.createAdminUser).toHaveBeenCalledWith(dto);
      expect(result.accessToken).toBe('admin-token');
    });
  });

  describe('POST /auth/refresh-token', () => {
    it('calls authService.refreshToken', async () => {
      authService.refreshToken.mockResolvedValue({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
      } as any);
      const result = await controller.refreshToken('valid-rt');
      expect(authService.refreshToken).toHaveBeenCalledWith('valid-rt');
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('GET /auth/current-user', () => {
    it('returns the user', async () => {
      const user = { id: 'u1', email: 'a@b.com' } as any;
      const result = await controller.retrieveCurrentUser(user);
      expect(result).toEqual(user);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('calls authService.requestResetPasswordOtp', async () => {
      const dto = { email: 'a@b.com' };
      authService.requestResetPasswordOtp.mockResolvedValue({
        message: 'OTP sent',
      } as any);
      const result = await controller.forgotPassword(dto);
      expect(authService.requestResetPasswordOtp).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('calls authService.resetPassword', async () => {
      const dto = {
        otp: '1234',
        newPassword: 'New1',
        confirmNewPassword: 'New1',
      };
      authService.resetPassword.mockResolvedValue({
        message: 'reset',
      } as any);
      const result = await controller.resetPassword(dto);
      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('reset');
    });
  });

  describe('2FA endpoints', () => {
    it('POST /auth/2fa/setup calls service.setup2fa', async () => {
      authService.setup2fa.mockReturnValue({ secret: 's' } as any);
      const result = await controller.setup2fa('user-1');
      expect(authService.setup2fa).toHaveBeenCalledWith('user-1');
    });

    it('POST /auth/2fa/confirm calls service.confirm2fa', async () => {
      const dto = { token: '123456' } as any;
      authService.confirm2fa.mockReturnValue({ backupCodes: [] } as any);
      await controller.confirm2fa('user-1', dto);
      expect(authService.confirm2fa).toHaveBeenCalledWith('user-1', dto);
    });

    it('POST /auth/2fa/verify calls service.verifyTotpLogin', async () => {
      const dto = { tempToken: 't', token: '123456' } as any;
      authService.verifyTotpLogin.mockResolvedValue({
        accessToken: 'at',
      } as any);
      await controller.verifyTotpLogin(dto);
      expect(authService.verifyTotpLogin).toHaveBeenCalledWith(dto);
    });

    it('POST /auth/2fa/disable calls service.disable2fa', async () => {
      const dto = { password: 'pass' } as any;
      authService.disable2fa.mockResolvedValue({ message: 'disabled' } as any);
      await controller.disable2fa('user-1', dto);
      expect(authService.disable2fa).toHaveBeenCalledWith('user-1', dto);
    });

    it('GET /auth/2fa/status calls service.get2faStatus', async () => {
      authService.get2faStatus.mockReturnValue({
        enabled: false,
        backupCodesRemaining: 0,
      } as any);
      await controller.get2faStatus('user-1');
      expect(authService.get2faStatus).toHaveBeenCalledWith('user-1');
    });
  });
});
