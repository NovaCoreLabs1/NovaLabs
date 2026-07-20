import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompleteBookingProvider } from './complete-booking.provider';
import { BookingStatus } from '../enums/booking-status.enum';

describe('CompleteBookingProvider', () => {
  let provider: CompleteBookingProvider;
  let bookingsRepository: any;

  beforeEach(() => {
    bookingsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    provider = new CompleteBookingProvider(bookingsRepository);
  });

  it('completes a confirmed booking', async () => {
    const booking = {
      id: 'booking-1',
      status: BookingStatus.CONFIRMED,
    };
    bookingsRepository.findOne.mockResolvedValue(booking);
    bookingsRepository.save.mockImplementation((b) => Promise.resolve(b));

    const result = await provider.complete('booking-1');
    expect(result.status).toBe(BookingStatus.COMPLETED);
    expect(bookingsRepository.save).toHaveBeenCalledWith(booking);
  });

  it('throws NotFoundException when booking does not exist', async () => {
    bookingsRepository.findOne.mockResolvedValue(null);

    await expect(provider.complete('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    bookingsRepository.findOne.mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.PENDING,
    });

    await expect(provider.complete('booking-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
