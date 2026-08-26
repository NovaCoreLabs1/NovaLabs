/// <reference types="jest" />
import { createHash } from 'crypto';
import { hashRefreshToken, isHashedRefreshToken } from './refresh-token-hash';

describe('refresh-token-hash', () => {
  // A representative (fake) refresh JWT: three dot-separated base64url segments.
  const rawToken =
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.c2lnbmF0dXJlLXZhbHVl';

  describe('hashRefreshToken', () => {
    it('returns the sha256 hex digest of the token', () => {
      const expected = createHash('sha256').update(rawToken).digest('hex');
      expect(hashRefreshToken(rawToken)).toBe(expected);
    });

    it('produces a 64-char lowercase hex string', () => {
      expect(hashRefreshToken(rawToken)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      expect(hashRefreshToken(rawToken)).toBe(hashRefreshToken(rawToken));
    });

    it('never returns the raw token (no plaintext at rest)', () => {
      expect(hashRefreshToken(rawToken)).not.toBe(rawToken);
    });

    it('maps distinct tokens to distinct hashes', () => {
      expect(hashRefreshToken('a')).not.toBe(hashRefreshToken('b'));
    });
  });

  describe('isHashedRefreshToken', () => {
    it('recognises a stored hash', () => {
      expect(isHashedRefreshToken(hashRefreshToken(rawToken))).toBe(true);
    });

    it('rejects a raw JWT (contains dots, longer than 64 chars)', () => {
      expect(isHashedRefreshToken(rawToken)).toBe(false);
    });

    it('rejects uppercase hex and wrong-length strings', () => {
      expect(isHashedRefreshToken('A'.repeat(64))).toBe(false);
      expect(isHashedRefreshToken('a'.repeat(63))).toBe(false);
      expect(isHashedRefreshToken('a'.repeat(65))).toBe(false);
      expect(isHashedRefreshToken('')).toBe(false);
    });
  });
});
