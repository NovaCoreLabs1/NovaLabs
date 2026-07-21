import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as passport from 'passport';
import { User } from '../../users/entities/user.entity';
import { RefreshToken } from '../entities/refreshToken.entity';
import { AuthModule } from '../auth.module';
import { SsoController } from './sso.controller';
import { SamlStrategy } from './saml.strategy';
import { SamlUserProvisioningService } from './saml-user-provisioning.service';

/**
 * Staff-only SAML SSO module.
 *
 * - Registers passport-saml `Strategy` via `passport.use('saml', ...)`
 *   in `onModuleInit` so the app does not need a global `@UseGuards` for
 *   SAML routes — the SsoController delegates to `passport.authenticate`
 *   directly.
 * - All routes are `@Public()` so they bypass the global JwtAuthGuard
 *   and CsrfGuard. SAML maintains its own short-lived `saml.sid` cookie
 *   that does not collide with the existing `csrf` cookie.
 * - Activated only when SAML_* env vars are set; otherwise the controller
 *   responds with 503 to all SSO routes so the frontend can render a
 *   helpful "not configured" message.
 * - Provisioned staff users get `role=STAFF` and bypass the email-verified
 *   gate (IdP assertion of email authenticity stands in for verification).
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
export class SsoModule implements OnModuleInit {
  constructor(private readonly samlStrategy: SamlStrategy) {}

  onModuleInit(): void {
    // `as unknown as passport.Strategy` papers over a TS variance
    // mismatch that arises because passport-saml's `Strategy.authenticate`
    // signature uses a passport-flavoured `Request` while the NestJS
    // express flavour has slightly different typing. The runtime contract
    // is satisfied — the cast is purely a typescript-level adapter.
    passport.use(
      'saml',
      this.samlStrategy as unknown as passport.Strategy,
    );
  }
}
