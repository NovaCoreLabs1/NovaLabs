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
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { Booking } from '../../bookings/entities/booking.entity';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import { User } from '../../users/entities/user.entity';

function mockRepository() {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  };
}

function createEventPayload(eventType: string, reference: string) {
  return Buffer.from(JSON.stringify({ event: eventType, data: { reference } }));
}

describe('HandleWebhookProvider – replay protection', () => {
  let provider: HandleWebhookProvider;
  let paystackProvider: jest.Mocked<PaystackProvider>;

  beforeEach(async () => {
    paystackProvider = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandleWebhookProvider,
        { provide: getRepositoryToken(Payment), useValue: mockRepository() },
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
        { provide: ConfigService, useValue: { get: jest.fn() } },
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
      status: PaymentStatus.PENDING,
      paidAt: null,
      metadata: undefined,
    } as unknown as Payment;
  }

  function bookingFixture(status: BookingStatus): Booking {
    return {
      id: 'bk-1',
      workspaceId: 'ws-1',
      userId: null,
      planType: 'daily' as Booking['planType'],
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      totalAmount: 10_000n,
      status,
      seatCount: 1,
      isGuestBooking: true,
      guestInfo: { name: 'Guest', email: 'g@e.com', phone: '000' },
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
    paymentsRepository.save.mockResolvedValue(undefined);
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
  });

  it('re-confirms an EXPIRED booking via the seat re-check when seats are free', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED);
    const revived = { ...booking, status: BookingStatus.CONFIRMED };
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    paymentsRepository.save.mockResolvedValue(undefined);
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
    paymentsRepository.save.mockResolvedValue(undefined);
    bookingsRepository.findOne.mockResolvedValue(booking);
    reactivateExpiredBookingProvider.reactivateExpired.mockResolvedValue(null);

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    // Payment stands recorded as SUCCESS; no invoice for an unfulfilled
    // booking; refunding stays a deliberate admin action.
    expect(paymentsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pay-1', status: PaymentStatus.SUCCESS }),
    );
    expect(invoicesService.generateForPayment).not.toHaveBeenCalled();
  });

  it('does not throw when reactivation itself fails unexpectedly', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED);
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    paymentsRepository.save.mockResolvedValue(undefined);
    bookingsRepository.findOne.mockResolvedValue(booking);
    reactivateExpiredBookingProvider.reactivateExpired.mockRejectedValue(
      new Error('lock timeout'),
    );

    await expect(handleChargeSuccess()).resolves.toBeUndefined();
    expect(invoicesService.generateForPayment).not.toHaveBeenCalled();
  });

  it('does not escrow long-term funds for an expired booking that cannot be honoured', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED);
    booking.planType = 'monthly' as Booking['planType'];
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    paymentsRepository.save.mockResolvedValue(undefined);
    bookingsRepository.findOne.mockResolvedValue(booking);
    reactivateExpiredBookingProvider.reactivateExpired.mockResolvedValue(null);

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    expect(sorobanEscrowProvider.createEscrow).not.toHaveBeenCalled();
  });

  it('escrows long-term funds only after successful reactivation', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED);
    booking.planType = 'monthly' as Booking['planType'];
    paymentsRepository.findOne.mockResolvedValue(paymentFixture());
    paymentsRepository.save.mockResolvedValue(undefined);
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
    paymentsRepository.save.mockResolvedValue(undefined);
    bookingsRepository.findOne.mockResolvedValue(null);

    await expect(handleChargeSuccess()).resolves.toBeUndefined();

    expect(bookingsService.confirm).not.toHaveBeenCalled();
    expect(invoicesService.generateForPayment).not.toHaveBeenCalled();
  });
});
