import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandleWebhookProvider } from './handle-webhook.provider';
import { PaystackProvider } from './paystack.provider';
import { SorobanEscrowProvider } from './soroban-escrow.provider';
import { BookingsService } from '../../bookings/bookings.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../email/email.service';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PlanType } from '../../bookings/enums/plan-type.enum';

describe('HandleWebhookProvider', () => {
  let provider: HandleWebhookProvider;
  let paymentsRepository: any;
  let bookingsRepository: any;
  let usersRepository: any;
  let paystackProvider: jest.Mocked<Partial<PaystackProvider>>;
  let sorobanEscrowProvider: jest.Mocked<Partial<SorobanEscrowProvider>>;
  let bookingsService: jest.Mocked<Partial<BookingsService>>;
  let invoicesService: jest.Mocked<Partial<InvoicesService>>;
  let notificationsService: jest.Mocked<Partial<NotificationsService>>;
  let emailService: jest.Mocked<Partial<EmailService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    paymentsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    bookingsRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    usersRepository = {
      findOne: jest.fn(),
    };
    paystackProvider = {
      verifyWebhookSignature: jest.fn(),
    };
    sorobanEscrowProvider = {
      createEscrow: jest.fn(),
    };
    bookingsService = {
      confirm: jest.fn(),
    };
    invoicesService = {
      generateForPayment: jest.fn(),
    };
    notificationsService = {
      create: jest.fn(),
    };
    emailService = {
      sendPaymentSuccessEmail: jest.fn(),
      sendPaymentFailedEmail: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };

    provider = new HandleWebhookProvider(
      paymentsRepository,
      bookingsRepository,
      usersRepository,
      paystackProvider as any,
      sorobanEscrowProvider as any,
      bookingsService as any,
      invoicesService as any,
      notificationsService as any,
      emailService as any,
      configService as any,
    );
  });

  describe('handle', () => {
    it('throws UnauthorizedException when signature is invalid', async () => {
      paystackProvider.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        provider.handle(Buffer.from('{}'), 'invalid-sig'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when payload is malformed JSON', async () => {
      paystackProvider.verifyWebhookSignature.mockReturnValue(true);

      await expect(
        provider.handle(Buffer.from('not-json'), 'valid-sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles charge.success event', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event: 'charge.success',
          data: { reference: 'ref-1', amount: 500000 },
        }),
      );
      paystackProvider.verifyWebhookSignature.mockReturnValue(true);
      paymentsRepository.findOne.mockResolvedValue({
        id: 'pay-1',
        bookingId: 'booking-1',
        userId: 'user-1',
        status: PaymentStatus.PENDING,
        amount: 500000,
        providerReference: 'ref-1',
      });
      bookingsService.confirm.mockResolvedValue({
        id: 'booking-1',
        planType: PlanType.DAILY,
        workspaceId: 'ws-1',
      } as any);
      invoicesService.generateForPayment.mockResolvedValue(undefined);
      notificationsService.create.mockResolvedValue(undefined);
      emailService.sendPaymentSuccessEmail.mockResolvedValue(undefined);
      usersRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'Test User',
      });
      bookingsRepository.findOne.mockResolvedValue({
        id: 'booking-1',
        workspaceId: 'ws-1',
      });

      await provider.handle(rawBody, 'valid-sig');

      expect(paymentsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.SUCCESS,
        }),
      );
      expect(bookingsService.confirm).toHaveBeenCalledWith('booking-1');
    });

    it('handles charge.failed event', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event: 'charge.failed',
          data: { reference: 'ref-1' },
        }),
      );
      paystackProvider.verifyWebhookSignature.mockReturnValue(true);
      paymentsRepository.findOne.mockResolvedValue({
        id: 'pay-1',
        userId: 'user-1',
        status: PaymentStatus.PENDING,
        amount: 500000,
        providerReference: 'ref-1',
      });
      usersRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'Test User',
      });
      emailService.sendPaymentFailedEmail.mockResolvedValue(undefined);
      notificationsService.create.mockResolvedValue(undefined);

      await provider.handle(rawBody, 'valid-sig');

      expect(paymentsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.FAILED,
        }),
      );
    });

    it('skips charge.success when payment already succeeded (idempotent)', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event: 'charge.success',
          data: { reference: 'ref-1' },
        }),
      );
      paystackProvider.verifyWebhookSignature.mockReturnValue(true);
      paymentsRepository.findOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
        amount: 500000,
        providerReference: 'ref-1',
      });

      await provider.handle(rawBody, 'valid-sig');

      expect(bookingsService.confirm).not.toHaveBeenCalled();
    });

    it('logs a warning for charge.success with no matching payment', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event: 'charge.success',
          data: { reference: 'unknown-ref' },
        }),
      );
      paystackProvider.verifyWebhookSignature.mockReturnValue(true);
      paymentsRepository.findOne.mockResolvedValue(null);
      const loggerSpy = jest.spyOn(provider['logger'], 'warn');

      await provider.handle(rawBody, 'valid-sig');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('no payment found for reference unknown-ref'),
      );
    });

    it('logs a warning for events with no reference', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event: 'charge.success',
          data: {},
        }),
      );
      paystackProvider.verifyWebhookSignature.mockReturnValue(true);
      const loggerSpy = jest.spyOn(provider['logger'], 'warn');

      await provider.handle(rawBody, 'valid-sig');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('no reference'),
      );
    });

    it('handles unhandled event types gracefully', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event: 'transfer.success',
          data: { reference: 'ref-1' },
        }),
      );
      paystackProvider.verifyWebhookSignature.mockReturnValue(true);
      const loggerSpy = jest.spyOn(provider['logger'], 'log');

      await provider.handle(rawBody, 'valid-sig');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Unhandled Paystack event: transfer.success',
      );
    });
  });
});
