# NovaLabs Session & JWT Expiry Policies

> **Audience:** Security auditors, compliance reviewers, and development team members.
> **Last updated:** July 2026

This document defines the session lifecycle and token expiry rules for the NovaLabs
platform. All values are configurable through environment variables so operators can
align the defaults with their own organisational risk posture.

---

## Token Lifecycle Table

| Token Type       | Default Lifetime      | Rotation Policy                       | Env Variable               |
| :--------------- | :-------------------- | :------------------------------------ | :------------------------- |
| Access Token     | 15 minutes            | Stateless — obtain a new one via the  | `JWT_EXPIRATION`           |
|                  |                       | refresh flow.                         |                            |
| Refresh Token    | 7 days (rolling)      | Rotated on every use. The old token   | `JWT_REFRESH_EXPIRATION`   |
|                  |                       | is invalidated server-side (token     |                            |
|                  |                       | family revocation).                   |                            |
| 2FA Temp Token   | 5 minutes             | One-shot; consumed after successful   | _hardcoded_                |
|                  |                       | TOTP / passkey verification.          |                            |
| Idle Timeout     | 30 minutes            | Client-side inactivity detection.     | `SESSION_IDLE_TIMEOUT`     |
| Absolute Timeout | 14 days               | Forces full re-authentication.        | `SESSION_ABSOLUTE_TIMEOUT` |

---

## Environment Variables

These values are read at application boot. If the variable is omitted the
hard-coded default is used.

| Variable                  | Default    | Description                              |
| :------------------------ | :--------- | :--------------------------------------- |
| `JWT_EXPIRATION`          | `15m`      | Access-token lifetime (JSON-duration).   |
| `JWT_REFRESH_EXPIRATION`  | `7d`       | Refresh-token maximum lifetime.          |
| `JWT_ISSUER`              | `novalabs` | `iss` claim written into every JWT.      |
| `JWT_AUDIENCE`            | `novalabs-api` | `aud` claim written into every JWT.  |
| `SESSION_IDLE_TIMEOUT`    | `30m`      | Inactivity window before soft expiry.    |
| `SESSION_ABSOLUTE_TIMEOUT`| `14d`      | Hard re-auth deadline regardless of use. |

---

## Rationale

- **Short access tokens (15 min)** — Minimises the blast radius of a leaked JWT.
  The companion refresh mechanism allows seamless renewal without degrading UX.
- **Rotating refresh tokens (7d)** — Replay detection is implemented via the
  `refreshTokenFamily` column: using an already-consumed refresh token revokes
  the entire family, locking out a potential attacker.
- **Idle timeout (30 min)** — Protects unattended sessions.
- **Absolute timeout (14d)** — Aligns with [NIST SP 800-63B § 4.1.4](https://pages.nist.gov/800-63-3/sp800-63b.html#sec4)
  guidance that re-authentication should occur no less than every 30 days for
  AAL2; NovaLabs chooses the more conservative 14-day value.

---

## Implementation Notes

- Token creation is centralised in `JwtHelper` (`backend/src/auth/helper/jwt-helper.ts`).
- The `JwtStrategy` (`backend/src/auth/strategy/jwt.strategy.ts`) validates
  `iss`, `aud`, `exp`, and `sub` on every request.
- `RefreshTokenRepositoryOperations` handles family invalidation.
- Client-side idle detection is handled by the frontend auth store.
