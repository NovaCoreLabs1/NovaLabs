import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { RefreshToken } from '../entities/refreshToken.entity';
import { AuthModule } from '../auth.module';
import { SsoController } from './sso.controller';
import { SamlStrategy } from './saml.strategy';
import { SamlUserProvisioningService } from './saml-user-provisioning.service';

/**
 * Staff-only SAML SSO module.
 *
 * - Mounts at `/auth/sso/*`. All routes are public (the IdP redirects users
 *   without a NovaLabs JWT). The login URL takes an optional `?idp=<name>`
 *   query parameter for hosted IdP discovery (Okta, Google Workspace, etc.).
 * - The `@node-saml/passport-saml` strategy is registered lazily — if the
 *   required env vars are missing, the controller methods respond with 503
 *   so the UI can render a helpful "not configured" message.
 * - Provisioned staff users get `role=STAFF` and bypass the email-verified
 *   gate (IdP assertion of email authenticity is the new gate).
 */
@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ session: true, defaultStrategy: 'saml' }),
    TypeOrmModule.forFeature([User, RefreshToken]),
    AuthModule,
  ],
  controllers: [SsoController],
  providers: [SamlStrategy, SamlUserProvisioningService],
})
export class SsoModule {}
