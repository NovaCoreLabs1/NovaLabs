import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBookingProvider } from './create-booking.provider';
import { BookingStatus } from '../enums/booking-status.enum';
import { PlanType } from '../enums/plan-type.enum';

describe('CreateBookingProvider', () => {
  let provider: CreateBookingProvider;
  let bookingsRepository: any;
  let usersRepository: any;
  let pricingService: any;
  let dataSource: any;
  let emailService: any;
  let mockManager: any;

  beforeEach(() => {
    bookingsRepository = { create: jest.fn(), save: jest.fn() };
    usersRepository = { findOne: jest.fn().mockResolvedValue(null) };
    pricingService = { calculateAmount: jest.fn() };
    emailService = {
      sendBookingCreatedEmail: jest.fn().mockResolvedValue(undefined),
    };

    mockManager = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
    };

    provider = new CreateBookingProvider(
      bookingsRepository,
      usersRepository,
      pricingService,
      dataSource,
      emailService,
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
    workspaceId: 'ws-1',
    planType: PlanType.DAILY,
    startDate: '2024-06-01',
    endDate: '2024-06-05',
    seatCount: 2,
  };

  it('throws BadRequestException when endDate is before startDate', async () => {
    await expect(
      provider.create(
        { ...validDto, startDate: '2024-06-10', endDate: '2024-06-05' },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when workspace not found', async () => {
    mockWorkspaceQuery(null);

    await expect(provider.create(validDto, 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when workspace is inactive', async () => {
    mockWorkspaceQuery({ id: 'ws-1', isActive: false, totalSeats: 10 });

    await expect(provider.create(validDto, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws ConflictException when insufficient seats available', async () => {
    mockWorkspaceQuery({
      id: 'ws-1',
      isActive: true,
      totalSeats: 10,
      hourlyRate: 50000,
    });
    mockOverlapQuery(9); // 9 already booked, requesting 2, total 11 > 10

    await expect(provider.create(validDto, 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('creates a booking successfully within a transaction', async () => {
    const workspace = {
      id: 'ws-1',
      isActive: true,
      totalSeats: 10,
      hourlyRate: 50000,
      name: 'Hot Desk A',
    };
    mockWorkspaceQuery(workspace);
    mockOverlapQuery(3); // 3 already booked, requesting 2, total 5 <= 10

    pricingService.calculateAmount.mockReturnValue(800000);
    mockManager.create.mockReturnValue({ id: 'booking-1' });
    mockManager.save.mockResolvedValue({
      id: 'booking-1',
      workspaceId: 'ws-1',
    });

    const result = await provider.create(validDto, 'user-1');

    expect(result).toEqual({ id: 'booking-1', workspaceId: 'ws-1' });
    expect(pricingService.calculateAmount).toHaveBeenCalledWith(
      50000,
      validDto.planType,
      validDto.seatCount,
      validDto.startDate,
      validDto.endDate,
    );
    expect(mockManager.create).toHaveBeenCalledWith(expect.anything(), {
      ...validDto,
      userId: 'user-1',
      totalAmount: 800000,
      status: BookingStatus.PENDING,
    });
    expect(mockManager.save).toHaveBeenCalled();
    expect(dataSource.transaction).toHaveBeenCalled();
  });
});
