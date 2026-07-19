/// <reference types="jest" />

import { UserHelper } from './user-helper';
import { UserRole } from '../../users/enums/userRoles.enum';

describe('UserHelper', () => {
  let helper: UserHelper;

  beforeEach(() => {
    helper = new UserHelper();
  });

  // ---------------------------------------------------------------------------
  // isValidPassword — standard user (min 8 chars, entropy ≥ 2 pools)
  // ---------------------------------------------------------------------------
  describe('isValidPassword – USER role', () => {
    it('accepts a password that meets the minimum bar', () => {
      // 8 chars, lowercase + digits (2 pools) → score 2
      expect(helper.isValidPassword('abcd1234', UserRole.USER)).toBe(true);
    });

    it('accepts a password that uses all four character pools', () => {
      expect(helper.isValidPassword('Str0ng!Pass', UserRole.USER)).toBe(true);
    });

    it('defaults to USER role when none is supplied', () => {
      expect(helper.isValidPassword('abcd1234')).toBe(true);
    });

    it('rejects a password shorter than 8 characters', () => {
      expect(helper.isValidPassword('Ab1!', UserRole.USER)).toBe(false);
    });

    it('rejects a 7-character password (boundary below 8)', () => {
      expect(helper.isValidPassword('Abc1234', UserRole.USER)).toBe(false);
    });

    it('accepts a password that is exactly 8 characters', () => {
      expect(helper.isValidPassword('Abcd1234', UserRole.USER)).toBe(true);
    });

    it('rejects a password made of only one pool (all lowercase)', () => {
      // entropy score = 1 (only lowercase) → below MIN_ENTROPY_SCORE of 2
      expect(helper.isValidPassword('abcdefghijklmnop', UserRole.USER)).toBe(
        false,
      );
    });

    it('rejects a password made of only one pool (all digits)', () => {
      expect(helper.isValidPassword('12345678901234', UserRole.USER)).toBe(
        false,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // isValidPassword — ADMIN / SUPER_ADMIN role (min 12 chars)
  // ---------------------------------------------------------------------------
  describe('isValidPassword – ADMIN / SUPER_ADMIN role', () => {
    it('rejects an 8-character password for ADMIN (below 12-char floor)', () => {
      expect(helper.isValidPassword('Abcd1234', UserRole.ADMIN)).toBe(false);
    });

    it('rejects an 11-character password for ADMIN (boundary below 12)', () => {
      expect(helper.isValidPassword('Abcdef12345', UserRole.ADMIN)).toBe(false);
    });

    it('accepts a 12-character password for ADMIN that meets entropy', () => {
      expect(helper.isValidPassword('SecurePass123', UserRole.ADMIN)).toBe(
        true,
      );
    });

    it('applies the same 12-char floor for SUPER_ADMIN', () => {
      expect(
        helper.isValidPassword('Abcdef12345', UserRole.SUPER_ADMIN),
      ).toBe(false);
      expect(
        helper.isValidPassword('SecurePass1234', UserRole.SUPER_ADMIN),
      ).toBe(true);
    });

    it('accepts a STAFF role with the standard 8-char floor', () => {
      expect(helper.isValidPassword('abcd1234', UserRole.STAFF)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // isValidPassword — common / blocklisted passwords
  // ---------------------------------------------------------------------------
  describe('isValidPassword – blocklisted common passwords', () => {
    it.each([
      'password',
      'Password1',
      'Password123',
      'Passw0rd',
      '12345678',
      'iloveyou',
      'qwerty123',
      'letmein1',
      'admin1234',
      'welcome1',
    ])('rejects the common password "%s"', (pw) => {
      expect(helper.isValidPassword(pw, UserRole.USER)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // checkPasswordBreached — HIBP k-Anonymity integration
  // ---------------------------------------------------------------------------
  describe('checkPasswordBreached', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns true when the password hash suffix appears in the HIBP response', async () => {
      // SHA-1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
      // prefix = 5BAA6, suffix = 1E4C9B93F3F0682250B6CF8331B7EE68FD8
      jest
        .spyOn(helper, 'fetchHibpRange')
        .mockResolvedValueOnce(
          '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3730471\r\nABCDE12345ABCDE12345ABCDE12345ABCDE:1',
        );

      const result = await helper.checkPasswordBreached('password');
      expect(result).toBe(true);
    });

    it('returns false when the hash suffix is absent from the HIBP response', async () => {
      jest
        .spyOn(helper, 'fetchHibpRange')
        .mockResolvedValueOnce(
          'AAAAA11111AAAAA11111AAAAA11111AAAAA:5\r\nBBBBB22222BBBBB22222BBBBB22222BBBBB:3',
        );

      const result = await helper.checkPasswordBreached('VeryUniqueP@ssw0rd!99');
      expect(result).toBe(false);
    });

    it('returns false (fail-open) when the HIBP API throws a network error', async () => {
      jest
        .spyOn(helper, 'fetchHibpRange')
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await helper.checkPasswordBreached('anyPassword1');
      expect(result).toBe(false);
    });

    it('passes only the first 5 SHA-1 hex chars to fetchHibpRange', async () => {
      const spy = jest
        .spyOn(helper, 'fetchHibpRange')
        .mockResolvedValueOnce('');

      await helper.checkPasswordBreached('TestPass1');

      expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^[0-9A-F]{5}$/));
    });

    it('treats a suffix with count 0 as not breached', async () => {
      // Craft a suffix match with count 0 (HIBP padding entries use 0)
      // SHA-1('TestZeroCt') is irrelevant — we mock the response with the
      // correct suffix derived at runtime.
      const { createHash } = await import('crypto');
      const sha1 = createHash('sha1')
        .update('TestZeroCt')
        .digest('hex')
        .toUpperCase();
      const suffix = sha1.slice(5);

      jest
        .spyOn(helper, 'fetchHibpRange')
        .mockResolvedValueOnce(`${suffix}:0`);

      const result = await helper.checkPasswordBreached('TestZeroCt');
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // generateVerificationCode
  // ---------------------------------------------------------------------------
  describe('generateVerificationCode', () => {
    it('generates a 4-digit verification code by default', () => {
      const code = helper.generateVerificationCode();
      expect(code).toHaveLength(4);
      expect(/^\d{4}$/.test(code)).toBe(true);
    });

    it('generates min value (1000) when Math.random returns 0', () => {
      jest.spyOn(Math, 'random').mockReturnValueOnce(0);
      expect(helper.generateVerificationCode()).toBe('1000');
    });

    it('generates max value (9999) when Math.random returns ~1', () => {
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.9999999);
      expect(helper.generateVerificationCode()).toBe('9999');
    });
  });

  // ---------------------------------------------------------------------------
  // hashPassword / verifyPassword
  // ---------------------------------------------------------------------------
  describe('hashPassword / verifyPassword', () => {
    it('hashes a password and verifies it correctly', async () => {
      const password = 'Str0ngPassw0rd';
      const hashed = await helper.hashPassword(password);

      expect(hashed).not.toBe(password);
      expect(await helper.verifyPassword(password, hashed)).toBe(true);
    });

    it('rejects an incorrect plain-text password', async () => {
      const hashed = await helper.hashPassword('CorrectHorse99');
      expect(await helper.verifyPassword('WrongHorse99', hashed)).toBe(false);
    });
  });
});
