import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InitializePaymentProvider } from './initialize-payment.provider';
import { PaystackProvider } from './paystack.provider';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentProvider as PaymentProviderEnum } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import { PlanType } from '../../bookings/enums/plan-type.enum';

describe('InitializePaymentProvider', () => {
  let provider: InitializePaymentProvider;
  let paymentsRepository: any;
  let bookingsRepository: any;
  let usersRepository: any;
  let paystackProvider: jest.Mocked<Partial<PaystackProvider>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    paymentsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    bookingsRepository = {
      findOne: jest.fn(),
    };
    usersRepository = {
      findOne: jest.fn(),
    };
    paystackProvider = { initializeTransaction: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('https://example.com/callback') };

    provider = new InitializePaymentProvider(
      paymentsRepository as any,
      bookingsRepository as any,
      usersRepository as any,
      paystackProvider as any,
      configService as any,
    );
  });

  const mockBooking = {
    id: 'booking-1',
    userId: 'user-1',
    status: BookingStatus.PENDING,
    totalAmount: '500000',
    planType: PlanType.DAILY,
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-01'),
  };

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Test User',
  };

  describe('initialize', () => {
    it('creates a new payment and initializes via Paystack', async () => {
      bookingsRepository.findOne.mockResolvedValue(mockBooking);
      paymentsRepository.findOne.mockResolvedValue(null); // no existing payment
      usersRepository.findOne.mockResolvedValue(mockUser);
      paymentsRepository.create.mockReturnValue({
        id: 'pay-1',
        bookingId: 'booking-1',
        userId: 'user-1',
        amount: 500000,
        provider: PaymentProviderEnum.PAYSTACK,
        status: PaymentStatus.PENDING,
      });
      paymentsRepository.save
        .mockResolvedValueOnce({
          id: 'pay-1',
          bookingId: 'booking-1',
          userId: 'user-1',
          amount: 500000,
          provider: PaymentProviderEnum.PAYSTACK,
          status: PaymentStatus.PENDING,
        })
        .mockResolvedValueOnce({
          id: 'pay-1',
          providerReference: 'paystack-ref-1',
        });
      paystackProvider.initializeTransaction.mockResolvedValue({
        authorization_url: 'https://paystack.com/authorize',
        access_code: 'abc123',
        reference: 'paystack-ref-1',
      });

      const result = await provider.initialize('booking-1', 'user-1');

      expect(result.paymentId).toBe('pay-1');
      expect(result.authorizationUrl).toBe(
        'https://paystack.com/authorize',
      );
      expect(result.reference).toBe('paystack-ref-1');
      expect(paymentsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-1',
          userId: 'user-1',
          amount: 500000,
          provider: PaymentProviderEnum.PAYSTACK,
          status: PaymentStatus.PENDING,
        }),
      );
    });

    it('reuses existing pending payment for the same booking', async () => {
      bookingsRepository.findOne.mockResolvedValue(mockBooking);
      const existingPayment = {
        id: 'pay-existing',
        bookingId: 'booking-1',
        status: PaymentStatus.PENDING,
      };
      paymentsRepository.findOne.mockResolvedValue(existingPayment);
      usersRepository.findOne.mockResolvedValue(mockUser);
      paystackProvider.initializeTransaction.mockResolvedValue({
        authorization_url: 'https://paystack.com/authorize',
        access_code: 'abc123',
        reference: 'paystack-ref-1',
      });

      const result = await provider.initialize('booking-1', 'user-1');

      expect(result.paymentId).toBe('pay-existing');
      expect(paystackProvider.initializeTransaction).toHaveBeenCalledWith(
        'user@example.com',
        500000,
        'pay-existing',
        'https://example.com/callback',
        { bookingId: 'booking-1' },
      );
    });

    it('throws NotFoundException when booking does not exist', async () => {
      bookingsRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.initialize('unknown', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when booking is not PENDING', async () => {
      bookingsRepository.findOne.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      });

      await expect(
        provider.initialize('booking-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
