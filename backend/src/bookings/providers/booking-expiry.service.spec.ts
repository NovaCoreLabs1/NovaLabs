import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';
import { PlanType } from '../enums/plan-type.enum';
import { BookingExpiryPolicy } from './booking-expiry.policy';
import { BookingExpiryService } from './booking-expiry.service';

function bookingRow(overrides: Partial<Booking> = {}): Booking {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    workspaceId: 'ws-1',
    userId: null,
    planType: PlanType.DAILY,
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    totalAmount: 10_000,
    status: BookingStatus.PENDING,
    seatCount: 1,
    notes: null,
    sorobanEscrowId: null,
    reminderSent: false,
    isGuestBooking: true,
    guestInfo: { name: 'G', email: 'g@e.com', phone: '0' },
    paymentDeadline: new Date(Date.now() - 60_000), // already past
    createdAt: new Date(),
    updatedAt: new Date(),
    hubId: null,
    ...overrides,
  } as unknown as Booking;
}

/** Records update chains so tests can assert the exact guard predicates. */
class RecordedUpdateChain {
  target?: new () => unknown;
  setPayload?: Record<string, unknown>;
  conditions: Array<{ sql: string; params?: Record<string, unknown> }> = [];
  affected: number | null = null;

  constructor(private readonly sequence: number[]) {}

  update(target: new () => unknown): this {
    this.target = target;
    return this;
  }

  set(payload: Record<string, unknown>): this {
    this.setPayload = payload;
    return this;
  }

  where(sql: string, params?: Record<string, unknown>): this {
    this.conditions.push({ sql, params });
    return this;
  }

  andWhere(sql: string, params?: Record<string, unknown>): this {
    return this.where(sql, params);
  }

  async execute(): Promise<{ affected: number | null }> {
    this.affected = this.sequence.length ? (this.sequence.shift() ?? 0) : 0;
    return { affected: this.affected };
  }

  sql(): string {
    return this.conditions.map((c) => c.sql).join(' AND ');
  }
}

describe('BookingExpiryService', () => {
  let service: BookingExpiryService;
  let bookingsRepository: { find: jest.Mock };
  let transaction: jest.Mock;
  /** One array of affected-counts per transaction call (booking, payments). */
  let affectedPerTransaction: number[][];
  let capturedManagers: RecordedUpdateChain[][];

  beforeEach(async () => {
    bookingsRepository = { find: jest.fn().mockResolvedValue([]) };
    affectedPerTransaction = [];
    capturedManagers = [];
    transaction = jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
      const chains: RecordedUpdateChain[] = [];
      capturedManagers.push(chains);
      // First array element = booking update count, second = payment release.
      const sequence = affectedPerTransaction.shift() ?? [];
      const manager = {
        createQueryBuilder: () => {
          const chain = new RecordedUpdateChain(sequence);
          chains.push(chain);
          return chain;
        },
      };
      return fn(manager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingExpiryService,
        { provide: getRepositoryToken(Booking), useValue: bookingsRepository },
        { provide: getRepositoryToken(Payment), useValue: {} },
        {
          provide: BookingExpiryPolicy,
          useValue: new BookingExpiryPolicy({
            get: () => undefined,
          } as unknown as ConfigService),
        },
        { provide: DataSource, useValue: { transaction } },
      ],
    }).compile();

    service = module.get<BookingExpiryService>(BookingExpiryService);
  });

  it('expires stale PENDING bookings and releases their pending payments with guarded updates', async () => {
    const staleDaily = bookingRow({ id: 'stale-daily' });
    // A MONTHLY booking whose stamped deadline is still in the future must
    // not be expired even though its plan batch runs.
    const freshMonthly = bookingRow({
      id: 'fresh-monthly',
      planType: PlanType.MONTHLY,
      paymentDeadline: new Date(Date.now() + 3_600_000),
    });

    bookingsRepository.find.mockImplementation(({ where }) => {
      if (where.planType === PlanType.DAILY)
        return Promise.resolve([staleDaily]);
      if (where.planType === PlanType.MONTHLY)
        return Promise.resolve([freshMonthly]);
      return Promise.resolve([]);
    });
    affectedPerTransaction = [[1, 2]]; // one transaction: 1 booking expired, 2 payments released

    const result = await service.expireStalePendingBookings();

    expect(result).toEqual({ expiredBookings: 1, releasedPayments: 2 });

    const [bookingUpdate, paymentUpdate] = capturedManagers[0];
    expect(bookingUpdate.target).toBe(Booking);
    expect(bookingUpdate.setPayload).toEqual({ status: BookingStatus.EXPIRED });
    expect(bookingUpdate.sql()).toContain('id IN (:...ids)');
    // The status guard is what makes a concurrent webhook confirmation win.
    expect(bookingUpdate.sql()).toContain('status = :status');

    expect(paymentUpdate.target).toBe(Payment);
    expect(paymentUpdate.setPayload).toEqual({ status: PaymentStatus.FAILED });
    expect(paymentUpdate.sql()).toContain('"bookingId" IN (:...ids)');
    expect(paymentUpdate.sql()).toContain('status = :status');
  });

  /** Repo stub honouring the planType filter the sweep passes in. */
  function givenPendingBookings(rows: Booking[]) {
    bookingsRepository.find.mockImplementation(({ where }) =>
      Promise.resolve(rows.filter((row) => row.planType === where.planType)),
    );
  }

  it('is idempotent: a re-run over already-expired rows changes nothing', async () => {
    // After the first sweep the rows are EXPIRED, so find(PENDING) matches none.
    givenPendingBookings([]);

    const result = await service.expireStalePendingBookings();

    expect(result).toEqual({ expiredBookings: 0, releasedPayments: 0 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('skips PENDING bookings whose effective deadline has not passed', async () => {
    givenPendingBookings([
      bookingRow({
        id: 'fresh',
        paymentDeadline: new Date(Date.now() + 600_000),
      }),
    ]);

    const result = await service.expireStalePendingBookings();

    expect(result).toEqual({ expiredBookings: 0, releasedPayments: 0 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('expires legacy rows without a stamped deadline using createdAt + plan TTL', async () => {
    givenPendingBookings([
      bookingRow({
        id: 'legacy',
        paymentDeadline: null,
        createdAt: new Date(Date.now() - 5 * 3_600_000), // 5h old, DAILY TTL = 60min
      }),
    ]);
    affectedPerTransaction = [[1, 1]]; // one transaction: 1 booking expired, then 1 payment released

    const result = await service.expireStalePendingBookings();

    expect(result).toEqual({ expiredBookings: 1, releasedPayments: 1 });
  });

  it('keeps legacy rows that are younger than their plan TTL', async () => {
    givenPendingBookings([
      bookingRow({
        id: 'young-legacy',
        paymentDeadline: null,
        createdAt: new Date(Date.now() - 30 * 60_000), // 30min old
      }),
    ]);

    const result = await service.expireStalePendingBookings();

    expect(result).toEqual({ expiredBookings: 0, releasedPayments: 0 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('reports zero when no PENDING bookings exist at all', async () => {
    givenPendingBookings([]);

    const result = await service.expireStalePendingBookings();

    expect(result).toEqual({ expiredBookings: 0, releasedPayments: 0 });
  });

  it('never throws from the cron entry point', async () => {
    bookingsRepository.find.mockRejectedValue(new Error('db down'));

    await expect(service.sweepAbandonedBookings()).resolves.toBeUndefined();
  });
});
