import { PricingService } from './pricing.service';
import { PlanType } from '../enums/plan-type.enum';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('calculateAmount', () => {
    const hourlyRate = 50000; // 500 Naira per hour in kobo

    it('calculates DAILY plan amount using actual calendar days', () => {
      // Jan 1 -> Jan 3 = 2 day diff, Math.ceil(2) = 2 days
      const amount = service.calculateAmount(
        hourlyRate,
        PlanType.DAILY,
        1,
        '2024-01-01',
        '2024-01-03',
      );
      // 50000 * 8h * 2 days * 1 seat = 800,000 kobo. No discount.
      expect(amount).toBe(800_000);
    });

    it('uses minimum of 1 day for same-day DAILY plan', () => {
      const amount = service.calculateAmount(
        hourlyRate,
        PlanType.DAILY,
        1,
        '2024-01-01',
        '2024-01-01',
      );
      // 50000 * 8h * 1 day * 1 seat = 400,000 kobo.
      expect(amount).toBe(400_000);
    });

    it('applies 5% WEEKLY discount', () => {
      const amount = service.calculateAmount(
        hourlyRate,
        PlanType.WEEKLY,
        1,
        '2024-01-01',
        '2024-01-05',
      );
      // 50000 * 8h * 5 days * 1 seat = 2,000,000 kobo. 5% off = 1,900,000.
      expect(amount).toBe(1_900_000);
    });

    it('applies 10% MONTHLY discount', () => {
      const amount = service.calculateAmount(
        hourlyRate,
        PlanType.MONTHLY,
        1,
        '2024-01-01',
        '2024-01-31',
      );
      // 50000 * 8h * 22 days * 1 seat = 8,800,000 kobo. 10% off = 7,920,000.
      expect(amount).toBe(7_920_000);
    });

    it('applies 15% QUARTERLY discount', () => {
      const amount = service.calculateAmount(
        hourlyRate,
        PlanType.QUARTERLY,
        1,
        '2024-01-01',
        '2024-03-31',
      );
      // 50000 * 8h * 66 days * 1 seat = 26,400,000 kobo. 15% off = 22,440,000.
      expect(amount).toBe(22_440_000);
    });

    it('applies 20% YEARLY discount', () => {
      const amount = service.calculateAmount(
        hourlyRate,
        PlanType.YEARLY,
        1,
        '2024-01-01',
        '2024-12-31',
      );
      // 50000 * 8h * 264 days * 1 seat = 105,600,000 kobo. 20% off = 84,480,000.
      expect(amount).toBe(84_480_000);
    });

    it('multiplies by seat count', () => {
      // Jan 1 -> Jan 2 = 1 day diff, Math.ceil(1) = 1 day
      const amount = service.calculateAmount(
        hourlyRate,
        PlanType.DAILY,
        3,
        '2024-01-01',
        '2024-01-02',
      );
      // 50000 * 8h * 1 day * 3 seats = 1,200,000 kobo.
      expect(amount).toBe(1_200_000);
    });

    it('floors the final amount', () => {
      const amount = service.calculateAmount(
        1, // 1 kobo per hour
        PlanType.YEARLY,
        1,
        '2024-01-01',
        '2024-12-31',
      );
      // 1 * 8h * 264 days * 1 seat = 2112 kobo. 20% off = 1689.6 -> floor = 1689.
      expect(amount).toBe(1689);
    });
  });

  describe('getPlanSummary', () => {
    it('returns DAILY summary', () => {
      const summary = service.getPlanSummary(PlanType.DAILY);
      expect(summary).toEqual({ days: 1, discountPct: 0 });
    });

    it('returns MONTHLY summary', () => {
      const summary = service.getPlanSummary(PlanType.MONTHLY);
      expect(summary).toEqual({ days: 22, discountPct: 10 });
    });

    it('returns YEARLY summary', () => {
      const summary = service.getPlanSummary(PlanType.YEARLY);
      expect(summary).toEqual({ days: 264, discountPct: 20 });
    });
  });
});
