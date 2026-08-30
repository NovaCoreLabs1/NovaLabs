/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfirmBookingProvider } from './confirm-booking.provider';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { User } from '../../users/entities/user.entity';

function mockRepository() {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function mockQueryBuilder(executeResult: { affected: number }) {
  const chain = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(executeResult),
  };
  return chain;
}

function bookingFixture(
  status: BookingStatus = BookingStatus.PENDING,
): Booking {
  return {
    id: 'bk-1',
    userId: 'user-1',
    workspaceId: 'ws-1',
    planType: 'daily' as Booking['planType'],
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    totalAmount: 10_000n,
    status,
    seatCount: 1,
    isGuestBooking: false,
    guestInfo: null,
    sorobanEscrowId: null,
  } as unknown as Booking;
}

describe('ConfirmBookingProvider – atomic transition (issue #236)', () => {
  let provider: ConfirmBookingProvider;
  let bookingsRepository: ReturnType<typeof mockRepository>;
  let usersRepository: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    bookingsRepository = mockRepository();
    usersRepository = mockRepository();
    usersRepository.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmBookingProvider,
        { provide: getRepositoryToken(Booking), useValue: bookingsRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    provider = module.get<ConfirmBookingProvider>(ConfirmBookingProvider);
  });

  it('confirms a PENDING booking via atomic update', async () => {
    const booking = bookingFixture(BookingStatus.PENDING);
    bookingsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 1 }),
    );
    bookingsRepository.findOne.mockResolvedValue({
      ...booking,
      status: BookingStatus.CONFIRMED,
    });

    const result = await provider.confirm('bk-1');

    expect(bookingsRepository.createQueryBuilder).toHaveBeenCalled();
    expect(result.status).toBe(BookingStatus.CONFIRMED);
  });

  it('is idempotent when a concurrent delivery already confirmed', async () => {
    const booking = bookingFixture(BookingStatus.CONFIRMED);
    bookingsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 0 }),
    );
    bookingsRepository.findOne.mockResolvedValue(booking);

    const result = await provider.confirm('bk-1');

    expect(result.status).toBe(BookingStatus.CONFIRMED);
  });

  it('throws NotFoundException when booking does not exist', async () => {
    bookingsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 0 }),
    );
    bookingsRepository.findOne.mockResolvedValue(null);

    await expect(provider.confirm('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when booking is in a non-PENDING state', async () => {
    const booking = bookingFixture(BookingStatus.EXPIRED);
    bookingsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 0 }),
    );
    bookingsRepository.findOne.mockResolvedValue(booking);

    await expect(provider.confirm('bk-1')).rejects.toThrow(BadRequestException);
  });
});
