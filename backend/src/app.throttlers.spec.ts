import { ExecutionContext } from '@nestjs/common';
import { BookingsController } from './bookings/bookings.controller';
import {
  DAYPASS_EMAIL_THROTTLER_NAME,
  DAYPASS_IP_THROTTLER_NAME,
  NAMED_THROTTLERS,
} from './app.throttlers';

function contextForHandler(
  handler: (...args: never[]) => unknown,
): ExecutionContext {
  return {
    getHandler: () => handler as unknown,
    getClass: () => BookingsController,
  } as unknown as ExecutionContext;
}

function contextForOtherRoute(): ExecutionContext {
  const anyOtherHandler = function someOtherRoute() {};
  return contextForHandler(anyOtherHandler);
}

describe('NAMED_THROTTLERS (day-pass abuse prevention)', () => {
  it('keeps the pre-existing global buckets unchanged', () => {
    const byName = new Map(NAMED_THROTTLERS.map((t) => [t.name, t]));

    expect(byName.get('short')).toMatchObject({ ttl: 1000, limit: 3 });
    expect(byName.get('medium')).toMatchObject({ ttl: 10_000, limit: 20 });
    expect(byName.get('long')).toMatchObject({ ttl: 60_000, limit: 100 });
    expect(byName.get('newsletter')).toMatchObject({ ttl: 60_000, limit: 10 });
    expect(byName.get('contact')).toMatchObject({ ttl: 60_000, limit: 5 });
    expect(byName.get('feedback')).toMatchObject({ ttl: 60_000, limit: 10 });
  });

  describe(`${DAYPASS_IP_THROTTLER_NAME}`, () => {
    const throttler = NAMED_THROTTLERS.find(
      (t) => t.name === DAYPASS_IP_THROTTLER_NAME,
    );

    it('caps the funnel at 10 requests per minute', () => {
      expect(throttler).toMatchObject({ ttl: 60_000, limit: 10 });
    });

    it('is enforced on POST /bookings/public/day-pass', async () => {
      expect(
        await throttler!.skipIf!(
          contextForHandler(BookingsController.prototype.publicDayPass),
        ),
      ).toBe(false);
    });

    it('is disabled everywhere else so other routes keep their own limits', async () => {
      expect(await throttler!.skipIf!(contextForOtherRoute())).toBe(true);
    });
  });

  describe(`${DAYPASS_EMAIL_THROTTLER_NAME}`, () => {
    const throttler = NAMED_THROTTLERS.find(
      (t) => t.name === DAYPASS_EMAIL_THROTTLER_NAME,
    );

    it('caps each guest email at 5 requests per minute', () => {
      expect(throttler).toMatchObject({ ttl: 60_000, limit: 5 });
    });

    it('is scoped to the day-pass route only', async () => {
      expect(
        await throttler!.skipIf!(
          contextForHandler(BookingsController.prototype.publicDayPass),
        ),
      ).toBe(false);
      expect(await throttler!.skipIf!(contextForOtherRoute())).toBe(true);
    });

    it('tracks by normalized guest email', async () => {
      const tracker = throttler!.getTracker!;
      expect(
        await tracker(
          { body: { guestEmail: '  Guest@Example.COM ' }, ip: '1.2.3.4' },
          {} as ExecutionContext,
        ),
      ).toBe('email:guest@example.com');
    });

    it('falls back to an IP-keyed bucket when no usable email is present', async () => {
      const tracker = throttler!.getTracker!;
      // Guards run before validation pipes, so the body may be missing or
      // carry a non-string email at guard time.
      expect(
        await tracker({ body: {}, ip: '10.0.0.9' }, {} as ExecutionContext),
      ).toBe('noemail:10.0.0.9');
      expect(await tracker({}, {} as ExecutionContext)).toBe('noemail:unknown');
      expect(
        await tracker(
          { body: { guestEmail: 42 }, ip: '10.0.0.9' },
          {} as ExecutionContext,
        ),
      ).toBe('noemail:10.0.0.9');
    });
  });
});
