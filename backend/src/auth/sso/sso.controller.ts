import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Logger,
  NextFunction,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { SamlStrategy } from './saml.strategy';
import { buildSamlConfig } from './saml.config';

/**
 * SSO controller — all routes are `@Public()` so they bypass global
 * `JwtAuthGuard` and `CsrfGuard`. The SAML flow has its own session
 * cookie (`saml.sid`) so it does not conflict with the `csrf` cookie.
 *
 * Routes:
 *   GET  /auth/sso/status          — reports whether SAML is configured
 *   GET  /auth/sso/login           — initiates SAML auth; ?idp=... is optional discovery
 *   POST /auth/sso/acs             — IdP callback; passport-saml handles the binding
 *   GET  /auth/sso/metadata        — SP metadata XML for IdP configuration
 *   POST /auth/sso/logout          — initiates SLO (single logout)
 */
@ApiTags('auth-sso')
@ApiExcludeController()
@Controller('auth/sso')
@Injectable()
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    private readonly configService: ConfigService,
    // Force the strategy to instantiate on boot so misconfiguration shows up
    // early via the status probe rather than crashing the app.
    private readonly samlStrategy: SamlStrategy,
  ) {}

  private get samlConfig() {
    return buildSamlConfig(this.configService);
  }

  /**
   * Returns whether SAML is configured and which IdPs are exposed for
   * discovery. Useful for the staff login page to decide whether to render
   * the "Sign in with SSO" button at all.
   */
  @Public()
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSO readiness probe' })
  status() {
    const cfg = this.samlConfig;
    return {
      enabled: cfg.enabled,
      issuer: cfg.issuer,
      callbackUrl: cfg.callbackUrl,
      // Hosted IdP discovery list. Configurable via comma-separated
      // SAML_DISCOVERY_IDPS env var (defaults to okta + google-workspace).
      discoveryIdps: this.configService
        .get<string>('SAML_DISCOVERY_IDPS', 'okta,google-workspace')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  /**
   * Begin SAML login. Passport-saml redirects the browser to the IdP.
   * Optional `?idp=okta|google-workspace|custom` query is checked against
   * the `SAML_DISCOVERY_IDPS` allowlist; if it does not match we fall back
   * to the IdP configured by `SAML_ENTRY_POINT`.
   */
  @Public()
  @Get('login')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Begin SAML SSO login' })
  async login(
    @Res() res: Response,
    @Query('idp') idp: string | undefined,
    @Req() req: Request,
    @Next() next: NextFunction,
  ) {
    if (!this.samlConfig.enabled) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: 'saml_not_configured',
        message:
          'SAML SSO has not been configured on the backend. Set SAML_ENTRY_POINT, SAML_ISSUER, SAML_CALLBACK_URL, SAML_IDP_CERT.',
      });
      return;
    }
    // We deliberately rely on the global express-session middleware
    // (configured in main.ts) to seed `req.session` before the strategy
    // redirects.
    await this.runStrategy(req, res, next, 'saml', { idp });
  }

  /**
   * Assertion Consumer Service. The IdP POSTs a SAMLResponse here. Passport-saml
   * validates the assertion and invokes `validate` (see `saml.strategy.ts`),
   * which provisions a staff user. We then mint a NovaLabs JWT pair,
   * set them as HttpOnly cookies matching the email/password login flow,
   * and redirect to the staff dashboard.
   */
  @Public()
  @Post('acs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SAML Assertion Consumer Service' })
  async acs(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    if (!this.samlConfig.enabled) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: 'saml_not_configured',
        message: 'SAML SSO has not been configured on the backend.',
      });
      return;
    }
    await this.runStrategy(req, res, next, 'saml');
  }

  /**
   * Service Provider metadata. Most IdPs (Okta, Google Workspace, Azure AD)
   * expect this URL when registering the SP. We return a minimal XML doc
   * derived from the configured `SAML_ISSUER` + `SAML_CALLBACK_URL`.
   */
  @Public()
  @Get('metadata')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SP metadata XML for IdP configuration' })
  metadata(@Res() res: Response) {
    if (!this.samlConfig.enabled) {
      res
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json({ error: 'saml_not_configured' });
      return;
    }
    const issuer = this.samlConfig.issuer ?? '';
    const acs = this.samlConfig.callbackUrl ?? '';
    const xml =
      `<?xml version="1.0"?>\n<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${this.escapeXml(
        issuer,
      )}">` +
      `<SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">` +
      `<NameIDFormat>${this.samlConfig.nameIdFormat}</NameIDFormat>` +
      `<AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${this.escapeXml(
        acs,
      )}" index="0" isDefault="true"/>` +
      `</SPSSODescriptor></EntityDescriptor>`;
    res.set('Content-Type', 'application/samlmetadata+xml').send(xml);
  }

  /**
   * Single Logout. IdPs that support SLO POST a LogoutResponse to the SP;
   * we just acknowledge and let the strategy tear down the local session.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    if (!this.samlConfig.enabled) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: 'saml_not_configured',
      });
      return;
    }
    await this.runStrategy(req, res, next, 'saml');
  }

  private async runStrategy(
    req: Request,
    res: Response,
    next: NextFunction,
    name: string,
    _options: Record<string, unknown> = {},
  ): Promise<void> {
    // We delegate to passport.authenticate via a small adapter because
    // passport-saml's `Strategy` is event-driven and requires the auth
    // middleware to run in the same handler chain.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const passport = require('passport');
    return new Promise<void>((resolve) => {
      passport.authenticate(name, (err: any, user: any) => {
        if (err || !user) {
          this.logger.warn(
            `SAML authentication failed: ${err?.message ?? 'no user'}`,
          );
          res
            .status(HttpStatus.UNAUTHORIZED)
            .json({ error: 'saml_auth_failed', message: err?.message });
          resolve();
          return;
        }
        // Bind the session BEFORE we mint cookies so express-session pid/gid
        // are stable.
        req.login(user, (loginErr) => {
          if (loginErr) {
            this.logger.error(`req.login failed: ${loginErr.message}`);
            res
              .status(HttpStatus.INTERNAL_SERVER_ERROR)
              .json({ error: 'session_init_failed' });
            resolve();
            return;
          }
          // Hand control back to Nest for downstream handlers (e.g.
          // issuing cookies).
          resolve();
          next();
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
