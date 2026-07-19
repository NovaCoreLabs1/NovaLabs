import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import * as https from 'https';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/userRoles.enum';
import * as bcrypt from 'bcrypt';

/**
 * Minimum acceptable password entropy score (0–4).
 *
 * Calculated from the number of distinct character-set pools present in the
 * password (lowercase, uppercase, digits, symbols). Each pool contributes one
 * point; a score of 2 is considered the floor for basic entropy.
 *
 * This is NOT the same as traditional "complexity rules" (NIST discourages
 * those). It is a lightweight proxy for entropy: a password that draws from
 * more pools has a larger effective keyspace.
 */
const MIN_ENTROPY_SCORE = 2;

/** Minimum password length for standard users (NIST SP 800-63B §5.1.1.1). */
const MIN_LENGTH_USER = 8;

/** Minimum password length for privileged accounts (admin / super-admin). */
const MIN_LENGTH_ADMIN = 12;

/** Privileged roles that require the stricter minimum length. */
const PRIVILEGED_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
]);

/** Well-known trivially-guessable passwords that pass naive char-class checks. */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password',
  'password1',
  'Password1',
  'Password123',
  'Passw0rd',
  '12345678',
  'iloveyou',
  'abc123ABC',
  'qwerty123',
  'letmein1',
  'admin1234',
  'welcome1',
]);

@Injectable()
export class UserHelper {
  public async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  public formatUserResponse(user: User) {
    return {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isSuspended: user.isSuspended,
      isDeleted: user.isDeleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  /**
   * Validates a password against the platform's NIST SP 800-63B-aligned policy.
   *
   * Rules applied (in order):
   *  1. Minimum length — 12 chars for admin/super-admin, 8 for everyone else.
   *  2. Blocklist — rejects known-trivial passwords regardless of length.
   *  3. Entropy floor — password must draw from at least two distinct character
   *     pools (lowercase, uppercase, digits, symbols). This measures *keyspace*
   *     rather than mandating specific character classes.
   *
   * Note: breach checking is intentionally async and lives in
   * `checkPasswordBreached`. Call that separately so this method remains
   * synchronous and usable in DTO-validation contexts.
   *
   * @param password  The plain-text candidate password.
   * @param role      The role the account will be assigned; defaults to USER.
   * @returns `true` when the password meets the policy.
   */
  public isValidPassword(
    password: string,
    role: UserRole = UserRole.USER,
  ): boolean {
    const minLength = PRIVILEGED_ROLES.has(role)
      ? MIN_LENGTH_ADMIN
      : MIN_LENGTH_USER;

    if (password.length < minLength) {
      return false;
    }

    if (COMMON_PASSWORDS.has(password)) {
      return false;
    }

    return this.computeEntropyScore(password) >= MIN_ENTROPY_SCORE;
  }

  /**
   * Checks whether a password appears in the HaveIBeenPwned corpus using the
   * k-Anonymity model (only the first 5 hex chars of the SHA-1 hash are sent).
   *
   * Returns `true` when the password has been seen in a known data breach.
   * Network errors are caught and logged; the method returns `false` on failure
   * so that a transient HIBP outage never blocks registration.
   *
   * @param password  The plain-text candidate password.
   */
  public async checkPasswordBreached(password: string): Promise<boolean> {
    const sha1 = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const responseText = await this.fetchHibpRange(prefix);
      const lines = responseText.split('\r\n');
      for (const line of lines) {
        const [hashSuffix, countStr] = line.split(':');
        if (hashSuffix === suffix) {
          const count = parseInt(countStr, 10);
          return count > 0;
        }
      }
      return false;
    } catch (err) {
      // Fail open: don't block the user if HIBP is unavailable.
      console.warn('HIBP breach check failed (failing open):', err?.message);
      return false;
    }
  }

  /**
   * Fetches the hash range from the HIBP Pwned Passwords API.
   * Extracted for testability — tests can spy on this method.
   */
  public fetchHibpRange(prefix: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = `https://api.pwnedpasswords.com/range/${prefix}`;
      https
        .get(url, { headers: { 'Add-Padding': 'true' } }, (res) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => resolve(data));
        })
        .on('error', reject);
    });
  }

  /**
   * Computes a simple entropy score (0–4) based on how many distinct character
   * pools the password draws from:
   *   +1 for lowercase letters
   *   +1 for uppercase letters
   *   +1 for decimal digits
   *   +1 for symbols / non-alphanumeric characters
   *
   * A longer password that mixes pools has a larger effective keyspace and is
   * harder to brute-force than one that satisfies arbitrary complexity rules.
   */
  private computeEntropyScore(password: string): number {
    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  }

  public generateVerificationCode(digits: number = 4): string {
    const max = Math.pow(10, digits) - 1;
    const min = Math.pow(10, digits - 1);

    return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
  }
}
