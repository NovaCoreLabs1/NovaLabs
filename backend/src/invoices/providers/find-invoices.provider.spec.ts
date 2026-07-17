import { NotFoundException } from '@nestjs/common';
import { FindInvoicesProvider } from './find-invoices.provider';
import { UserRole } from '../../users/enums/userRoles.enum';
import { InvoiceStatus } from '../enums/invoice-status.enum';

describe('FindInvoicesProvider', () => {
  let provider: FindInvoicesProvider;
  let invoicesRepository: any;

  beforeEach(() => {
    invoicesRepository = {
      createQueryBuilder: jest.fn(),
    };
    provider = new FindInvoicesProvider(invoicesRepository);
  });

  function mockQueryBuilder(overrides: any = {}) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest
        .fn()
        .mockResolvedValue([overrides.data ?? [], overrides.total ?? 0]),
      getOne: jest.fn().mockResolvedValue(overrides.invoice ?? null),
    };
    invoicesRepository.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  describe('findAll', () => {
    it('filters by userId for regular users', async () => {
      const qb = mockQueryBuilder({ total: 1, data: [{ id: 'inv-1' }] });

      const result = await provider.findAll({}, 'user-1', UserRole.USER);

      expect(qb.where).toHaveBeenCalledWith('invoice.userId = :userId', {
        userId: 'user-1',
      });
      expect(result.data).toHaveLength(1);
    });

    it('does not filter by userId for admins', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll({}, 'admin-1', UserRole.ADMIN);

      expect(qb.where).not.toHaveBeenCalled();
    });

    it('filters by status', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { status: InvoiceStatus.PAID },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('invoice.status = :status', {
        status: InvoiceStatus.PAID,
      });
    });

    it('filters by bookingId', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { bookingId: 'booking-1' },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'invoice.bookingId = :bookingId',
        { bookingId: 'booking-1' },
      );
    });

    it('applies pagination', async () => {
      const qb = mockQueryBuilder({ total: 25, data: [] });

      await provider.findAll({ page: 2, limit: 10 }, 'admin-1', UserRole.ADMIN);

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('caps limit to 100', async () => {
      const qb = mockQueryBuilder({ total: 0, data: [] });

      await provider.findAll(
        { limit: 500 },
        'admin-1',
        UserRole.ADMIN,
      );

      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('findById', () => {
    it('returns invoice when found and owned by user', async () => {
      const qb = mockQueryBuilder({ invoice: { id: 'inv-1', userId: 'user-1' } });

      const result = await provider.findById('inv-1', 'user-1', UserRole.USER);
      expect(result).toEqual({ id: 'inv-1', userId: 'user-1' });
    });

    it('returns invoice for admin regardless of ownership', async () => {
      const qb = mockQueryBuilder({ invoice: { id: 'inv-1', userId: 'user-2' } });

      const result = await provider.findById('inv-1', 'admin-1', UserRole.ADMIN);
      expect(result).toEqual({ id: 'inv-1', userId: 'user-2' });
    });

    it('throws NotFoundException when invoice does not exist', async () => {
      mockQueryBuilder({ invoice: null });

      await expect(
        provider.findById('unknown', 'user-1', UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
