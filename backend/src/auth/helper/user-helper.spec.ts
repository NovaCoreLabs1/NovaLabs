/// <reference types="jest" />

import { UserHelper } from './user-helper';

describe('UserHelper', () => {
  let helper: UserHelper;

  beforeEach(() => {
    helper = new UserHelper();
  });

  it('validates a strong password', () => {
    expect(helper.isValidPassword('Str0ngPass')).toBe(true);
  });

  it.each([
    ['short', false],
    ['lowercase1', false],
    ['UPPERCASE1', false],
    ['NoDigits', false],
  ])('rejects invalid password %s', (password, expected) => {
    expect(helper.isValidPassword(password)).toBe(expected);
  });

  it('generates a 4-digit verification code', () => {
    const code = helper.generateVerificationCode();

    expect(code).toHaveLength(4);
    expect(/^[0-9]{4}$/.test(code)).toBe(true);
  });

  it('hashes and verifies a password', async () => {
    const password = 'Str0ngPass';
    const hashed = await helper.hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(await helper.verifyPassword(password, hashed)).toBe(true);
    expect(await helper.verifyPassword('WrongPass', hashed)).toBe(false);
  });

  it('accepts password that is exactly minimum length', () => {
    // minLength in implementation is 8
    expect(helper.isValidPassword('Aaa1aaaa')).toBe(true);
    expect(helper.isValidPassword('Aaa1aaa')).toBe(false);
  });

  it('generates min and max verification codes when Math.random is mocked', () => {
    const minSpy = jest.spyOn(Math, 'random').mockReturnValueOnce(0);
    const minCode = helper.generateVerificationCode();
    expect(minCode).toHaveLength(4);
    expect(Number(minCode)).toBeGreaterThanOrEqual(1000);
    expect(Number(minCode)).toBe(1000);
    minSpy.mockRestore();

    const maxSpy = jest.spyOn(Math, 'random').mockReturnValueOnce(0.9999999);
    const maxCode = helper.generateVerificationCode();
    expect(maxCode).toHaveLength(4);
    expect(Number(maxCode)).toBeLessThanOrEqual(9999);
    expect(Number(maxCode)).toBe(9999);
    maxSpy.mockRestore();
  });
});
