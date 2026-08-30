/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefundPaymentProvider } from './refund-payment.provider';
import { PaystackProvider } from './paystack.provider';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { UserRole } from '../../users/enums/userRoles.enum';

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

function paymentFixture(
  status: PaymentStatus = PaymentStatus.SUCCESS,
): Payment {
  return {
    id: 'pay-1',
    bookingId: 'bk-1',
    userId: 'user-1',
    amount: 10_000,
    currency: 'NGN',
    provider: 'paystack',
    providerReference: 'ref-1',
    status,
    paidAt: new Date(),
    metadata: {},
  } as unknown as Payment;
}

describe('RefundPaymentProvider – atomic transition (issue #236)', () => {
  let provider: RefundPaymentProvider;
  let paymentsRepository: ReturnType<typeof mockRepository>;
  let paystackProvider: jest.Mocked<PaystackProvider>;

  beforeEach(async () => {
    paymentsRepository = mockRepository();
    paystackProvider = {
      initiateRefund: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundPaymentProvider,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepository },
        { provide: PaystackProvider, useValue: paystackProvider },
      ],
    }).compile();

    provider = module.get<RefundPaymentProvider>(RefundPaymentProvider);
  });

  it('refunds a SUCCESS payment via atomic update', async () => {
    const payment = paymentFixture(PaymentStatus.SUCCESS);
    paymentsRepository.findOne.mockResolvedValue(payment);
    paymentsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 1 }),
    );
    paymentsRepository.findOne.mockResolvedValueOnce(payment);
    paymentsRepository.findOne.mockResolvedValueOnce({
      ...payment,
      status: PaymentStatus.REFUNDED,
    });

    const result = await provider.refund('pay-1', 'user-1', UserRole.USER);

    expect(paystackProvider.initiateRefund).toHaveBeenCalledWith('ref-1');
    expect(paymentsRepository.createQueryBuilder).toHaveBeenCalled();
    expect(result.status).toBe(PaymentStatus.REFUNDED);
  });

  it('is idempotent when a concurrent refund already succeeded (race between guard and atomic update)', async () => {
    const payment = paymentFixture(PaymentStatus.SUCCESS);
    const refunded = { ...payment, status: PaymentStatus.REFUNDED };

    // First findOne returns SUCCESS (passes the status guard)
    // After the atomic update returns affected=0, the re-read shows REFUNDED
    paymentsRepository.findOne
      .mockResolvedValueOnce(payment) // initial lookup
      .mockResolvedValueOnce(refunded); // re-read after affected=0

    paymentsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 0 }),
    );

    const result = await provider.refund('pay-1', 'user-1', UserRole.USER);

    // Paystack refund was called (guard passed on first read), but the atomic
    // update was rejected — a concurrent request already flipped to REFUNDED.
    expect(paystackProvider.initiateRefund).toHaveBeenCalledWith('ref-1');
    expect(result.status).toBe(PaymentStatus.REFUNDED);
  });

  it('throws NotFoundException when payment does not exist', async () => {
    paymentsRepository.findOne.mockResolvedValue(null);

    await expect(
      provider.refund('nonexistent', 'user-1', UserRole.USER),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when non-admin tries to refund another user payment', async () => {
    const payment = paymentFixture(PaymentStatus.SUCCESS);
    paymentsRepository.findOne.mockResolvedValue(payment);

    await expect(
      provider.refund('pay-1', 'other-user', UserRole.USER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when trying to refund a PENDING payment', async () => {
    const payment = paymentFixture(PaymentStatus.PENDING);
    paymentsRepository.findOne.mockResolvedValue(payment);

    await expect(
      provider.refund('pay-1', 'user-1', UserRole.USER),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when trying to refund an already-FAILED payment', async () => {
    const payment = paymentFixture(PaymentStatus.FAILED);
    paymentsRepository.findOne.mockResolvedValue(payment);

    await expect(
      provider.refund('pay-1', 'user-1', UserRole.USER),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows admin to refund any user payment', async () => {
    const payment = paymentFixture(PaymentStatus.SUCCESS);
    paymentsRepository.findOne.mockResolvedValue(payment);
    paymentsRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder({ affected: 1 }),
    );
    paymentsRepository.findOne.mockResolvedValueOnce(payment);
    paymentsRepository.findOne.mockResolvedValueOnce({
      ...payment,
      status: PaymentStatus.REFUNDED,
    });

    const result = await provider.refund('pay-1', 'admin-user', UserRole.ADMIN);

    expect(paystackProvider.initiateRefund).toHaveBeenCalledWith('ref-1');
    expect(result.status).toBe(PaymentStatus.REFUNDED);
  });
});
