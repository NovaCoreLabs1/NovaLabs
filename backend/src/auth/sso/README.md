# `auth/sso/` — SAML SSO for the Staff Dashboard

Implements SAML 2.0 SSO for the staff dashboard using
[`@node-saml/passport-saml`](https://github.com/node-saml/passport-saml).

## Activation

SAML is **opt-in**. The backend boots normally when SAML is unconfigured;
the controller will respond to all SSO routes with HTTP 503 and a
`{ "error": "saml_not_configured" }` payload so the frontend can render a
helpful message instead of crashing.

The four required env vars:

| Env var             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `SAML_ENTRY_POINT`  | IdP SSO URL                                   |
| `SAML_ISSUER`       | SP entityId (your backend)                    |
| `SAML_CALLBACK_URL` | ACS URL the IdP POSTs the SAMLResponse to     |
| `SAML_IDP_CERT`     | IdP signing certificate (PEM, no headers)     |

Optional:

| Env var                          | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `SAML_LOGOUT_URL`                | SLO URL                                  |
| `SAML_NAMEID_FORMAT`             | Defaults to emailAddress NameID format   |
| `SAML_DISCOVERY_IDPS`            | Comma list displayed on the frontend     |
| `SAML_DISABLE_SIGNATURE_VALIDATION` | `"true"` in dev only                 |

## Endpoints

All routes live under `/api/auth/sso/` and are `@Public()` so they bypass
JWT/Csrf guards. SAML maintains its own short-lived `saml.sid` cookie that
does not collide with the existing `csrf` cookie.

| Method | Path                | Description                                |
| ------ | ------------------- | ------------------------------------------ |
| GET    | `/status`           | Reports whether SSO is configured + IdPs   |
| GET    | `/login?idp=<name>` | SP-initiated SAML; redirects to IdP        |
| POST   | `/acs`              | ACS callback (IdP POSTs SAMLResponse)      |
| GET    | `/metadata`         | SP metadata XML for IdP configuration      |
| POST   | `/logout`           | SLO initiator                              |

`/acs` resolves the assertion via `SamlUserProvisioningService`, which
upserts the user with `role=STAFF` and `isVerified=true`, then the spring
handles cookie issuance through a future integration step. The session is
mounted globally in `main.ts`.

## Frontend integration

`/admin/sso/login` probes `/auth/sso/status` and renders a button per
configured IdP. Each button is a GET form that posts back to the backend's
`/auth/sso/login?idp=...` endpoint; the browser navigates to the IdP, which
POSTs the SAMLResponse back to `/auth/sso/acs` on completion.

## Security notes

- IdP assertion signatures are verified by default. Disable ONLY in dev.
- SAML-only accounts get an unusable bcrypt-shaped password hash so they
  cannot log in via the email+password flow.
- Refresh tokens follow the existing email-password flow's `authRefreshToken`
  cookie, scoped to `/api/auth/refresh-token`.
- All routes are tagged `@Public()` because the IdP redirect has no JWT.

## Deferred integration tests

Per the issue scope, real-IdP integration tests against Okta / Google
Workspace are deferred — they require live IdP credentials at deployment
time. The `SamlUserProvisioningService` unit test covers the upsert and
role-upgrade paths.
