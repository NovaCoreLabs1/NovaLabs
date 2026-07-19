import { NotFoundException } from '@nestjs/common';
import { FindPaymentsProvider } from './find-payments.provider';
import { UserRole } from '../../users/enums/userRoles.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';

describe('FindPaymentsProvider', () => {
  let provider: FindPaymentsProvider;
  let paymentsRepository: any;

  beforeEach(() => {
    paymentsRepository = {
      createQueryBuilder: jest.fn(),
    };
    provider = new FindPaymentsProvider(paymentsRepository);
  });

  function mockQueryBuilder(overrides: any = {}) {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest
        .fn()
        .mockResolvedValue([overrides.data ?? [], overrides.total ?? 0]),
      getOne: jest.fn().mockResolvedValue(overrides.payment ?? null),
    };
    paymentsRepository.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  describe('findAll', () => {
    it('filters by userId for regular users', async () => {
      const qb = mockQueryBuilder({ total: 1, data: [{ id: 'pay-1' }] });

      const result = await provider.findAll({}, 'user-1', UserRole.USER);

      expect(qb.where).toHaveBeenCalledWith('payment.userId = :userId', {
        userId: 'user-1',
      });
      expect(result.data).toHaveLength(1);
    });

    it('does not filter by userId for admins', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll({}, 'admin-1', UserRole.ADMIN);

      expect(qb.where).not.toHaveBeenCalled();
    });

    it('filters by bookingId', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { bookingId: 'booking-1' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'payment.bookingId = :bookingId',
        { bookingId: 'booking-1' },
      );
    });

    it('filters by status', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { status: PaymentStatus.SUCCESS },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('payment.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
    });

    it('filters by provider', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { provider: PaymentProvider.PAYSTACK },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'payment.provider = :provider',
        { provider: PaymentProvider.PAYSTACK },
      );
    });

    it('filters by date range', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { from: '2024-01-01', to: '2024-01-31' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'payment.createdAt >= :from',
        { from: '2024-01-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'payment.createdAt <= :to',
        { to: '2024-01-31' },
      );
    });

    it('applies pagination with defaults', async () => {
      const qb = mockQueryBuilder({ total: 50, data: [] });

      const result = await provider.findAll({}, 'admin-1', UserRole.ADMIN);

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('caps limit to 100', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll({ limit: 500 }, 'admin-1', UserRole.ADMIN);

      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('findById', () => {
    it('returns payment when found and owned by user', async () => {
      const qb = mockQueryBuilder({
        payment: { id: 'pay-1', userId: 'user-1' },
      });

      const result = await provider.findById('pay-1', 'user-1', UserRole.USER);

      expect(result).toEqual({ id: 'pay-1', userId: 'user-1' });
    });

    it('returns payment for admin regardless of ownership', async () => {
      const qb = mockQueryBuilder({
        payment: { id: 'pay-1', userId: 'user-2' },
      });

      const result = await provider.findById(
        'pay-1',
        'admin-1',
        UserRole.ADMIN,
      );

      expect(result).toEqual({ id: 'pay-1', userId: 'user-2' });
    });

    it('returns null when payment not found', async () => {
      mockQueryBuilder({ payment: null });

      const result = await provider.findById(
        'unknown',
        'user-1',
        UserRole.USER,
      );

      expect(result).toBeNull();
    });
  });
});
