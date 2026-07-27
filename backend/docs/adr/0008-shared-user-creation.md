# ADR 0008 — Shared `persistNewUser` for `createUser` and `createAdminUser`

- Status: Accepted
- Date: 2026-07-27
- Closes: #14

## Context

`backend/src/auth/auth.service.ts` previously contained two near-duplicate
methods, `createUser` (public sign-up) and `createAdminUser` (admin-mints-admin)
that inlined ~30 lines of identical logic:

```text
findOne({ where: { email } })
  → ConflictException if present
  → isValidPassword check
  → password breach check
  → hash
  → userRepository.create + save
  → generateAccessToken
```

The only meaningful divergence was:

- `createUser` generated an OTP, marked `isVerified = false`,
  and dispatched `emailService.sendVerificationEmail`.
- `createAdminUser` skipped the OTP/email entirely and assigned `role: ADMIN`.

That divergence was:

1. **Undocumented.** A reader could reasonably assume admin creation was
   broken (`isVerified` defaults to `false` for any new row, so admin
   accounts would be locked out of `POST /auth/login` until something
   flipped `isVerified`).
2. **Inconsistent.** Any future change to the password rules, breach
   check, audit copy, or `formatUserResponse` shape had to be applied
   in two places and routinely drifted. The class explicitly cited the
   problem in the user creation block prologues but never fixed it.
3. **Hard to test.** A regression that hardened the password rules on
   `createAdminUser` but not `createUser` would only surface in tests
   that happened to exercise the admin path.

## Decision

Introduce a single private helper `persistNewUser(dto, role, opts)` where:

- `role` selects `UserRole.USER` or `UserRole.ADMIN`.
- `opts.mustVerifyEmail` selects whether to generate an OTP, mark the row
  as `isVerified = false`, and dispatch `sendVerificationEmail`.

`createUser` and `createAdminUser` become one-line pass-throughs:

```ts
createUser(dto)            => persistNewUser(dto, UserRole.USER,  { mustVerifyEmail: true  });
createAdminUser(dto)       => persistNewUser(dto, UserRole.ADMIN, { mustVerifyEmail: false });
```

## Consequences — admin behaviour preserved

This ADR explicitly endorses the **existing** admin-path behaviour: admin
accounts minted via `POST /auth/register-admin` are written to the database
unverified, but they are not asked to complete an OTP flow. This is
intentional because:

- The endpoint is `@Roles(UserRole.ADMIN)` — only an authenticated
  admin can mint another admin. The bootstrap-admin path is `npm run
  typeorm:run-migrations` + a fixture, not the public sign-up form.
- Sending a "verify your new admin account" email to the target inbox
  has no recovery path: staff onboarding uses SAML SSO, not the
  email/password flow, so the OTP lifecycle (`requestResetPasswordOtp` →
  `verifyOtp`) cannot be used.
- An admin created silently today matches the existing prod reality;
  flipping it to "send a verification email" would silently break staff
  onboarding without a documented escape hatch.

If we later decide staff must verify first, we flip `mustVerifyEmail: true`
on the admin branch and add an admin-only `verify-otp` route — out of
scope for #14.

## Backwards compatibility

- Public method signatures on `AuthController.create`/`createAdmin`
  are unchanged.
- Public method names on `AuthService` are unchanged; only the bodies
  are slimmed.
- `auth.service.spec.ts` behaviour-parity tests for the existing
  `resendVerificationOtp` and `resendResetPasswordVerificationOtp`
  flows remain green without modification.

## Out of scope

- Building a generic `UserFactory` class. The shared logic today is
  ~30 lines; the item-18 `compose, don't duplicate` hint in the
  original issue suggests a class only once the assembled object
  grows non-trivial. We will revisit when a third call site (e.g.
  staff SSO onboarding) needs the same shape.
- Migrating the admin bootstrap CLI to use `persistNewUser` — the
  admin bootstrap script uses `users` service directly and is
  intentionally outside the auth pipeline.
