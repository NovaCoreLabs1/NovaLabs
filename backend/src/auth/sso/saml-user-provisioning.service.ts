import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/userRoles.enum';
import * as crypto from 'crypto';

export interface SamlAssertionProfile {
  nameID?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Result of resolving a SAML assertion into a NovaLabs user.
 */
export interface ProvisionedSamlUser {
  user: User;
  created: boolean;
}

/**
 * Lightweight companion to {@link SamlStrategy} that maps IdP claims onto a
 * NovaLabs `User` row.
 *
 * Behaviour:
 *  - IdP email must be present; otherwise provisioning fails (no PII = no
 *    account; SSO bypasses the email-verified gate but the email itself is
 *    the account key).
 *  - If a `User` already exists for the email, the user's role is upgraded
 *    to `STAFF` (idempotent — already STAFF is a no-op). Membership
 *    metadata is preserved.
 *  - If no `User` exists, a new one is created with `role=STAFF`,
 *    `isVerified=true`, `twoFactorEnabled=false` (the IdP is now the
 *    authenticator).
 *  - Password is set to a random impossible-to-guess value (`crypto.randomBytes`)
 *    so the SAML-only user can never log in with email+password.
 *    Re-authentication is via the SAML flow exclusively.
 */
@Injectable()
export class SamlUserProvisioningService {
  private readonly logger = new Logger(
    SamlUserProvisioningService.name,
  );

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async provision(
    profile: SamlAssertionProfile,
  ): Promise<ProvisionedSamlUser> {
    const email = (profile.email ?? profile.nameID ?? '').trim().toLowerCase();
    if (!email) {
      throw new Error(
        'SAML assertion missing email/nameID — cannot provision user',
      );
    }

    let user = await this.usersRepository.findOne({ where: { email } });
    let created = false;

    if (!user) {
      user = this.usersRepository.create({
        email,
        firstname: profile.firstName?.trim() || 'Staff',
        lastname: profile.lastName?.trim() || '',
        role: UserRole.STAFF,
        isVerified: true,
        isActive: true,
        // SAML-only accounts cannot log in via password. The hash below is
        // a bcrypt-compatible random — never used because the SAML flow
        // short-circuits email+password login.
        password: this.unusablePasswordHash(),
      });
      await this.usersRepository.save(user);
      created = true;
      this.logger.log(`Provisioned new staff user from SAML: ${email}`);
    } else if (user.role !== UserRole.STAFF) {
      // Promote existing user to STAFF on first successful SAML login.
      user.role = UserRole.STAFF;
      await this.usersRepository.save(user);
      this.logger.log(`Promoted existing user ${email} to STAFF via SAML`);
    }

    return { user, created };
  }

  /**
   * Returns a bcrypt-shaped hash string that cannot match any user-typed
   * password. We use a cryptographically-random value rather than bcrypt's
   * real algorithm because this hash is never compared — it just needs to
   * look syntactically valid so future tooling doesn't crash.
   */
  private unusablePasswordHash(): string {
    const random = crypto.randomBytes(32).toString('hex');
    return `$2b$10$${random.slice(0, 53)}`;
  }
}
