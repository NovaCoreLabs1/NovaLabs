import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../auth.service';
import { UserRole } from '../../users/enums/userRoles.enum';

describe('JwtStrategy', () => {
  let authService: jest.Mocked<Partial<AuthService>>;

  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.JWT_SECRET = 'test-jwt-secret';
    authService = { retrieveUserById: jest.fn() };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('constructor', () => {
    it('creates the strategy when JWT_SECRET is set', () => {
      const strategy = new JwtStrategy(authService as any);
      expect(strategy).toBeDefined();
    });

    it('throws when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      expect(() => new JwtStrategy(authService as any)).toThrow(
        'ACCESS_TOKEN_SECRET environment variable is not defined',
      );
    });
  });

  describe('validate', () => {
    it('returns user data when authService finds the user', async () => {
      const strategy = new JwtStrategy(authService as any);
      authService.retrieveUserById.mockResolvedValue({
        id: 'user-1',
        firstname: 'John',
        lastname: 'Doe',
        email: 'john@example.com',
        role: UserRole.USER,
      } as any);

      const result = await strategy.validate({
        sub: 'user-1',
        role: UserRole.USER as any,
        email: 'john@example.com',
        fullName: 'John Doe',
      } as any);

      expect(authService.retrieveUserById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        id: 'user-1',
        fullName: 'John Doe',
        email: 'john@example.com',
        role: UserRole.USER as any,
      });
    });

    it('throws UnauthorizedException when authService throws', async () => {
      const strategy = new JwtStrategy(authService as any);
      authService.retrieveUserById.mockRejectedValue(
        new Error('User not found'),
      );

      await expect(
        strategy.validate({
          sub: 'unknown',
          role: UserRole.USER as any,
          email: 'unknown@example.com',
          fullName: 'Unknown',
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
