import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Strategy, Profile } from '@node-saml/passport-saml';
import { buildSamlConfig, SamlConfig } from './saml.config';
import { SamlUserProvisioningService } from './saml-user-provisioning.service';

/**
 * passport-saml strategy — extends the raw `@node-saml/passport-saml`
 * `Strategy` directly. We deliberately do NOT extend the NestJS
 * `PassportStrategy` mixin because passport-saml is session-based and
 * expects its verify callback as a constructor argument (the NestJS
 * mixin assumes a `validate` class method, which passport-saml does not
 * use).
 *
 * The strategy is registered with passport in `SsoModule.onModuleInit`
 * under the name `'saml'`. The SsoController then invokes it via
 * `passport.authenticate('saml')`.
 *
 * If the SAML_* env vars are missing, passport-saml's constructor is
 * still invoked (with placeholder values) so the app boots; the
 * controller's `samlConfig.enabled` check shortcuts routes to 503.
 */
@Injectable()
export class SamlStrategy extends Strategy {
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
        wantAssertionsSigned: !samlConfig.disableSignatureValidation,
        wantAuthnResponseSigned: !samlConfig.disableSignatureValidation,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        identifierFormat: samlConfig.nameIdFormat,
        acceptedClockSkewMs: 5_000,
      },
      // signonVerify — invoked after the IdP POSTs to the ACS
      async (profile: Profile | null, done: (err: any, user?: any) => void) => {
        try {
          if (!profile) {
            return done(new Error('Empty SAML profile'));
          }
          const provisioned = await this.provisioning.provision({
            nameID: profile.nameID,
            email:
              (profile as any).email ??
              (profile as any)['urn:oid:0.9.2342.19200300.100.1.3'],
            firstName:
              (profile as any).givenName ??
              (profile as any).firstName ??
              (profile as any)['urn:oid:2.5.4.42'],
            lastName:
              (profile as any).sn ??
              (profile as any).lastName ??
              (profile as any)['urn:oid:2.5.4.4'],
            attributes: profile as Record<string, unknown>,
          });
          done(null, provisioned.user);
        } catch (error) {
          done(error);
        }
      },
      // logoutVerify — invoked on SLO completion
      async (profile: Profile | null, done: (err: any, user?: any) => void) => {
        done(null, profile);
      },
    );
    this.config = samlConfig;
  }
}
