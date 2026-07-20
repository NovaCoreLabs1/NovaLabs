import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UserRole } from '../users/enums/userRoles.enum';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<Partial<PaymentsService>>;

  beforeEach(async () => {
    paymentsService = {
      initialize: jest.fn(),
      handleWebhook: jest.fn(),
      refund: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  describe('POST /payments/initialize', () => {
    it('calls paymentsService.initialize', async () => {
      const dto = { bookingId: 'booking-1' };
      paymentsService.initialize.mockResolvedValue({
        paymentId: 'p1',
        authorizationUrl: 'https://paystack.com/...',
        reference: 'ref-1',
      });

      const result = await controller.initialize(dto, 'user-1');
      expect(paymentsService.initialize).toHaveBeenCalledWith(
        'booking-1',
        'user-1',
      );
      expect(result.message).toBe('Payment initialized');
      expect(result.data).toHaveProperty('authorizationUrl');
    });
  });

  describe('POST /payments/webhook', () => {
    it('calls paymentsService.handleWebhook', async () => {
      const mockReq = {
        headers: { 'x-paystack-signature': 'test-sig' },
        rawBody: Buffer.from('{"event":"charge.success"}'),
      } as any;

      paymentsService.handleWebhook.mockResolvedValue(undefined);
      const result = await controller.webhook(mockReq);
      expect(paymentsService.handleWebhook).toHaveBeenCalled();
      expect(result.received).toBe(true);
    });

    it('handles missing signature', async () => {
      const mockReq = {
        headers: {},
        rawBody: Buffer.from('{}'),
      } as any;

      paymentsService.handleWebhook.mockResolvedValue(undefined);
      const result = await controller.webhook(mockReq);
      expect(paymentsService.handleWebhook).toHaveBeenCalledWith(
        expect.any(Buffer),
        '',
      );
      expect(result.received).toBe(true);
    });
  });

  describe('POST /payments/:id/refund', () => {
    it('calls paymentsService.refund', async () => {
      const payment = { id: 'p1', status: 'refunded' } as any;
      paymentsService.refund.mockResolvedValue(payment);

      const result = await controller.refund(
        'p1',
        'user-1',
        UserRole.SUPER_ADMIN,
      );
      expect(paymentsService.refund).toHaveBeenCalledWith(
        'p1',
        'user-1',
        UserRole.SUPER_ADMIN,
      );
      expect(result.message).toBe('Refund initiated');
    });
  });

  describe('GET /payments', () => {
    it('calls paymentsService.findAll', async () => {
      const query = { page: 1, limit: 20 };
      paymentsService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const result = await controller.findAll(query, 'user-1', UserRole.ADMIN);
      expect(paymentsService.findAll).toHaveBeenCalledWith(
        query,
        'user-1',
        UserRole.ADMIN,
      );
      expect(result.message).toBe('Payments retrieved successfully');
    });
  });

  describe('GET /payments/:id', () => {
    it('calls paymentsService.findById', async () => {
      const payment = { id: 'p1', amount: 5000 } as any;
      paymentsService.findById.mockResolvedValue(payment);

      const result = await controller.findOne('p1', 'user-1', UserRole.USER);
      expect(paymentsService.findById).toHaveBeenCalledWith(
        'p1',
        'user-1',
        UserRole.USER,
      );
      expect(result.data).toEqual(payment);
    });
  });
});
