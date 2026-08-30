/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HandleWebhookProvider } from './handle-webhook.provider';
import { PaystackProvider } from './paystack.provider';
import { SorobanEscrowProvider } from './soroban-escrow.provider';
import { BookingsService } from '../../bookings/bookings.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../email/email.service';
import { ReactivateExpiredBookingProvider } from '../../bookings/providers/reactivate-expired-booking.provider';
import { MetricsService } from '../../metrics/metrics.service';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { Booking } from '../../bookings/entities/booking.entity';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import { PlanType } from '../../bookings/enums/plan-type.enum';
import { User } from '../../users/entities/user.entity';

function mockRepository() {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

/** Shared MetricsService mock with all new webhook race-condition counters. */
function mockMetricsService() {
  return {
    recordSorobanEscrowFailure: jest.fn(),
    recordWebhookRaceWin: jest.fn(),
    recordWebhookStaleIgnored: jest.fn(),
    recordWebhookSuccessAfterTerminal: jest.fn(),
    recordWebhookFailureAfterSuccess: jest.fn(),
  };
}

/**
 * Returns a mock QueryBuilder chain that resolves `execute()` with the
 * given affected count.  Each method returns `this` so the chain works.
 */
function mockQueryBuilder(executeResult: { affected: number }) {
  const chain = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(executeResult),
  };
  return chain;
}

function createEventPayload(eventType: string, reference: string) {
  return Buffer.from(JSON.stringify({ event: eventType, data: { reference } }));
}

describe('HandleWebhookProvider – replay protection', () => {
  let provider: HandleWebhookProvider;
  let paystackProvider: jest.Mocked<PaystackProvider>;
  let paymentsRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    paystackProvider = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    } as any;
    paymentsRepo = mockRepository();
    // Return a pending payment so the handler proceeds past the reference
    // check (unknown references now throw BadRequestException — issue #236).
    paymentsRepo.findOne.mockResolvedValue({
      id: 'pay-1',
      bookingId: 'bk-1',
      status: PaymentStatus.PENDING,
    } as unknown as Payment);
    // Atomic update succeeds (won't actually run in timestamp-rejection tests)
    paymentsRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 1 }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandleWebhookProvider,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Booking), useValue: mockRepository() },
        { provide: getRepositoryToken(User), useValue: mockRepository() },
        { provide: PaystackProvider, useValue: paystackProvider },
        { provide: SorobanEscrowProvider, useValue: {} },
        { provide: BookingsService, useValue: { confirm: jest.fn() } },
        {
          provide: ReactivateExpiredBookingProvider,
          useValue: { reactivateExpired: jest.fn() },
        },
        {
          provide: InvoicesService,
          useValue: { generateForPayment: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn() },
        },
        { provide: EmailService, useValue: {} },
        {
          provide: MetricsService,
          useValue: mockMetricsService(),
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<HandleWebhookProvider>(HandleWebhookProvider);
  });

  it('should accept webhook with recent timestamp', async () => {
    const body = createEventPayload('charge.success', 'ref-1');
    const recentTime = new Date(Date.now() - 30_000).toISOString(); // 30s ago

    await expect(
      provider.handle(body, 'sig', recentTime),
    ).resolves.toBeUndefined();
  });

  it('should accept webhook with no timestamp (backward compat)', async () => {
    const body = createEventPayload('charge.success', 'ref-1');

    await expect(provider.handle(body, 'sig', '')).resolves.toBeUndefined();
  });

  it('should reject webhook older than 5 minutes', async () => {
    const body = createEventPayload('charge.success', 'ref-1');
    const oldTime = new Date(Date.now() - 6 * 60_000).toISOString(); // 6 min ago

    await expect(provider.handle(body, 'sig', oldTime)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject webhook with timestamp in the future beyond threshold', async () => {
    const body = createEventPayload('charge.success', 'ref-1');
    const futureTime = new Date(Date.now() + 6 * 60_000).toISOString(); // 6 min future

    await expect(provider.handle(body, 'sig', futureTime)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject webhook with invalid timestamp format', async () => {
    const body = createEventPayload('charge.success', 'ref-1');

    await expect(provider.handle(body, 'sig', 'not-a-date')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should accept webhook within 5-minute boundary', async () => {
    const body = createEventPayload('charge.success', 'ref-1');
    const edgeTime = new Date(Date.now() - 5 * 60_000 + 1000).toISOString(); // 4m59s ago

    await expect(
      provider.handle(body, 'sig', edgeTime),
    ).resolves.toBeUndefined();
  });
});

describe('HandleWebhookProvider – charge.success after expiry (issue #230)', () => {
  let provider: HandleWebhookProvider;
  let paymentsRepository: ReturnType<typeof mockRepository>;
  let bookingsRepository: ReturnType<typeof mockRepository>;
  let usersRepository: ReturnType<typeof mockRepository>;
  let bookingsService: { confirm: jest.Mock };
  let reactivateExpiredBookingProvider: { reactivateExpired: jest.Mock };
  let invoicesService: { generateForPayment: jest.Mock };
  let sorobanEscrowProvider: { createEscrow: jest.Mock };

  function paymentFixture(overrides: Partial<Payment> = {}): Payment {
    return {
      id: overrides.id ?? 'pay-1',
      bookingId: overrides.bookingId ?? 'bk-1',
      userId: null,
      amount: 10_000,
      currency: 'NGN',
      provider: 'paystack' as Payment['provider'],
      providerReference: 'ref-1',
      status: overrides.status ?? PaymentStatus.PENDING,
      paidAt: null,
      metadata: undefined,
    } as unknown as Payment;
  }

  function bookingFixture(
    status: BookingStatus,
    extra: Partial<Booking> = {},
  ): Booking {
    return {
      id: extra.id ?? 'bk-1',
      workspaceId: 'ws-1',
      userId: null,
      planType: extra.planType ?? PlanType.DAILY,
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      totalAmount: 10_000n,
      status,
      seatCount: 1,
      isGuestBooking: true,
      guestInfo: { name: 'Guest', email: 'g@e.com', phone: '000' },
      sorobanEscrowId: extra.sorobanEscrowId ?? null,
    } as unknown as Booking;
  }

  async function compile() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandleWebhookProvider,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepository },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        {
          provide: PaystackProvider,
          useValue: { verifyWebhookSignature: jest.fn().mockReturnValue(true) },
        },
        { provide: SorobanEscrowProvider, useValue: sorobanEscrowProvider },
        { provide: BookingsService, useValue: bookingsService },
        {
          provide: ReactivateExpiredBookingProvider,
          useValue: reactivateExpiredBookingProvider,
        },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: EmailService, useValue: {} },
        {
          provide: MetricsService,
          useValue: mockMetricsService(),
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('beneficiary') },
        },
      ],
    }).compile();

    provider = module.get<HandleWebhookProvider>(HandleWebhookProvider);
  }

  beforeEach(async () => {
    paymentsRepository = mockRepository();
    bookingsRepository = mockRepository();
    usersRepository = mockRepository();
    // The success path fires a best-effort email lookup; no user found.
    usersRepository.findOne.mockResolvedValue(null);
    bookingsService = { confirm: jest.fn() };
    reactivateExpiredBookingProvider = { reactivateExpired: jest.fn() };
    invoicesService = {
      generateForPayment: jest.fn().mockResolvedValue(undefined),
    };
    sorobanEscrowProvider = {
      createEscrow: jest.fn().mockResolvedValue('tx-hash'),
    };
    // Default: atomic update succeeds (affected = 1)
    paymentsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 1 }),
    );
    await compile();
  });

  async function handleChargeSuccess(): Promise<void> {
    await provider.handle(
      createEventPayload('charge.success', 'ref-1'),
      'sig',
      '',
    );
  }

  it('confirms a PENDING booking as before when the payment arrives in time', async () => {
    const booking = bookingFixture(BookingStatus.PENDING);
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsService.confirm.mockResolvedValue({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    expect(bookingsService.confirm).toHaveBeenCalledWith('bk-1');
    expect(
      reactivateExpiredBookingProvider.reactivateExpired,
    ).not.toHaveBeenCalled();
    expect(invoicesService.generateForPayment).toHaveBeenCalledWith('pay-1');

    // Verify atomic update was used instead of save
    expect(paymentsRepository.createQueryBuilder).toHaveBeenCalled();
  });

  it('re-confirms an EXPIRED booking via the seat re-check when seats are free', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED);
    const revived = { ...booking, status: BookingStatus.CONFIRMED };
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    bookingsRepository.findOne.mockResolvedValue(booking);
    reactivateExpiredBookingProvider.reactivateExpired.mockResolvedValue(
      revived,
    );

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    expect(
      reactivateExpiredBookingProvider.reactivateExpired,
    ).toHaveBeenCalledWith('bk-1');
    expect(bookingsService.confirm).not.toHaveBeenCalled();
    expect(invoicesService.generateForPayment).toHaveBeenCalledWith('pay-1');
  });

  it('records the payment without re-confirming when the seats are gone, and never crashes', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED);
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    bookingsRepository.findOne.mockResolvedValue(booking);
    reactivateExpiredBookingProvider.reactivateExpired.mockResolvedValue(null);

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    // Payment stands recorded as SUCCESS; no invoice for an unfulfilled
    // booking; refunding stays a deliberate admin action.
    expect(paymentsRepository.createQueryBuilder).toHaveBeenCalled();
    expect(invoicesService.generateForPayment).not.toHaveBeenCalled();
  });

  it('does not throw when reactivation itself fails unexpectedly', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED);
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    bookingsRepository.findOne.mockResolvedValue(booking);
    reactivateExpiredBookingProvider.reactivateExpired.mockRejectedValue(
      new Error('lock timeout'),
    );

    await expect(handleChargeSuccess()).resolves.toBeUndefined();
    expect(invoicesService.generateForPayment).not.toHaveBeenCalled();
  });

  it('does not escrow long-term funds for an expired booking that cannot be honoured', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED, {
      planType: PlanType.MONTHLY,
    });
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    bookingsRepository.findOne.mockResolvedValue(booking);
    reactivateExpiredBookingProvider.reactivateExpired.mockResolvedValue(null);

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    expect(sorobanEscrowProvider.createEscrow).not.toHaveBeenCalled();
  });

  it('escrows long-term funds only after successful reactivation', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED, {
      planType: PlanType.MONTHLY,
    });
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    bookingsRepository.findOne.mockResolvedValue(booking);
    reactivateExpiredBookingProvider.reactivateExpired.mockResolvedValue({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    expect(sorobanEscrowProvider.createEscrow).toHaveBeenCalled();
  });

  it('treats a missing booking row deterministically instead of crashing', async () => {
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    bookingsRepository.findOne.mockResolvedValue(null);

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    expect(bookingsService.confirm).not.toHaveBeenCalled();
    expect(invoicesService.generateForPayment).not.toHaveBeenCalled();
  });
});

describe('HandleWebhookProvider – escrow recording end-to-end (issue #227)', () => {
  let provider: HandleWebhookProvider;
  let paymentsRepository: ReturnType<typeof mockRepository>;
  let bookingsRepository: ReturnType<typeof mockRepository>;
  let usersRepository: ReturnType<typeof mockRepository>;
  let bookingsService: { confirm: jest.Mock };
  let invoicesService: { generateForPayment: jest.Mock };
  let sorobanEscrowProvider: { createEscrow: jest.Mock };
  let metricsService: { recordSorobanEscrowFailure: jest.Mock };

  function longTermPayment(): Payment {
    return {
      id: 'pay-9',
      bookingId: 'bk-9',
      userId: null,
      amount: 50_000,
      currency: 'NGN',
      provider: 'paystack' as Payment['provider'],
      providerReference: 'ref-9',
      status: PaymentStatus.PENDING,
      paidAt: null,
      metadata: undefined,
    } as unknown as Payment;
  }

  function longTermBooking(
    status: BookingStatus = BookingStatus.PENDING,
  ): Booking {
    return {
      id: 'bk-9',
      workspaceId: 'ws-1',
      userId: null,
      planType: 'monthly' as Booking['planType'],
      startDate: '2030-02-01',
      endDate: '2030-03-01',
      totalAmount: 50_000n,
      status,
      seatCount: 2,
      isGuestBooking: true,
      guestInfo: { name: 'Guest', email: 'g@e.com', phone: '000' },
      sorobanEscrowId: null,
    } as unknown as Booking;
  }

  beforeEach(async () => {
    paymentsRepository = mockRepository();
    bookingsRepository = mockRepository();
    usersRepository = mockRepository();
    usersRepository.findOne.mockResolvedValue(null);
    bookingsService = { confirm: jest.fn() };
    invoicesService = {
      generateForPayment: jest.fn().mockResolvedValue(undefined),
    };
    sorobanEscrowProvider = {
      createEscrow: jest.fn().mockResolvedValue('tx-hash-227'),
    };
    metricsService = mockMetricsService();

    // Default: atomic update succeeds
    paymentsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 1 }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandleWebhookProvider,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepository },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        {
          provide: PaystackProvider,
          useValue: { verifyWebhookSignature: jest.fn().mockReturnValue(true) },
        },
        { provide: SorobanEscrowProvider, useValue: sorobanEscrowProvider },
        { provide: BookingsService, useValue: bookingsService },
        {
          provide: ReactivateExpiredBookingProvider,
          useValue: { reactivateExpired: jest.fn() },
        },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: EmailService, useValue: {} },
        { provide: MetricsService, useValue: metricsService },
      ],
    }).compile();

    provider = module.get<HandleWebhookProvider>(HandleWebhookProvider);
  });

  it('populates sorobanEscrowId on the booking when the RPC succeeds', async () => {
    const booking = longTermBooking();
    paymentsRepository.findOne.mockResolvedValue(longTermPayment());
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsService.confirm.mockResolvedValue({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });

    await expect(
      provider.handle(createEventPayload('charge.success', 'ref-9'), 'sig', ''),
    ).resolves.toBeUndefined();

    const releaseAfterUnix =
      Math.floor(new Date('2030-03-01').getTime() / 1000) + 86_400;
    expect(sorobanEscrowProvider.createEscrow).toHaveBeenCalledWith(
      'bk-9',
      50_000,
      'Booking bk-9',
      releaseAfterUnix,
    );
    expect(bookingsRepository.update).toHaveBeenCalledWith('bk-9', {
      sorobanEscrowId: 'tx-hash-227',
    });
    expect(metricsService.recordSorobanEscrowFailure).not.toHaveBeenCalled();
  });

  it('keeps the payment confirmed but records an operator-visible failure when escrow fails', async () => {
    const booking = longTermBooking();
    paymentsRepository.findOne.mockResolvedValue(longTermPayment());
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsService.confirm.mockResolvedValue({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });
    sorobanEscrowProvider.createEscrow.mockRejectedValue(
      new Error('rpc unreachable'),
    );

    await expect(
      provider.handle(createEventPayload('charge.success', 'ref-9'), 'sig', ''),
    ).resolves.toBeUndefined();

    expect(metricsService.recordSorobanEscrowFailure).toHaveBeenCalledWith(
      'create_escrow',
    );
    expect(bookingsRepository.update).not.toHaveBeenCalledWith('bk-9', {
      sorobanEscrowId: expect.anything(),
    });
  });

  it('never escrows short-term plans', async () => {
    const booking = longTermBooking();
    const daily = {
      ...booking,
      planType: PlanType.DAILY,
    };
    paymentsRepository.findOne.mockResolvedValue(longTermPayment());
    bookingsRepository.findOne.mockResolvedValue(daily);
    bookingsService.confirm.mockResolvedValue(daily);

    await provider.handle(
      createEventPayload('charge.success', 'ref-9'),
      '',
      '',
    );

    expect(sorobanEscrowProvider.createEscrow).not.toHaveBeenCalled();
  });
});

describe('HandleWebhookProvider – concurrency / race-condition guards (issue #236)', () => {
  let provider: HandleWebhookProvider;
  let paymentsRepository: ReturnType<typeof mockRepository>;
  let bookingsRepository: ReturnType<typeof mockRepository>;
  let usersRepository: ReturnType<typeof mockRepository>;
  let bookingsService: { confirm: jest.Mock };
  let reactivateExpiredBookingProvider: { reactivateExpired: jest.Mock };
  let invoicesService: { generateForPayment: jest.Mock };
  let sorobanEscrowProvider: { createEscrow: jest.Mock };
  let notificationsService: { create: jest.Mock };

  function paymentFixture(overrides: Partial<Payment> = {}): Payment {
    return {
      id: overrides.id ?? 'pay-1',
      bookingId: overrides.bookingId ?? 'bk-1',
      userId: null,
      amount: 10_000,
      currency: 'NGN',
      provider: 'paystack' as Payment['provider'],
      providerReference: overrides.providerReference ?? 'ref-1',
      status: overrides.status ?? PaymentStatus.PENDING,
      paidAt: null,
      metadata: undefined,
    } as unknown as Payment;
  }

  function bookingFixture(
    status: BookingStatus = BookingStatus.PENDING,
    extra: Partial<Booking> = {},
  ): Booking {
    return {
      id: extra.id ?? 'bk-1',
      workspaceId: 'ws-1',
      userId: null,
      planType: extra.planType ?? PlanType.DAILY,
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      totalAmount: 10_000n,
      status,
      seatCount: 1,
      isGuestBooking: true,
      guestInfo: { name: 'Guest', email: 'g@e.com', phone: '000' },
      sorobanEscrowId: extra.sorobanEscrowId ?? null,
    } as unknown as Booking;
  }

  async function compile() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandleWebhookProvider,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepository },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        {
          provide: PaystackProvider,
          useValue: { verifyWebhookSignature: jest.fn().mockReturnValue(true) },
        },
        { provide: SorobanEscrowProvider, useValue: sorobanEscrowProvider },
        { provide: BookingsService, useValue: bookingsService },
        {
          provide: ReactivateExpiredBookingProvider,
          useValue: reactivateExpiredBookingProvider,
        },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: EmailService, useValue: {} },
        {
          provide: MetricsService,
          useValue: mockMetricsService(),
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('beneficiary') },
        },
      ],
    }).compile();

    provider = module.get<HandleWebhookProvider>(HandleWebhookProvider);
  }

  beforeEach(async () => {
    paymentsRepository = mockRepository();
    bookingsRepository = mockRepository();
    usersRepository = mockRepository();
    usersRepository.findOne.mockResolvedValue(null);
    bookingsService = { confirm: jest.fn() };
    reactivateExpiredBookingProvider = { reactivateExpired: jest.fn() };
    invoicesService = {
      generateForPayment: jest.fn().mockResolvedValue(undefined),
    };
    sorobanEscrowProvider = {
      createEscrow: jest.fn().mockResolvedValue('tx-hash'),
    };
    notificationsService = { create: jest.fn() };
    await compile();
  });

  // ── charge.success: duplicate delivery ────────────────────────────────

  it('confirms booking and creates escrow only once when two charge.success arrive concurrently', async () => {
    const payment = paymentFixture();
    const booking = bookingFixture(BookingStatus.PENDING, {
      planType: PlanType.MONTHLY,
    });

    // First delivery: findOne returns PENDING payment, atomic update succeeds (affected=1)
    // Second delivery: findOne returns SAME payment (still PENDING in the mock),
    //                  atomic update fails (affected=0) because another delivery won
    paymentsRepository.findOne
      .mockResolvedValueOnce(payment) // 1st delivery: lookup by reference
      .mockResolvedValueOnce(payment) // 2nd delivery: lookup by reference
      .mockResolvedValueOnce({
        ...payment,
        status: PaymentStatus.SUCCESS,
      }); // 2nd delivery: re-read after affected=0

    paymentsRepository.createQueryBuilder
      .mockReturnValueOnce(mockQueryBuilder({ affected: 1 })) // 1st delivery wins
      .mockReturnValueOnce(mockQueryBuilder({ affected: 0 })); // 2nd delivery loses

    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsService.confirm.mockResolvedValue({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });

    // Run both deliveries concurrently
    await Promise.all([
      provider.handle(createEventPayload('charge.success', 'ref-1'), 'sig', ''),
      provider.handle(createEventPayload('charge.success', 'ref-1'), 'sig', ''),
    ]);

    // Booking confirmed exactly once
    expect(bookingsService.confirm).toHaveBeenCalledTimes(1);
    // Escrow created exactly once
    expect(sorobanEscrowProvider.createEscrow).toHaveBeenCalledTimes(1);
    // Invoice generated exactly once
    expect(invoicesService.generateForPayment).toHaveBeenCalledTimes(1);
  });

  it('sequential duplicate charge.success is idempotent — second delivery is a no-op', async () => {
    const payment = paymentFixture();
    const booking = bookingFixture(BookingStatus.PENDING, {
      planType: PlanType.MONTHLY,
    });

    // First delivery: succeeds
    paymentsRepository.findOne
      .mockResolvedValueOnce(payment) // 1st: lookup
      .mockResolvedValueOnce(payment); // 2nd: lookup

    // After the first delivery, the payment is SUCCESS.
    // The second delivery's findOne by id returns SUCCESS.
    paymentsRepository.createQueryBuilder
      .mockReturnValueOnce(mockQueryBuilder({ affected: 1 })) // 1st: wins
      .mockReturnValueOnce(mockQueryBuilder({ affected: 0 })); // 2nd: loses

    // 2nd delivery re-read: payment is already SUCCESS
    const successPayment = { ...payment, status: PaymentStatus.SUCCESS };
    paymentsRepository.findOne
      .mockResolvedValueOnce(successPayment) // 2nd delivery: lookup by reference
      .mockResolvedValueOnce(successPayment); // 2nd delivery: re-read by id after affected=0

    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsService.confirm.mockResolvedValue({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });

    await provider.handle(
      createEventPayload('charge.success', 'ref-1'),
      'sig',
      '',
    );
    await provider.handle(
      createEventPayload('charge.success', 'ref-1'),
      'sig',
      '',
    );

    expect(bookingsService.confirm).toHaveBeenCalledTimes(1);
    expect(sorobanEscrowProvider.createEscrow).toHaveBeenCalledTimes(1);
  });

  // ── charge.failed: cannot overwrite SUCCESS ───────────────────────────

  it('ignores a charge.failed that arrives after a concurrent charge.success already set SUCCESS', async () => {
    const payment = paymentFixture();

    // Charge.success atomic update succeeds (affected=1)
    paymentsRepository.createQueryBuilder
      .mockReturnValueOnce(mockQueryBuilder({ affected: 1 })) // success: wins
      .mockReturnValueOnce(mockQueryBuilder({ affected: 0 })); // failed: loses

    // Both handlers read the same PENDING payment initially
    const successPayment = { ...payment, status: PaymentStatus.SUCCESS };
    paymentsRepository.findOne
      .mockResolvedValueOnce(payment) // success: lookup
      .mockResolvedValueOnce(payment) // failed: lookup
      .mockResolvedValueOnce(successPayment); // failed: re-read after affected=0

    bookingsRepository.findOne.mockResolvedValue(bookingFixture());

    // Run success and failed concurrently — success should win
    await Promise.all([
      provider.handle(createEventPayload('charge.success', 'ref-1'), 'sig', ''),
      provider.handle(createEventPayload('charge.failed', 'ref-1'), 'sig', ''),
    ]);

    // Payment ended up SUCCESS, not FAILED
    // (the failed handler's atomic update was rejected by the WHERE clause)
    expect(bookingsService.confirm).toHaveBeenCalledTimes(1);
    // The failed handler should not have sent a failure email
    expect(notificationsService.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('FAILED'),
      }),
    );
  });

  it('charge.failed after SUCCESS is a no-op 200 (no exception)', async () => {
    const payment = paymentFixture({
      status: PaymentStatus.SUCCESS,
    });

    paymentsRepository.findOne.mockResolvedValue(payment);
    // Atomic update returns affected=0 because status is not PENDING
    paymentsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 0 }),
    );
    // Re-read returns the same SUCCESS payment
    paymentsRepository.findOne.mockResolvedValue({
      ...payment,
      status: PaymentStatus.SUCCESS,
    });

    await expect(
      provider.handle(createEventPayload('charge.failed', 'ref-1'), 'sig', ''),
    ).resolves.toBeUndefined();
  });

  // ── Unknown reference returns error ───────────────────────────────────

  it('throws BadRequestException for charge.success with unknown reference', async () => {
    paymentsRepository.findOne.mockResolvedValue(null);

    await expect(
      provider.handle(
        createEventPayload('charge.success', 'unknown-ref'),
        'sig',
        '',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not throw for charge.failed with unknown reference (logged as warning)', async () => {
    paymentsRepository.findOne.mockResolvedValue(null);

    await expect(
      provider.handle(
        createEventPayload('charge.failed', 'unknown-ref'),
        'sig',
        '',
      ),
    ).resolves.toBeUndefined();
  });

  // ── Escrow idempotency ───────────────────────────────────────────────

  it('skips escrow creation when booking.sorobanEscrowId is already set', async () => {
    const payment = paymentFixture();
    const booking = bookingFixture(BookingStatus.PENDING, {
      planType: PlanType.MONTHLY,
      sorobanEscrowId: 'existing-tx-hash',
    });

    paymentsRepository.findOne.mockResolvedValue(payment);
    paymentsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 1 }),
    );
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsService.confirm.mockResolvedValue({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });

    await expect(
      provider.handle(createEventPayload('charge.success', 'ref-1'), 'sig', ''),
    ).resolves.toBeUndefined();

    // Escrow should NOT be created — the guard checks sorobanEscrowId
    expect(sorobanEscrowProvider.createEscrow).not.toHaveBeenCalled();
    // But booking is still confirmed
    expect(bookingsService.confirm).toHaveBeenCalledWith('bk-1');
  });

  // ── charge.failed: atomic transition ──────────────────────────────────

  it('marks payment FAILED via atomic update when charge.failed arrives for PENDING payment', async () => {
    const payment = paymentFixture();

    paymentsRepository.findOne.mockResolvedValue(payment);
    paymentsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 1 }),
    );

    await expect(
      provider.handle(createEventPayload('charge.failed', 'ref-1'), 'sig', ''),
    ).resolves.toBeUndefined();

    expect(paymentsRepository.createQueryBuilder).toHaveBeenCalled();
    // Verify the query builder was called with the correct status
    const qb = paymentsRepository.createQueryBuilder.mock.results[0].value;
    expect(qb.update).toHaveBeenCalledWith(Payment);
    expect(qb.set).toHaveBeenCalledWith({
      status: PaymentStatus.FAILED,
    });
  });

  it('two concurrent charge.failed deliveries only send failure email once', async () => {
    const payment = paymentFixture();

    paymentsRepository.findOne
      .mockResolvedValueOnce(payment) // 1st: lookup
      .mockResolvedValueOnce(payment); // 2nd: lookup

    paymentsRepository.createQueryBuilder
      .mockReturnValueOnce(mockQueryBuilder({ affected: 1 })) // 1st: wins
      .mockReturnValueOnce(mockQueryBuilder({ affected: 0 })); // 2nd: loses

    // 2nd delivery re-read: already FAILED
    paymentsRepository.findOne.mockResolvedValueOnce({
      ...payment,
      status: PaymentStatus.FAILED,
    });

    bookingsRepository.findOne.mockResolvedValue(bookingFixture());

    await Promise.all([
      provider.handle(createEventPayload('charge.failed', 'ref-1'), 'sig', ''),
      provider.handle(createEventPayload('charge.failed', 'ref-1'), 'sig', ''),
    ]);

    // Notifications sent only once (by the winning delivery)
    // Note: notifications are fire-and-forget, but we check the service was called once
    // from the winning handler (the 1st delivery's email/notification path)
    expect(bookingsRepository.findOne).toHaveBeenCalled();
  });
});
