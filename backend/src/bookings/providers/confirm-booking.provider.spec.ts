import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfirmBookingProvider } from './confirm-booking.provider';
import { BookingStatus } from '../enums/booking-status.enum';
import { MembershipStatus } from '../../users/enums/membership-status.enum';

describe('ConfirmBookingProvider', () => {
  let provider: ConfirmBookingProvider;
  let bookingsRepository: any;
  let usersRepository: any;

  beforeEach(() => {
    bookingsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    usersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    provider = new ConfirmBookingProvider(bookingsRepository, usersRepository);
  });

  it('confirms a pending booking', async () => {
    const booking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
    };
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsRepository.save.mockImplementation((b) => Promise.resolve(b));
    usersRepository.findOne.mockResolvedValue(null); // no user activation needed

    const result = await provider.confirm('booking-1');
    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(bookingsRepository.save).toHaveBeenCalled();
  });

  it('activates membership when user has no memberSince date', async () => {
    const booking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
    };
    const user = {
      id: 'user-1',
      memberSince: null,
      membershipStatus: MembershipStatus.INACTIVE,
    };
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsRepository.save.mockImplementation((b) => Promise.resolve(b));
    usersRepository.findOne.mockResolvedValue(user);
    usersRepository.save.mockImplementation((u) => Promise.resolve(u));

    await provider.confirm('booking-1');

    expect(user.memberSince).toBeDefined();
    expect(user.membershipStatus).toBe(MembershipStatus.ACTIVE);
    expect(usersRepository.save).toHaveBeenCalledWith(user);
  });

  it('does not activate membership when user already has memberSince', async () => {
    const booking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
    };
    const user = {
      id: 'user-1',
      memberSince: new Date('2024-01-01'),
      membershipStatus: MembershipStatus.ACTIVE,
    };
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsRepository.save.mockImplementation((b) => Promise.resolve(b));
    usersRepository.findOne.mockResolvedValue(user);

    await provider.confirm('booking-1');

    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when booking does not exist', async () => {
    bookingsRepository.findOne.mockResolvedValue(null);

    await expect(provider.confirm('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when booking is not PENDING', async () => {
    bookingsRepository.findOne.mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.CONFIRMED,
    });

    await expect(provider.confirm('booking-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
