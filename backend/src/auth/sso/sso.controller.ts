import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Logger,
  Next,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { AuthService } from '../auth.service';
import { setAuthCookies } from '../helpers/auth-cookies';
import { SamlStrategy } from './saml.strategy';
import { User } from '../../users/entities/user.entity';

/**
 * SSO controller — every route is `@Public()` so it bypasses the global
 * `JwtAuthGuard` and `CsrfGuard`. The SAML flow keeps its own session
 * cookie (`saml.sid`) which is set up in `main.ts` and does not collide
 * with the existing `csrf` cookie.
 *
 * Routes:
 *   GET  /auth/sso/status    — readiness probe
 *   GET  /auth/sso/login     — SP-initiated AuthnRequest redirect to IdP
 *   POST /auth/sso/acs       — IdP callback (passport-saml verifies)
 *   GET  /auth/sso/metadata  — SP metadata XML for IdP configuration
 *   POST /auth/sso/logout    — single logout acknowledgement
 */
@ApiTags('auth-sso')
@ApiExcludeController()
@Controller('auth/sso')
@Injectable()
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    // Force the strategy to instantiate on boot so misconfiguration surfaces
    // early via `/auth/sso/status` rather than crashing the app.
    private readonly samlStrategy: SamlStrategy,
  ) {}

  @Public()
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSO readiness probe' })
  status() {
    return {
      enabled: this.samlStrategy.config.enabled,
      issuer: this.samlStrategy.config.issuer,
      callbackUrl: this.samlStrategy.config.callbackUrl,
      discoveryIdps: this.configService
        .get<string>('SAML_DISCOVERY_IDPS', 'okta,google-workspace')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  @Public()
  @Get('login')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Begin SAML SSO login' })
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    if (!this.samlStrategy.config.enabled) {
      this.notConfigured(res);
      return;
    }
    await this.runStrategy(req, res, next, 'saml');
  }

  /**
   * Assertion Consumer Service. The IdP POSTs a SAMLResponse here.
   * Passport-saml validates the assertion and invokes the strategy's
   * verify callback (see `saml.strategy.ts`), which provisions a staff
   * user and binds it onto the express-session.
   *
   * After validation we mint a NovaLabs JWT pair (so the SPA can use
   * the same HttpOnly cookie auth it uses after email/password login)
   * and set those cookies. Then we redirect to the staff dashboard.
   */
  @Public()
  @Post('acs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SAML Assertion Consumer Service' })
  async acs(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    if (!this.samlStrategy.config.enabled) {
      this.notConfigured(res);
      return;
    }
    // Run passport.authenticate first so `req.user` is populated from
    // the SAML assertion. Resolves only after the callback fires; any
    // auth failure short-circuits to a 401 in runStrategy.
    const acsResult = await this.runStrategy(req, res, next, 'saml');
    if (!acsResult.ok) {
      return; // runStrategy already wrote 401 + body
    }

    const user = req.user as User | undefined;
    if (!user?.id) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'no_user' });
      return;
    }
    try {
      const tokens = await this.authService.mintAuthTokensForUser(user);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      const staffDashboard =
        this.configService.get<string>('FRONTEND_STAFF_URL') ??
        '/admin/dashboard';
      this.logger.log(
        `SAML ACS success for user ${user.id} → ${staffDashboard}`,
      );
      res.redirect(staffDashboard);
    } catch (error) {
      this.logger.error(
        `Failed to mint tokens for SAML login: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'token_mint_failed',
      });
    }
  }

  @Public()
  @Get('metadata')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SP metadata XML for IdP configuration' })
  metadata(@Res() res: Response): void {
    if (!this.samlStrategy.config.enabled) {
      this.notConfigured(res);
      return;
    }
    const issuer = this.samlStrategy.config.issuer ?? '';
    const acs = this.samlStrategy.config.callbackUrl ?? '';
    const xml =
      `<?xml version="1.0"?>\n<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${this.escapeXml(
        issuer,
      )}">` +
      `<SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">` +
      `<NameIDFormat>${this.samlStrategy.config.nameIdFormat}</NameIDFormat>` +
      `<AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${this.escapeXml(
        acs,
      )}" index="0" isDefault="true"/>` +
      `</SPSSODescriptor></EntityDescriptor>`;
    res.set('Content-Type', 'application/samlmetadata+xml').send(xml);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    if (!this.samlStrategy.config.enabled) {
      this.notConfigured(res);
      return;
    }
    await this.runStrategy(req, res, next, 'saml');
  }

  private notConfigured(res: Response): void {
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      error: 'saml_not_configured',
      message:
        'SAML SSO has not been configured on the backend. Set SAML_ENTRY_POINT, SAML_ISSUER, SAML_CALLBACK_URL, SAML_IDP_CERT.',
    });
  }

  /**
   * Thin async wrapper around `passport.authenticate(name)`. Resolves
   * with `ok: true` if the strategy chain succeeded (it wrote a session
   * user) and `ok: false` if the strategy wrote a 401 response. The
   * caller can use the boolean to decide whether to mint cookies.
   */
  private async runStrategy(
    req: Request,
    res: Response,
    next: NextFunction,
    name: string,
  ): Promise<{ ok: boolean }> {
    return new Promise((resolve) => {
      passport.authenticate(name, (err: unknown, user: unknown) => {
        if (err || !user) {
          this.logger.warn(
            `SAML authentication failed: ${
              err instanceof Error ? err.message : 'no user'
            }`,
          );
          if (!res.headersSent) {
            res.status(HttpStatus.UNAUTHORIZED).json({
              error: 'saml_auth_failed',
              message:
                err instanceof Error ? err.message : 'no SAML user',
            });
          }
          resolve({ ok: false });
          return;
        }
        req.login(user, (loginErr) => {
          if (loginErr) {
            this.logger.error(`req.login failed: ${loginErr.message}`);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              error: 'session_init_failed',
            });
            resolve({ ok: false });
            return;
          }
          resolve({ ok: true });
        });
      })(req, res, next);
    });
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
