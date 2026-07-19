import { Test, TestingModule } from '@nestjs/testing';
import { GenerateTokensProvider } from './generateTokens.provider';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/userRoles.enum';

describe('GenerateTokensProvider', () => {
  let provider: GenerateTokensProvider;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  beforeEach(async () => {
    jwtService = {
      signAsync: jest.fn(),
    };

    provider = new GenerateTokensProvider(jwtService as any);
  });

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
  } as User;

  describe('generateAccessToken', () => {
    it('signs a JWT with user payload and access token expiry', async () => {
      jwtService.signAsync.mockResolvedValue('access-token-123');

      const result = await provider.generateAccessToken(mockUser);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', role: UserRole.USER, email: 'user@example.com' },
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      expect(result).toBe('access-token-123');
    });
  });

  describe('generateRefreshToken', () => {
    it('signs a JWT with user id and refresh token expiry', async () => {
      jwtService.signAsync.mockResolvedValue('refresh-token-123');

      const result = await provider.generateRefreshToken(mockUser);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1' },
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      expect(result).toBe('refresh-token-123');
    });
  });

  describe('generateBothTokens', () => {
    it('generates both access and refresh tokens', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-123');

      const result = await provider.generateBothTokens(mockUser);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-123');
    });
  });
});
