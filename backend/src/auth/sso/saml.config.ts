import { ConfigService } from '@nestjs/config';

/**
 * SAML environment binding.
 *
 * SAML is opt-in: if `SAML_ENTRY_POINT` is unset, all SSO endpoints respond
 * with HTTP 503 and a `saml_not_configured` error code so the UI can show a
 * helpful message instead of crashing.
 *
 * Required to enable SSO:
 *   SAML_ENTRY_POINT           — IdP SSO endpoint URL
 *   SAML_ISSUER                — SP entityId (typically your backend URL)
 *   SAML_CALLBACK_URL          — ACS endpoint the IdP should POST to
 *   SAML_IDP_CERT              — PEM-encoded IdP signing certificate (no
 *                                BEGIN/END headers; just base64 lines)
 *
 * Optional:
 *   SAML_LOGOUT_URL            — SLO endpoint, if your IdP supports it
 *   SAML_DISABLE_SIGNATURE_VALIDATION — 'true' ONLY in dev/test setups
 *   SAML_NAMEID_FORMAT         — defaults to emailAddress
 */

export interface SamlConfig {
  enabled: boolean;
  entryPoint: string | null;
  issuer: string | null;
  callbackUrl: string | null;
  idpCert: string | null;
  logoutUrl: string | null;
  nameIdFormat: string;
  disableSignatureValidation: boolean;
}

export function buildSamlConfig(configService: ConfigService): SamlConfig {
  const entryPoint = configService.get<string>('SAML_ENTRY_POINT') ?? null;
  const issuer = configService.get<string>('SAML_ISSUER') ?? null;
  const callbackUrl = configService.get<string>('SAML_CALLBACK_URL') ?? null;
  const idpCert = configService.get<string>('SAML_IDP_CERT') ?? null;
  const logoutUrl = configService.get<string>('SAML_LOGOUT_URL') ?? null;

  const disableSignatureValidation =
    (configService.get<string>('SAML_DISABLE_SIGNATURE_VALIDATION') ??
      'false') === 'true';

  const enabled = Boolean(entryPoint && issuer && callbackUrl && idpCert);

  return {
    enabled,
    entryPoint,
    issuer,
    callbackUrl,
    idpCert,
    logoutUrl,
    nameIdFormat:
      configService.get<string>('SAML_NAMEID_FORMAT') ??
      'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    disableSignatureValidation,
  };
}
