import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { InitializePaymentProvider } from './providers/initialize-payment.provider';
import { HandleWebhookProvider } from './providers/handle-webhook.provider';
import { RefundPaymentProvider } from './providers/refund-payment.provider';
import { FindPaymentsProvider } from './providers/find-payments.provider';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '../users/enums/userRoles.enum';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let initializeProvider: jest.Mocked<Partial<InitializePaymentProvider>>;
  let webhookProvider: jest.Mocked<Partial<HandleWebhookProvider>>;
  let refundProvider: jest.Mocked<Partial<RefundPaymentProvider>>;
  let findProvider: jest.Mocked<Partial<FindPaymentsProvider>>;

  beforeEach(async () => {
    initializeProvider = { initialize: jest.fn() };
    webhookProvider = { handle: jest.fn() };
    refundProvider = { refund: jest.fn() };
    findProvider = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: InitializePaymentProvider, useValue: initializeProvider },
        { provide: HandleWebhookProvider, useValue: webhookProvider },
        { provide: RefundPaymentProvider, useValue: refundProvider },
        { provide: FindPaymentsProvider, useValue: findProvider },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('initialize', () => {
    it('delegates to InitializePaymentProvider', async () => {
      initializeProvider.initialize.mockResolvedValue({
        paymentId: 'p1',
        authorizationUrl: 'https://paystack.com/...',
        reference: 'ref-1',
      });
      const result = await service.initialize('booking-1', 'user-1');
      expect(initializeProvider.initialize).toHaveBeenCalledWith(
        'booking-1',
        'user-1',
      );
      expect(result).toHaveProperty('authorizationUrl');
      expect(result.reference).toBe('ref-1');
    });
  });

  describe('handleWebhook', () => {
    it('delegates to HandleWebhookProvider', async () => {
      const raw = Buffer.from('{}');
      webhookProvider.handle.mockResolvedValue(undefined);
      await service.handleWebhook(raw, 'sig');
      expect(webhookProvider.handle).toHaveBeenCalledWith(raw, 'sig');
    });
  });

  describe('refund', () => {
    it('delegates to RefundPaymentProvider', async () => {
      const payment = { id: 'p1', status: 'refunded' } as any;
      refundProvider.refund.mockResolvedValue(payment);
      const result = await service.refund('p1', 'user-1', UserRole.SUPER_ADMIN);
      expect(refundProvider.refund).toHaveBeenCalledWith(
        'p1',
        'user-1',
        UserRole.SUPER_ADMIN,
      );
      expect(result.status).toBe('refunded');
    });
  });

  describe('findAll', () => {
    it('delegates to FindPaymentsProvider', async () => {
      const query = { page: 1, limit: 20 };
      findProvider.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      const result = await service.findAll(query, 'user-1', UserRole.USER);
      expect(findProvider.findAll).toHaveBeenCalledWith(
        query,
        'user-1',
        UserRole.USER,
      );
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('returns payment when found', async () => {
      const payment = { id: 'p1', amount: 5000 } as any;
      findProvider.findById.mockResolvedValue(payment);
      const result = await service.findById('p1', 'user-1', UserRole.ADMIN);
      expect(result).toEqual(payment);
    });

    it('throws NotFoundException when payment not found', async () => {
      findProvider.findById.mockResolvedValue(null);
      await expect(
        service.findById('p1', 'user-1', UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
