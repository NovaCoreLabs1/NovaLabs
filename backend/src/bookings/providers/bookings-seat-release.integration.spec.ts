import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreatePublicDayPassProvider } from './create-public-day-pass.provider';
import { CreateBookingProvider } from './create-booking.provider';
import { BookingExpiryService } from './booking-expiry.service';
import { ReactivateExpiredBookingProvider } from './reactivate-expired-booking.provider';
import { BookingExpiryPolicy } from './booking-expiry.policy';
import { PricingService } from '../pricing/pricing.service';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { PaystackProvider } from '../../payments/providers/paystack.provider';
import { EmailService } from '../../email/email.service';
import { SeatAvailabilityProvider } from '../../workspaces/providers/seat-availability.provider';
import { BookingStatus } from '../enums/booking-status.enum';
import { PlanType } from '../enums/plan-type.enum';

/* ------------------------------------------------------------------ *
 * In-memory store + TypeORM-shaped fakes covering exactly the query
 * paths these providers use, so seat accounting is exercised against
 * real state transitions rather than hardcoded query-builder mocks.
 * ------------------------------------------------------------------ */

interface Row extends Record<string, unknown> {
  id: string;
  status?: string;
  workspaceId?: string;
  startDate?: string;
  endDate?: string;
  seatCount?: number;
  bookingId?: string;
}

class Store {
  workspaces: Array<Record<string, unknown>> = [];
  bookings: Row[] = [];
  payments: Row[] = [];
  private nextId = 1;

  uuid(): string {
    return `id-${this.nextId++}`;
  }

  addWorkspace(totalSeats: number): Record<string, unknown> {
    const ws = {
      id: this.uuid(),
      name: 'Hub West',
      isActive: true,
      totalSeats,
      hourlyRate: 10_000n,
    };
    this.workspaces.push(ws);
    return ws;
  }
}

/** Evaluates a known SQL predicate against a row. */
function matches(
  row: Row,
  sql: string,
  params: Record<string, unknown>,
): boolean {
  const p = params as Record<string, string | string[]>;
  if (sql.includes('b.workspaceId = :workspaceId'))
    return row.workspaceId === p.workspaceId;
  if (sql.includes('w.id = :id')) return row.id === p.id;
  if (sql.includes('b.status IN (:...statuses)'))
    return (p.statuses as string[]).includes(row.status as string);
  if (sql.includes('b.startDate <= :date')) return row.startDate! <= p.date;
  if (sql.includes('b.startDate <= :endDate'))
    return row.startDate! <= p.endDate;
  if (sql.includes('b.endDate >= :date')) return row.endDate! >= p.date;
  if (sql.includes('b.endDate >= :startDate'))
    return row.endDate! >= p.startDate;
  if (sql.includes('b.id != :excludedId')) return row.id !== p.excludedId;
  if (sql.includes('status = :status')) return row.status === p.status;
  if (sql.startsWith('id IN (:...ids)'))
    return (p.ids as string[]).includes(row.id);
  if (sql.includes('"bookingId" IN (:...ids)'))
    return (p.ids as string[]).includes(row.bookingId!);
  throw new Error(`Unhandled predicate in fake: ${sql}`);
}

class FakeQueryBuilder {
  private payload?: Record<string, unknown>;
  private conditions: Array<{ sql: string; params: Record<string, unknown> }> =
    [];
  private selectExpr = '';

  constructor(private readonly store: Store) {}

  // --- entity SELECT paths -------------------------------------------
  setLock(): this {
    return this;
  }

  select(expr: string): this {
    this.selectExpr = expr;
    return this;
  }

  where(sql: string, params: Record<string, unknown> = {}): this {
    this.conditions.push({ sql, params });
    return this;
  }

  andWhere(sql: string, params: Record<string, unknown> = {}): this {
    return this.where(sql, params);
  }

  async getOne(): Promise<unknown> {
    return (
      this.store.workspaces.find((ws) =>
        this.conditions.every((c) => matches(ws as Row, c.sql, c.params)),
      ) ?? null
    );
  }

  async getRawOne(): Promise<{ booked: string }> {
    if (!this.selectExpr.startsWith('COALESCE(SUM(b.seatCount)')) {
      throw new Error(`Unexpected select in fake: ${this.selectExpr}`);
    }
    const booked = this.store.bookings
      .filter((b) => this.conditions.every((c) => matches(b, c.sql, c.params)))
      .reduce((sum, b) => sum + (b.seatCount ?? 0), 0);
    return { booked: String(booked) };
  }

  // --- UPDATE chain ---------------------------------------------------
  update(): this {
    return this;
  }

  set(payload: Record<string, unknown>): this {
    this.payload = payload;
    return this;
  }

  async execute(): Promise<{ affected: number | null }> {
    const isBookingUpdate = this.conditions.some((c) =>
      c.sql.startsWith('id IN'),
    );
    const rows = isBookingUpdate ? this.store.bookings : this.store.payments;
    let affected = 0;
    for (const row of rows) {
      if (this.conditions.every((c) => matches(row, c.sql, c.params))) {
        Object.assign(row, this.payload);
        affected += 1;
      }
    }
    return { affected };
  }
}

function makeManager(store: Store): EntityManagerLike {
  return {
    findOne: jest.fn(
      async (target: unknown, criteria: { where: { id: string } }) => {
        if (target === (Booking as unknown)) {
          return store.bookings.find((b) => b.id === criteria.where.id) ?? null;
        }
        return null;
      },
    ),
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    })),
    createQueryBuilder: jest.fn(() => new FakeQueryBuilder(store)),
    create: jest.fn((_target: unknown, partial: Record<string, unknown>) => ({
      ...partial,
    })),
    save: jest.fn(async (entity: Row) => {
      const bucket = 'planType' in entity ? store.bookings : store.payments;
      if (!entity.id) {
        entity.id = store.uuid();
        bucket.push(entity);
      }
      return entity;
    }),
  } as unknown as EntityManagerLike;
}

interface EntityManagerLike {
  findOne: (...args: unknown[]) => Promise<unknown>;
  getRepository: (...args: unknown[]) => unknown;
  createQueryBuilder: (target?: new () => unknown) => FakeQueryBuilder;
  create: (...args: unknown[]) => Row;
  save: (entity: Row) => Promise<Row>;
}

describe('Seat release lifecycle (issue #230)', () => {
  const DAY = '2030-01-15';
  let store: Store;
  let module: TestingModule;
  let dayPassProvider: CreatePublicDayPassProvider;
  let expiryService: BookingExpiryService;
  let reactivateProvider: ReactivateExpiredBookingProvider;

  beforeEach(async () => {
    store = new Store();
    store.addWorkspace(3);

    module = await Test.createTestingModule({
      providers: [
        CreatePublicDayPassProvider,
        CreateBookingProvider,
        SeatAvailabilityProvider,
        BookingExpiryService,
        ReactivateExpiredBookingProvider,
        BookingExpiryPolicy,
        {
          provide: PricingService,
          useValue: { calculateAmount: () => 10_000 },
        },
        {
          provide: PaystackProvider,
          useValue: {
            initializeTransaction: jest.fn().mockResolvedValue({
              reference: 'ref',
              authorization_url: 'https://paystack.test/authorize',
            }),
          },
        },
        { provide: EmailService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: () => 'http://cb.test' },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: {
            find: async (options: { where: Record<string, unknown> }) =>
              store.bookings.filter(
                (b) =>
                  b.status === options.where.status &&
                  b.planType === options.where.planType,
              ),
          },
        },
        { provide: getRepositoryToken(Payment), useValue: {} },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: async () => null },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: async (
              fn: (m: EntityManagerLike) => Promise<unknown>,
            ) => fn(makeManager(store)),
          },
        },
      ],
    }).compile();

    dayPassProvider = module.get(CreatePublicDayPassProvider);
    expiryService = module.get(BookingExpiryService);
    reactivateProvider = module.get(ReactivateExpiredBookingProvider);
  });

  function dto(guestEmail: string) {
    return {
      workspaceId: store.workspaces[0].id as string,
      date: DAY,
      guestName: 'Guest',
      guestEmail,
      guestPhone: '000',
    };
  }

  it('abandoned day-passes hold seats until the sweep runs, then release them', async () => {
    // Three abandoned checkouts exhaust the 3-seat workspace…
    const first = await dayPassProvider.create(dto('a@e.com'));
    await dayPassProvider.create(dto('b@e.com'));
    await dayPassProvider.create(dto('c@e.com'));
    expect(store.bookings.map((b) => b.status)).toEqual([
      BookingStatus.PENDING,
      BookingStatus.PENDING,
      BookingStatus.PENDING,
    ]);
    // Creation stamps an absolute payment deadline.
    const firstRow = store.bookings.find((b) => b.id === first.bookingId)!;
    expect(firstRow.paymentDeadline).toBeInstanceOf(Date);
    expect((firstRow.paymentDeadline as Date).getTime()).toBeGreaterThan(
      Date.now(),
    );

    await expect(dayPassProvider.create(dto('d@e.com'))).rejects.toThrow(
      ConflictException,
    );

    // …time passes beyond the DAILY TTL…
    const past = new Date(Date.now() - 120_000);
    store.bookings.forEach((b) => (b.paymentDeadline = past));

    // …the sweep expires them and releases their dead payments…
    const result = await expiryService.expireStalePendingBookings();
    expect(result).toEqual({ expiredBookings: 3, releasedPayments: 3 });
    expect(
      store.bookings.every((b) => b.status === BookingStatus.EXPIRED),
    ).toBe(true);
    expect(store.payments.every((p) => p.status === 'failed')).toBe(true);

    // …re-running the sweep is a no-op (cron idempotency)…
    const secondRun = await expiryService.expireStalePendingBookings();
    expect(secondRun).toEqual({ expiredBookings: 0, releasedPayments: 0 });

    // …and a legitimate booking succeeds again.
    const lateBooking = await dayPassProvider.create(dto('legit@e.com'));
    expect(lateBooking.bookingId).toBeDefined();
  });

  it('the authenticated creation path also ignores EXPIRED seats', async () => {
    await dayPassProvider.create(dto('a@e.com'));
    await dayPassProvider.create(dto('b@e.com'));
    await dayPassProvider.create(dto('c@e.com'));

    const past = new Date(Date.now() - 120_000);
    store.bookings.forEach((b) => (b.paymentDeadline = past));
    await expiryService.expireStalePendingBookings();

    const createBookingProvider = module.get(CreateBookingProvider);
    const booking = (await (
      createBookingProvider as CreateBookingProvider
    ).create(
      {
        workspaceId: store.workspaces[0].id as string,
        planType: PlanType.WEEKLY,
        startDate: DAY,
        endDate: '2030-01-20',
        seatCount: 1,
      },
      'user-1',
    )) as Booking;

    expect(booking.status).toBe(BookingStatus.PENDING);
    expect(store.bookings).toHaveLength(4);
  });

  it('a paid-but-expired booking revives only while seats remain', async () => {
    await dayPassProvider.create(dto('a@e.com'));
    await dayPassProvider.create(dto('b@e.com'));
    await dayPassProvider.create(dto('c@e.com'));

    const past = new Date(Date.now() - 120_000);
    store.bookings.forEach((b) => (b.paymentDeadline = past));
    await expiryService.expireStalePendingBookings();

    // One fresh booking takes a seat (the legitimate customer).
    await dayPassProvider.create(dto('legit@e.com'));

    // Guest A pays minutes too late; seats are still free (the fresh PENDING
    // holds one of three) → booking revives to CONFIRMED.
    const revivedA = await reactivateProvider.reactivateExpired(
      store.bookings[0].id,
    );
    expect(revivedA?.status).toBe(BookingStatus.CONFIRMED);

    // One more booking fills the workspace again (A + fresh + this one).
    await dayPassProvider.create(dto('e@e.com'));

    // Guest B pays even later — workspace is full → payment recorded
    // without honouring the booking (null), booking stays EXPIRED.
    const guestB = store.bookings[1];
    const outcomeB = await reactivateProvider.reactivateExpired(guestB.id);
    expect(outcomeB).toBeNull();
    expect(guestB.status).toBe(BookingStatus.EXPIRED);
  });
});
