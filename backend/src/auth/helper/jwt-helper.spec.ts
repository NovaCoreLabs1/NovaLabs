/// <reference types="jest" />
import { JwtHelper } from './jwt-helper';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtHelper', () => {
  let jwtService: Partial<JwtService>;
  let helper: JwtHelper;

  beforeEach(() => {
    jwtService = {
      sign: jest.fn().mockImplementation((payload) => JSON.stringify(payload)),
      verify: jest.fn(),
    } as unknown as Partial<JwtService>;
    helper = new JwtHelper(jwtService as JwtService);
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
});
