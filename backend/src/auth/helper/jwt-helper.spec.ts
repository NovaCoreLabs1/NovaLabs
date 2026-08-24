/// <reference types="jest" />
import { JwtHelper } from './jwt-helper';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtHelper', () => {
  let jwtService: Partial<JwtService>;
  let helper: JwtHelper;
  const defaultHubService = {
    defaultHubId: '00000000-0000-0000-0000-0000000000d1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService = {
      sign: jest.fn().mockImplementation((payload) => JSON.stringify(payload)),
      verify: jest.fn(),
    } as unknown as Partial<JwtService>;
    helper = new JwtHelper(jwtService as JwtService, defaultHubService as any);
  });

  it('validateRefreshToken returns sub when token valid', () => {
    (jwtService.verify as jest.Mock).mockReturnValueOnce({ sub: 'user-id' });
    expect(helper.validateRefreshToken('token')).toBe('user-id');
  });

  it('validateRefreshToken throws when invalid', () => {
    (jwtService.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad');
    });
    expect(() => helper.validateRefreshToken('bad')).toThrow(
      UnauthorizedException,
    );
  });

  it('generateTokens returns both tokens', () => {
    const user = {
      id: 'u1',
      email: 'a@b.c',
      fullName: 'A B',
      role: 'user',
    } as any;
    const tokens = helper.generateTokens(user);
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
  });

  it('verifyTempToken returns payload for 2fa_pending', () => {
    (jwtService.verify as jest.Mock).mockReturnValueOnce({
      sub: 'u1',
      type: '2fa_pending',
    });
    const payload = helper.verifyTempToken('t');
    expect(payload.type).toBe('2fa_pending');
  });

  it('verifyTempToken throws for wrong type', () => {
    (jwtService.verify as jest.Mock).mockReturnValueOnce({
      sub: 'u1',
      type: 'other',
    });
    expect(() => helper.verifyTempToken('t')).toThrow(UnauthorizedException);
  });

  describe('generateAccessToken hubId claim (issue #225)', () => {
    it('mints the claim from user.hubId when assigned', () => {
      helper.generateAccessToken({
        id: 'u1',
        email: 'a@b.c',
        fullName: 'A B',
        role: 'user',
        hubId: '00000000-0000-0000-0000-00000000beef',
      } as any);

      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(payload.hubId).toBe('00000000-0000-0000-0000-00000000beef');
    });

    it('falls back to the default hub UUID for legacy users (hubId NULL)', () => {
      helper.generateAccessToken({
        id: 'u1',
        email: 'a@b.c',
        fullName: 'A B',
        role: 'user',
        hubId: null,
      } as any);

      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(payload.hubId).toBe(defaultHubService.defaultHubId);
    });

    it('leaves the claim undefined when no default hub has been resolved yet', () => {
      helper = new JwtHelper(
        jwtService as JwtService,
        {
          defaultHubId: undefined,
        } as any,
      );

      helper.generateAccessToken({
        id: 'u1',
        email: 'a@b.c',
        fullName: 'A B',
        role: 'user',
        hubId: null,
      } as any);

      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(payload.hubId).toBeUndefined();
    });
  });
});
