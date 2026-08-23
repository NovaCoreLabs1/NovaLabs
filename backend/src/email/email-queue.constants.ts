/**
 * Durable email delivery (issue #231).
 *
 * A single generic Bull queue carries every transactional email. Jobs are
 * fully rendered at enqueue time (templates are precompiled at boot), so the
 * processor only talks to SMTP and template errors surface at the call site
 * instead of inside a background worker.
 */

export const EMAIL_QUEUE_NAME = 'email';
export const EMAIL_DLQ_QUEUE_NAME = 'email-dlq';

/** Attachment content travels through Redis as base64 strings. */
export interface EmailAttachment {
  filename: string;
  contentBase64: string;
  contentType: string;
}

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

/**
 * Retry policy applied to every email job. Five attempts with exponential
 * backoff starting at 15s (15s → 30s → 60s → 120s) spans roughly four
 * minutes — long enough to ride out an SMTP blip, short enough that OTPs
 * still arrive while they are valid for 10 minutes.
 */
export const EMAIL_RETRY_ATTEMPTS = 5;
export const EMAIL_RETRY_BACKOFF_DELAY_MS = 15_000;

/** Templates every deployment must ship; validated at boot. */
export const REQUIRED_TEMPLATES = [
  'verification-otp',
  'verification-link',
  'password-reset-otp',
  'password-reset-link',
  'password-reset-success',
  'booking-created',
  'booking-cancelled',
  'payment-success',
  'payment-failed',
  'invoice-ready',
  'contact-confirmation',
  'contact-notification',
  'newsletter-confirmation',
  'newsletter-confirmed',
  'newsletter-unsubscribed',
  'refresh-family-revoked',
] as const;

export type RequiredTemplateName = (typeof REQUIRED_TEMPLATES)[number];
