import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CancelBookingProvider } from './cancel-booking.provider';
import { BookingStatus } from '../enums/booking-status.enum';
import { UserRole } from '../../users/enums/userRoles.enum';

describe('CancelBookingProvider', () => {
  let provider: CancelBookingProvider;
  let bookingsRepository: any;
  let usersRepository: any;
  let emailService: any;
  let workspacesService: any;

  beforeEach(() => {
    bookingsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    usersRepository = {
      findOne: jest.fn(),
    };
    emailService = {
      sendBookingCancelledEmail: jest.fn().mockResolvedValue(undefined),
    };
    workspacesService = {
      findById: jest.fn(),
    };
    provider = new CancelBookingProvider(
      bookingsRepository,
      usersRepository,
      emailService,
      workspacesService,
    );
  });

  it('cancels a pending booking owned by the user', async () => {
    const booking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
    };
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsRepository.save.mockImplementation((b) => Promise.resolve(b));

    const result = await provider.cancel('booking-1', 'user-1', UserRole.USER);

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(bookingsRepository.save).toHaveBeenCalledWith(booking);
  });

  it('allows admin to cancel any booking', async () => {
    const booking = {
      id: 'booking-1',
      userId: 'user-2',
      status: BookingStatus.PENDING,
    };
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsRepository.save.mockImplementation((b) => Promise.resolve(b));

    const result = await provider.cancel(
      'booking-1',
      'admin-1',
      UserRole.ADMIN,
    );

    expect(result.status).toBe(BookingStatus.CANCELLED);
  });

  it('throws NotFoundException when booking does not exist', async () => {
    bookingsRepository.findOne.mockResolvedValue(null);

    await expect(
      provider.cancel('unknown', 'user-1', UserRole.USER),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when non-admin tries to cancel another users booking', async () => {
    bookingsRepository.findOne.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-2',
      status: BookingStatus.PENDING,
    });

    await expect(
      provider.cancel('booking-1', 'user-1', UserRole.USER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when booking is already completed', async () => {
    bookingsRepository.findOne.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.COMPLETED,
    });

    await expect(
      provider.cancel('booking-1', 'user-1', UserRole.USER),
    ).rejects.toThrow(BadRequestException);
  });
});
