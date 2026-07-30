# `auth/`

Authentication and authorization module — the security backbone of NovaLabs.

## Purpose

Handles registration, login, OTP verification, JWT issuance, refresh token
rotation, password reset flows, TOTP-based 2FA, backup codes, SAML SSO,
passkey/WebAuthn support, and role-based access control. Also enforces
password breach checking against known compromised credentials.

## Sub-modules

- **[`sso/`](sso/README.md)** — SAML 2.0 SSO for staff dashboard login

## Key Entities

- **User** (`../users/entities/user.entity.ts`) — central identity with
  hashed password, TOTP secret, backup codes, passkey credentials,
  verification codes, and refresh tokens.
- **RefreshToken** (`entities/refreshToken.entity.ts`) — rotating token family
  for stateless session management with reuse detection.

## Endpoints

All routes under `/auth/`. `@Public()` routes bypass JWT/CSRF guards.

| Method | Path                            | Auth   | Description                       |
| ------ | ------------------------------- | ------ | --------------------------------- |
| POST   | `/auth/register`                | Public | Member signup + OTP email         |
| POST   | `/auth/verify-otp`              | Public | Verify email OTP                  |
| POST   | `/auth/resend-verification-otp` | Public | Resend verification OTP           |
| POST   | `/auth/login`                   | Public | Email + password login            |
| POST   | `/auth/refresh-token`           | Public | Rotate refresh token              |
| GET    | `/auth/current-user`            | JWT    | Retrieve current user profile     |
| POST   | `/auth/register-admin`          | Admin  | Create admin user                 |
| POST   | `/auth/forgot-password`         | Public | Request password reset OTP        |
| POST   | `/auth/send-reset-password-otp` | Public | Send password reset OTP           |
| POST   | `/auth/resend-reset-password-otp`| Public| Resend password reset OTP         |
| POST   | `/auth/verify-reset-password-otp`|Public | Verify password reset OTP         |
| POST   | `/auth/reset-password`          | Public | Set new password                  |
| POST   | `/auth/2fa/setup`               | JWT    | Initiate TOTP setup               |
| POST   | `/auth/2fa/confirm`             | JWT    | Confirm TOTP setup                |
| POST   | `/auth/2fa/verify`              | Public | Verify TOTP during login          |
| POST   | `/auth/2fa/backup-code`         | Public | Login with backup code            |
| POST   | `/auth/2fa/disable`             | JWT    | Disable 2FA                      |
| GET    | `/auth/2fa/status`              | JWT    | Check 2FA status                  |

## Security Features

- **Password breach detection** via `PasswordBreachService` (Have I Been Pwned)
- **Refresh token rotation** with family-based reuse detection and automatic
  family revocation on suspected theft
- **TOTP 2FA** with backup codes
- **Passkey/WebAuthn** support via SimpleWebAuthn (`passkey/`)
- **Account locking** after repeated failed attempts
- **CSRF protection** via double-submit cookie pattern

## Key Files

| File                                            | Role                              |
| ----------------------------------------------- | --------------------------------- |
| `auth.module.ts`                                | NestJS module registration        |
| `auth.controller.ts`                            | HTTP endpoints                    |
| `auth.service.ts`                               | Core auth logic                   |
| `auth.service.spec.ts`                          | Unit tests                        |
| `helper/user-helper.ts`                         | Password hashing, validation      |
| `helper/user-helper.spec.ts`                    | Helper tests                      |
| `helper/jwt-helper.ts`                          | JWT sign/verify                   |
| `helper/jwt-helper.spec.ts`                     | JWT tests                         |
| `helper/user-messages.ts`                       | User-facing message constants     |
| `helpers/auth-cookies.ts`                       | HttpOnly cookie helpers           |
| `guard/jwt.auth.guard.ts`                       | JWT authentication guard          |
| `guard/roles.guard.ts`                          | Role-based authorization guard    |
| `decorators/roles.decorators.ts`                | `@Roles()` decorator              |
| `decorators/public.decorator.ts`                | `@Public()` decorator             |
| `decorators/current.user.decorators.ts`         | `@CurrentUser()` decorator        |
| `decorators/getCurrentUser.decorator.ts`        | `@GetCurrentUser()` decorator     |
| `providers/password-breach.service.ts`          | HIBP password check               |
| `providers/password-breach.service.spec.ts`     | Breach check tests                |
| `providers/setup-totp.provider.ts`              | TOTP setup logic                  |
| `providers/verify-totp.provider.ts`             | TOTP verification logic           |
| `providers/manage-totp.provider.ts`             | TOTP disable/status               |
| `providers/refreshToken.repository.ts`          | Refresh token persistence         |
| `entities/refreshToken.entity.ts`               | Refresh token entity              |
| `passkey/passkey.service.ts`                    | WebAuthn/passkey logic            |
| `passkey/passkey.service.spec.ts`               | Passkey tests                     |
| `sso/`                                          | SAML SSO sub-module               |
