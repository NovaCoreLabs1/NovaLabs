import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePublicDayPassProvider } from './create-public-day-pass.provider';
import { PlanType } from '../enums/plan-type.enum';

describe('CreatePublicDayPassProvider', () => {
  let provider: CreatePublicDayPassProvider;
  let bookingsRepository: any;
  let paymentsRepository: any;
  let pricingService: any;
  let paystackProvider: any;
  let configService: any;
  let dataSource: any;
  let mockManager: any;

  beforeEach(() => {
    bookingsRepository = { create: jest.fn(), save: jest.fn() };
    paymentsRepository = { create: jest.fn(), save: jest.fn() };
    pricingService = { calculateAmount: jest.fn() };
    paystackProvider = { initializeTransaction: jest.fn() };
    configService = { get: jest.fn() };
    mockManager = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
    };

    provider = new CreatePublicDayPassProvider(
      bookingsRepository,
      paymentsRepository,
      pricingService,
      paystackProvider,
      configService,
      dataSource,
    );
  });

  function mockWorkspaceQuery(workspace: any) {
    const qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(workspace),
    };
    mockManager.createQueryBuilder.mockReturnValueOnce(qb);
    return qb;
  }

  function mockOverlapQuery(booked: number) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ booked: String(booked) }),
    };
    mockManager.createQueryBuilder.mockReturnValueOnce(qb);
    return qb;
  }

  const validDto = {
    guestName: 'John Doe',
    guestEmail: 'john@example.com',
    guestPhone: '+2348012345678',
    workspaceId: 'ws-1',
    date: '2026-06-22',
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('throws BadRequestException when date is in the past', async () => {
    await expect(
      provider.create({ ...validDto, date: '2020-01-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when workspace not found', async () => {
    mockWorkspaceQuery(null);

    await expect(provider.create(validDto)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when workspace is inactive', async () => {
    mockWorkspaceQuery({ id: 'ws-1', isActive: false, totalSeats: 10 });

    await expect(provider.create(validDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws ConflictException when no seats available', async () => {
    mockWorkspaceQuery({ id: 'ws-1', isActive: true, totalSeats: 10 });
    mockOverlapQuery(10);

    await expect(provider.create(validDto)).rejects.toThrow(ConflictException);
  });

  it('creates a day-pass booking with payment initialization', async () => {
    const workspace = {
      id: 'ws-1',
      isActive: true,
      totalSeats: 10,
      hourlyRate: 50000,
    };
    mockWorkspaceQuery(workspace);
    mockOverlapQuery(5); // 5 already booked, requesting 1, total 6 <= 10

    pricingService.calculateAmount.mockReturnValue(400000);
    configService.get.mockReturnValue('https://example.com/callback');

    // First save for booking
    mockManager.save.mockResolvedValueOnce({ id: 'booking-1' });
    // Second save for payment
    mockManager.save.mockResolvedValueOnce({ id: 'payment-1' });
    // Third save for updated payment with reference
    mockManager.save.mockResolvedValueOnce({
      id: 'payment-1',
      providerReference: 'paystack-ref-1',
    });

    mockManager.create
      .mockReturnValueOnce({ id: 'booking-1' })
      .mockReturnValueOnce({ id: 'payment-1' });

    paystackProvider.initializeTransaction.mockResolvedValue({
      authorization_url: 'https://paystack.com/pay/ref-1',
      reference: 'paystack-ref-1',
    });

    const result = await provider.create(validDto);

    expect(result).toEqual({
      bookingId: 'booking-1',
      paymentId: 'payment-1',
      authorizationUrl: 'https://paystack.com/pay/ref-1',
      reference: 'paystack-ref-1',
    });
    expect(pricingService.calculateAmount).toHaveBeenCalledWith(
      50000,
      PlanType.DAILY,
      1,
      validDto.date,
      validDto.date,
    );
    expect(paystackProvider.initializeTransaction).toHaveBeenCalledWith(
      'john@example.com',
      400000,
      'payment-1',
      'https://example.com/callback',
      { bookingId: 'booking-1', isGuestBooking: true },
    );
  });
});
