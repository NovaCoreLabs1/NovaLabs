import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { CheckWorkspaceAvailabilityProvider } from './check-workspace-availability.provider';
import { SeatAvailabilityProvider } from './seat-availability.provider';
import { FindWorkspaceByIdProvider } from './find-workspace-by-id.provider';
import { CreatePublicDayPassProvider } from '../../bookings/providers/create-public-day-pass.provider';
import { CreateBookingProvider } from '../../bookings/providers/create-booking.provider';
import { BookingExpiryPolicy } from '../../bookings/providers/booking-expiry.policy';
import { PricingService } from '../../bookings/pricing/pricing.service';
import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../entities/workspace.entity';
import { PaystackProvider } from '../../payments/providers/paystack.provider';
import { EmailService } from '../../email/email.service';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import { PlanType } from '../../bookings/enums/plan-type.enum';

/* ------------------------------------------------------------------ *
 * Issue #229 — one seat-math routine serves booking creation AND the
 * availability endpoint. These specs run both paths against a shared
 * in-memory store whose query builder understands exactly the SQL
 * fragments the production code emits, so the numbers the endpoint
 * reports are derived from the same state creation writes.
 *
 * Concurrency note: real PostgreSQL serializes competing creations on
 * the pessimistic_write lock taken on the workspace row. The fake
 * mirrors that guarantee by chaining transactions so each runs to
 * completion before the next begins, keeping interleavings
 * deterministic while preserving the invariant under test.
 * ------------------------------------------------------------------ */

interface Row extends Record<string, unknown> {
  id: string;
  status?: string;
  workspaceId?: string;
  startDate?: string;
  endDate?: string;
  seatCount?: number;
}

class Store {
  workspaces: Array<Record<string, unknown>> = [];
  bookings: Row[] = [];
  payments: Row[] = [];
  private nextId = 1;

  uuid(): string {
    return `id-${this.nextId++}`;
  }

  addWorkspace(
    totalSeats: number,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const ws = {
      id: this.uuid(),
      name: 'Hub Central',
      isActive: true,
      totalSeats,
      hourlyRate: 10_000n,
      ...overrides,
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
  if (sql.includes('b.workspaceId = :workspaceId'))
    return row.workspaceId === params.workspaceId;
  if (sql.includes('w.id = :id')) return row.id === params.id;
  if (sql.includes('b.status IN (:...statuses)'))
    return (params.statuses as string[]).includes(row.status as string);
  if (sql.includes('b.startDate <= :endDate'))
    return row.startDate! <= (params.endDate as string);
  if (sql.includes('b.endDate >= :startDate'))
    return row.endDate! >= (params.startDate as string);
  throw new Error(`Unhandled predicate in fake: ${sql}`);
}

class FakeQueryBuilder {
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
}

type ManagerLike = ReturnType<typeof makeManager>;

function makeManager(store: Store): {
  createQueryBuilder: () => FakeQueryBuilder;
  create: (_target: unknown, partial: Record<string, unknown>) => Row;
  save: (entity: Row) => Promise<Row>;
} {
  return {
    createQueryBuilder: () => new FakeQueryBuilder(store),
    create: (_target: unknown, partial: Record<string, unknown>): Row =>
      ({ ...partial }) as Row,
    save: async (entity: Row) => {
      const bucket = 'planType' in entity ? store.bookings : store.payments;
      if (!entity.id) {
        entity.id = store.uuid();
        bucket.push(entity);
      }
      return entity;
    },
  };
}

describe('Workspace availability from live bookings (issue #229)', () => {
  const WORKSPACE_WINDOW = {
    startDate: '2030-01-15',
    endDate: '2030-01-17',
  };
  let store: Store;
  let module: TestingModule;
  let availability: CheckWorkspaceAvailabilityProvider;
  let createBooking: CreateBookingProvider;
  let createDayPass: CreatePublicDayPassProvider;

  beforeEach(async () => {
    store = new Store();
    store.addWorkspace(3);

    // Transactions serialize on the (fake) workspace row lock.
    let chain: Promise<unknown> = Promise.resolve();
    const fakeDataSource = {
      manager: makeManager(store),
      transaction: (fn: (m: ManagerLike) => Promise<unknown>) => {
        const run = chain.then(() => fn(makeManager(store)));
        chain = run.catch(() => undefined);
        return run;
      },
    };

    module = await Test.createTestingModule({
      providers: [
        CheckWorkspaceAvailabilityProvider,
        SeatAvailabilityProvider,
        CreateBookingProvider,
        CreatePublicDayPassProvider,
        BookingExpiryPolicy,
        {
          provide: FindWorkspaceByIdProvider,
          useValue: {
            findById: async (id: string) =>
              store.workspaces.find((ws) => ws.id === id),
          },
        },
        {
          provide: PricingService,
          useValue: { calculateAmount: () => 10_000 },
        },
        { provide: EmailService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: () => 'http://cb.test' },
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
        { provide: getRepositoryToken(Workspace), useValue: {} },
        {
          provide: getRepositoryToken(Booking),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {},
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: async () => null },
        },
        {
          provide: DataSource,
          useValue: fakeDataSource,
        },
      ],
    }).compile();

    availability = module.get(CheckWorkspaceAvailabilityProvider);
    createBooking = module.get(CreateBookingProvider);
    createDayPass = module.get(CreatePublicDayPassProvider);
  });

  function authDto(seatCount: number, window = WORKSPACE_WINDOW) {
    return {
      workspaceId: store.workspaces[0].id as string,
      planType: PlanType.WEEKLY,
      startDate: window.startDate,
      endDate: window.endDate,
      seatCount,
    };
  }

  function dayPassDto(guestEmail: string) {
    return {
      workspaceId: store.workspaces[0].id as string,
      date: WORKSPACE_WINDOW.startDate,
      guestName: 'Guest',
      guestEmail,
      guestPhone: '000',
    };
  }

  it('a created booking drops availability by exactly seatCount for overlapping dates and restores it outside the window', async () => {
    await createBooking.create(authDto(2), 'user-1');

    // Overlapping single day inside the booked range: 2 of 3 held.
    const mid = await availability.check(store.workspaces[0].id as string, 1, {
      startDate: '2030-01-16',
      endDate: '2030-01-16',
    });
    expect(mid.availableSeats).toBe(1);
    expect(mid.available).toBe(true);

    // Requesting more than remain is refused with the live remainder.
    const over = await availability.check(store.workspaces[0].id as string, 2, {
      startDate: '2030-01-15',
      endDate: '2030-01-17',
    });
    expect(over.available).toBe(false);
    expect(over.availableSeats).toBe(1);
    expect(over.message).toBe('Only 1 seats available');

    // Non-overlapping dates see full capacity again.
    const later = await availability.check(
      store.workspaces[0].id as string,
      1,
      {
        startDate: '2030-01-20',
        endDate: '2030-01-21',
      },
    );
    expect(later.availableSeats).toBe(3);
    expect(later.available).toBe(true);
  });

  it('both PENDING and CONFIRMED bookings hold seats', async () => {
    await createBooking.create(authDto(1), 'user-1');
    const pending = store.bookings[0];
    expect(pending.status).toBe(BookingStatus.PENDING);

    pending.status = BookingStatus.CONFIRMED;

    const result = await availability.check(
      store.workspaces[0].id as string,
      1,
      WORKSPACE_WINDOW,
    );
    expect(result.availableSeats).toBe(2);
  });

  it('inactive workspaces report unavailable without consulting bookings', async () => {
    store.addWorkspace(5, { isActive: false });

    const result = await availability.check(
      store.workspaces[1].id as string,
      1,
    );
    expect(result).toEqual({
      available: false,
      availableSeats: 0,
      totalSeats: 5,
      message: 'Workspace is not active',
    });
    expect(store.bookings).toHaveLength(0);
  });

  it('rejects malformed windows and non-positive seat requests', async () => {
    const id = store.workspaces[0].id as string;
    await expect(
      availability.check(id, 1, { startDate: '15-01-2030' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      availability.check(id, 1, {
        startDate: '2030-01-20',
        endDate: '2030-01-10',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(availability.check(id, 0)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('parallel creations agree with the endpoint on the final seat balance', async () => {
    // Five simultaneous single-seat day-passes race for three seats.
    const attempts = ['a@e.com', 'b@e.com', 'c@e.com', 'd@e.com', 'e@e.com'];
    const outcomes = await Promise.allSettled(
      attempts.map((email) => createDayPass.create(dayPassDto(email))),
    );

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter(
      (o) => o.status === 'rejected' && o.reason instanceof ConflictException,
    );

    // Creation enforced capacity: exactly three seats were handed out.
    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(2);

    // The endpoint derives the SAME balance from the stored bookings.
    const after = await availability.check(
      store.workspaces[0].id as string,
      1,
      WORKSPACE_WINDOW,
    );
    expect(after.availableSeats).toBe(0);
    expect(after.available).toBe(false);

    // Independent recomputation from raw rows agrees with the endpoint.
    const held = store.bookings
      .filter(
        (b) =>
          (b.status === BookingStatus.PENDING ||
            b.status === BookingStatus.CONFIRMED) &&
          b.startDate! <= WORKSPACE_WINDOW.endDate &&
          b.endDate! >= WORKSPACE_WINDOW.startDate,
      )
      .reduce((sum, b) => sum + (b.seatCount ?? 0), 0);
    expect(held).toBe(3);
    expect(after.totalSeats - held).toBe(after.availableSeats);
  });
});

describe('static boundaries: no stored availability counter remains (#229)', () => {
  const backendSrc = path.join(__dirname, '..', '..');

  function listTsFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory()
        ? listTsFiles(p)
        : e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')
          ? [p]
          : [];
    });
  }

  it('the Workspace entity declares no availableSeats column', () => {
    const entity = fs.readFileSync(
      path.join(backendSrc, 'workspaces', 'entities', 'workspace.entity.ts'),
      'utf8',
    );
    expect(entity).not.toContain('availableSeats');
  });

  it('no backend module reads a stored workspace availability counter', () => {
    const offenders = listTsFiles(backendSrc).filter((f) => {
      const content = fs.readFileSync(f, 'utf8');
      return /\b(workspace|ws|w)\.availableSeats\b/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});
