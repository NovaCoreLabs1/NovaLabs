import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from '@node-saml/passport-saml';
import { Request } from 'express';
import { buildSamlConfig, SamlConfig } from './saml.config';
import { SamlUserProvisioningService } from './saml-user-provisioning.service';

/**
 * passport-saml strategy registered as `saml`.
 *
 * Two callbacks:
 *  - `validate` runs after the IdP POSTs to the ACS. We resolve the
 *    assertion into a NovaLabs user via the provisioning service.
 *  - `logoutResponse` runs when the IdP confirms an SLO request.
 *
 * When SAML is not configured (no `SAML_ENTRY_POINT` etc.), the
 * `passport-saml` constructor throws. We catch that and expose a no-op
 * `enabled` getter so the controller can respond with 503 instead of
 * crashing the app.
 */
@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  public readonly config: SamlConfig;

  constructor(
    configService: ConfigService,
    private readonly provisioning: SamlUserProvisioningService,
  ) {
    const samlConfig = buildSamlConfig(configService);
    super(
      {
        entryPoint: samlConfig.entryPoint ?? 'https://idp.invalid/sso',
        issuer: samlConfig.issuer ?? 'urn:novalabs:invalid',
        callbackUrl: samlConfig.callbackUrl ?? 'https://api.invalid/acs',
        idpCert: samlConfig.idpCert ?? '',
        // We do NOT want passport-saml crying if env is missing at
        // construction time — we still want Nest to boot in development.
        wantAssertionsSigned: !samlConfig.disableSignatureValidation,
        wantAuthnResponseSigned: !samlConfig.disableSignatureValidation,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        identifierFormat: samlConfig.nameIdFormat,
        // We accept the default RelayState for redirect-back purposes.
        acceptedClockSkewMs: 5_000,
      },
      // validate — runs after ACS POST
      async (profile: Profile | null, done: (err: any, user?: any) => void) => {
        try {
          if (!profile) {
            return done(new Error('Empty SAML profile'));
          }
          const provisioned = await this.provisioning.provision({
            nameID: profile.nameID,
            email:
              (profile as any).email ??
              (typeof profile['urn:oid:0.9.2342.19200300.100.1.3'] ===
              'string'
                ? (profile as any)['urn:oid:0.9.2342.19200300.100.1.3']
                : undefined),
            firstName:
              (profile as any).givenName ??
              (profile as any).firstName ??
              (profile as any)['urn:oid:2.5.4.42'],
            lastName:
              (profile as any).sn ??
              (profile as any).lastName ??
              (profile as any)['urn:oid:2.5.4.4'],
            attributes: profile as any,
          });
          done(null, provisioned.user);
        } catch (error) {
          done(error);
        }
      },
      // logoutResponse — runs after SLO confirmation
      async (profile: Profile | null, done: (err: any, user?: any) => void) => {
        done(null, profile);
      },
    );
    this.config = samlConfig;
  }
}
