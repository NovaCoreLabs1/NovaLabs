import { ConfigService } from '@nestjs/config';
import { PlanType } from '../enums/plan-type.enum';
import {
  DEFAULT_PAYMENT_TTL_MINUTES,
  BookingExpiryPolicy,
} from './booking-expiry.policy';

function policyWithEnv(env: Record<string, string> = {}): BookingExpiryPolicy {
  const configService = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  return new BookingExpiryPolicy(configService);
}

describe('BookingExpiryPolicy', () => {
  describe('deadlineFor', () => {
    it('applies the documented default TTL per plan', () => {
      const policy = policyWithEnv();
      const from = new Date('2026-01-01T10:00:00.000Z');

      expect(policy.deadlineFor(PlanType.DAILY, from).getTime()).toBe(
        from.getTime() + 60 * 60_000,
      );
      expect(policy.deadlineFor(PlanType.WEEKLY, from).getTime()).toBe(
        from.getTime() + 360 * 60_000,
      );
      expect(policy.deadlineFor(PlanType.MONTHLY, from).getTime()).toBe(
        from.getTime() + 1440 * 60_000,
      );
      expect(policy.deadlineFor(PlanType.QUARTERLY, from).getTime()).toBe(
        from.getTime() + 2880 * 60_000,
      );
      expect(policy.deadlineFor(PlanType.YEARLY, from).getTime()).toBe(
        from.getTime() + 4320 * 60_000,
      );
    });

    it('defaults to now when no creation timestamp is given', () => {
      const policy = policyWithEnv();
      const before = Date.now();
      const deadline = policy.deadlineFor(PlanType.DAILY);
      expect(deadline.getTime()).toBeGreaterThanOrEqual(
        before + DEFAULT_PAYMENT_TTL_MINUTES[PlanType.DAILY] * 60_000 - 5,
      );
    });

    it('honours a valid env override per plan', () => {
      const policy = policyWithEnv({
        BOOKING_PAYMENT_TTL_DAILY_MINUTES: '30',
      });
      const from = new Date('2026-01-01T10:00:00.000Z');
      expect(policy.deadlineFor(PlanType.DAILY, from).getTime()).toBe(
        from.getTime() + 30 * 60_000,
      );
      // Other plans keep their defaults.
      expect(policy.deadlineFor(PlanType.WEEKLY, from).getTime()).toBe(
        from.getTime() + 360 * 60_000,
      );
    });

    it('ignores invalid env overrides (non-numeric, below one minute)', () => {
      const from = new Date('2026-01-01T10:00:00.000Z');

      const garbage = policyWithEnv({
        BOOKING_PAYMENT_TTL_DAILY_MINUTES: 'soon',
      });
      expect(garbage.deadlineFor(PlanType.DAILY, from).getTime()).toBe(
        from.getTime() + 60 * 60_000,
      );

      const zero = policyWithEnv({
        BOOKING_PAYMENT_TTL_DAILY_MINUTES: '0',
      });
      expect(zero.deadlineFor(PlanType.DAILY, from).getTime()).toBe(
        from.getTime() + 60 * 60_000,
      );
    });
  });

  describe('effectiveDeadline', () => {
    it('prefers the stamped paymentDeadline', () => {
      const policy = policyWithEnv();
      const stamped = new Date('2026-06-01T12:00:00.000Z');
      expect(
        policy.effectiveDeadline({
          planType: PlanType.DAILY,
          paymentDeadline: stamped,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ).toBe(stamped);
    });

    it('falls back to createdAt + plan TTL for legacy rows without a stamp', () => {
      const policy = policyWithEnv();
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      expect(
        policy
          .effectiveDeadline({
            planType: PlanType.MONTHLY,
            paymentDeadline: null,
            createdAt,
          })
          .getTime(),
      ).toBe(createdAt.getTime() + 1440 * 60_000);
    });
  });
});
