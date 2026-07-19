import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RefundPaymentProvider } from './refund-payment.provider';
import { PaystackProvider } from './paystack.provider';
import { UserRole } from '../../users/enums/userRoles.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

describe('RefundPaymentProvider', () => {
  let provider: RefundPaymentProvider;
  let paymentsRepository: any;
  let paystackProvider: any;

  beforeEach(() => {
    paymentsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    paystackProvider = { initiateRefund: jest.fn() };
    provider = new RefundPaymentProvider(
      paymentsRepository,
      paystackProvider,
    );
  });

  describe('refund', () => {
    it('refunds a successful payment for admin', async () => {
      const payment = {
        id: 'pay-1',
        userId: 'user-2',
        status: PaymentStatus.SUCCESS,
        providerReference: 'ref-1',
        amount: 500000,
      };
      paymentsRepository.findOne.mockResolvedValue(payment);
      paystackProvider.initiateRefund.mockResolvedValue({ id: 1 });
      paymentsRepository.save.mockResolvedValue({
        ...payment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await provider.refund('pay-1', 'admin-1', UserRole.ADMIN);

      expect(paystackProvider.initiateRefund).toHaveBeenCalledWith('ref-1');
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('allows SUPER_ADMIN to refund any payment', async () => {
      const payment = {
        id: 'pay-1',
        userId: 'user-2',
        status: PaymentStatus.SUCCESS,
        providerReference: 'ref-1',
      };
      paymentsRepository.findOne.mockResolvedValue(payment);
      paystackProvider.initiateRefund.mockResolvedValue({});
      paymentsRepository.save.mockResolvedValue({
        ...payment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await provider.refund(
        'pay-1',
        'admin-1',
        UserRole.SUPER_ADMIN,
      );

      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('allows user to refund their own payment', async () => {
      const payment = {
        id: 'pay-1',
        userId: 'user-1',
        status: PaymentStatus.SUCCESS,
        providerReference: 'ref-1',
      };
      paymentsRepository.findOne.mockResolvedValue(payment);
      paystackProvider.initiateRefund.mockResolvedValue({});
      paymentsRepository.save.mockResolvedValue({
        ...payment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await provider.refund('pay-1', 'user-1', UserRole.USER);

      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('throws NotFoundException when payment does not exist', async () => {
      paymentsRepository.findOne.mockResolvedValue(null);

      await expect(
        provider.refund('unknown', 'user-1', UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-admin tries to refund another users payment', async () => {
      paymentsRepository.findOne.mockResolvedValue({
        id: 'pay-1',
        userId: 'user-2',
        status: PaymentStatus.SUCCESS,
      });

      await expect(
        provider.refund('pay-1', 'user-1', UserRole.USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when payment is not SUCCESS', async () => {
      paymentsRepository.findOne.mockResolvedValue({
        id: 'pay-1',
        userId: 'user-1',
        status: PaymentStatus.PENDING,
      });

      await expect(
        provider.refund('pay-1', 'user-1', UserRole.USER),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
