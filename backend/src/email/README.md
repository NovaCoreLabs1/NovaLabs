# `email/`

Transactional email delivery module for NovaLabs.

## Purpose

Renders Handlebars templates and dispatches emails via Nodemailer/SendGrid. Used by
auth (verification OTPs, password resets), bookings (confirmations, cancellations),
payments (receipts, failures), newsletters, and contact forms.

## Key Entities

- **EmailService** — central service with methods for each email type:
  `sendVerificationEmail`, `sendPasswordResetEmail`, `sendBookingCreatedEmail`,
  `sendPaymentSuccessEmail`, `sendPaymentFailedEmail`, `sendInvoiceReadyEmail`,
  `sendRefreshTokenFamilyRevokedEmail`, `sendContactConfirmationEmail`, etc.

## Templates

All templates live under `templates/` as Handlebars (`.hbs`) files:

| Template                    | Trigger                                |
| --------------------------- | -------------------------------------- |
| `verification-otp.hbs`     | Signup email verification              |
| `verification-link.hbs`    | Signup magic link (alternate path)     |
| `password-reset-otp.hbs`   | Forgot-password OTP                    |
| `password-reset-link.hbs`  | Forgot-password magic link (alternate) |
| `password-reset-success.hbs` | Password reset confirmation          |
| `booking-created.hbs`      | New booking created                    |
| `booking-cancelled.hbs`    | Booking cancelled                      |
| `payment-success.hbs`      | Payment confirmed                      |
| `payment-failed.hbs`       | Payment failure notification           |
| `invoice-ready.hbs`        | Invoice available for download         |
| `refresh-family-revoked.hbs` | Refresh token family revoked (security) |
| `contact-confirmation.hbs` | Contact form auto-reply                |
| `contact-notification.hbs` | Contact form admin notification        |
| `newsletter-confirmation.hbs` | Newsletter subscription confirmation |
| `newsletter-confirmed.hbs` | Newsletter subscription verified       |
| `newsletter-unsubscribed.hbs` | Newsletter unsubscription           |
| `visitor-check-in.hbs`     | Workspace visitor check-in             |

## Key Files

| File               | Role                                  |
| ------------------ | ------------------------------------- |
| `email.module.ts`  | NestJS module registration            |
| `email.service.ts` | Core email dispatch logic             |
