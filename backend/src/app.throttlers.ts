import { ExecutionContext } from '@nestjs/common';
import { ThrottlerOptions } from '@nestjs/throttler';
import { BookingsController } from './bookings/bookings.controller';

export const DAYPASS_IP_THROTTLER_NAME = 'daypass-ip';
export const DAYPASS_EMAIL_THROTTLER_NAME = 'daypass-email';

/**
 * True only for the handler of `POST /bookings/public/day-pass`.
 *
 * The strict day-pass buckets below must NOT leak onto other routes:
 * @nestjs/throttler evaluates every named throttler from this array against
 * every route (unless skipped), so each entry carries a skipIf that disables
 * it everywhere except the public day-pass endpoint.
 */
function isPublicDayPassHandler(context: ExecutionContext): boolean {
  return context.getHandler() === BookingsController.prototype.publicDayPass;
}

/**
 * Named throttlers registered in AppModule via ThrottlerModule.forRoot().
 *
 * The short/medium/long/newsletter/contact/feedback entries are the
 * pre-existing global configuration; the two `daypass-*` buckets were added
 * for the unauthenticated day-pass funnel (issue #230), which is otherwise
 * protected only by the generic per-IP limits:
 *
 * - daypass-ip:    10 requests / minute / client IP
 * - daypass-email: 5 requests / minute / guest email address
 *
 * The per-email bucket keys on the request body's guestEmail (guards run
 * before validation pipes, so a missing or malformed email falls back to an
 * IP-keyed bucket). Rotating emails is still capped by daypass-ip, and
 * rotating IPs by daypass-email.
 */
export const NAMED_THROTTLERS: ThrottlerOptions[] = [
  { name: 'short', ttl: 1000, limit: 3 }, // 3 requests per second
  { name: 'medium', ttl: 10_000, limit: 20 }, // 20 requests per 10 seconds
  { name: 'long', ttl: 60_000, limit: 100 }, // 100 requests per minute
  { name: 'newsletter', ttl: 60_000, limit: 10 },
  { name: 'contact', ttl: 60_000, limit: 5 },
  { name: 'feedback', ttl: 60_000, limit: 10 },
  {
    name: DAYPASS_IP_THROTTLER_NAME,
    ttl: 60_000,
    limit: 10,
    skipIf: (context) => !isPublicDayPassHandler(context),
  },
  {
    name: DAYPASS_EMAIL_THROTTLER_NAME,
    ttl: 60_000,
    limit: 5,
    skipIf: (context) => !isPublicDayPassHandler(context),
    getTracker: (req) => {
      const raw = req?.body?.guestEmail;
      const email =
        typeof raw === 'string' ? raw.trim().toLowerCase() : undefined;
      return email ? `email:${email}` : `noemail:${req?.ip ?? 'unknown'}`;
    },
  },
];
